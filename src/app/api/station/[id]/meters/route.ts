import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getStartOfDayBangkok, getTodayBangkok } from '@/lib/date-utils';
import { requireStationAccessApi } from '@/lib/api-auth';
import { ensureOpenFullStationShiftForDailyRecord } from '@/lib/full-station-shift-sync';

type MeterPayload = {
    nozzleNumber: number;
    reading: number;
    photo?: string | null;
    photoUrl?: string | null;
    startPhoto?: string | null;
    endPhoto?: string | null;
};

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const stationId = `station-${id}`;
        const auth = await requireStationAccessApi(stationId);
        if (auth.response) return auth.response;

        const body = await request.json();
        const { date: dateStr, shiftId: requestedShiftId, type, meters } = body;

        if (type !== 'start' && type !== 'end') {
            return NextResponse.json({ error: 'ประเภทมิเตอร์ไม่ถูกต้อง' }, { status: 400 });
        }

        if (!Array.isArray(meters) || meters.length === 0) {
            return NextResponse.json({ error: 'ไม่พบข้อมูลมิเตอร์' }, { status: 400 });
        }
        const meterPayloads = (meters as MeterPayload[]).map(meter => ({
            ...meter,
            nozzleNumber: Number(meter.nozzleNumber),
            reading: Number(meter.reading),
        }));
        const invalidMeter = meterPayloads.find(meter =>
            !Number.isInteger(meter.nozzleNumber) ||
            meter.nozzleNumber < 1 ||
            meter.nozzleNumber > 4 ||
            !Number.isFinite(meter.reading) ||
            meter.reading < 0
        );
        const uniqueNozzles = new Set(meterPayloads.map(meter => meter.nozzleNumber));

        if (invalidMeter || uniqueNozzles.size !== meterPayloads.length) {
            return NextResponse.json({ error: 'ข้อมูลเลขมิเตอร์ไม่ถูกต้อง' }, { status: 400 });
        }

        const date = getStartOfDayBangkok(dateStr);

        if (dateStr !== getTodayBangkok() && auth.user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'การแก้มิเตอร์ย้อนหลังทำได้เฉพาะแอดมิน' }, { status: 403 });
        }

        // Get or create daily record
        const dailyRecord = await prisma.dailyRecord.upsert({
            where: { stationId_date: { stationId, date } },
            update: {},
            create: {
                stationId,
                date,
                retailPrice: 31.34,
                wholesalePrice: 30.5,
                status: 'OPEN',
            }
        });

        if (dailyRecord.status === 'CLOSED' && auth.user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'วันนี้ปิดแล้ว กรุณาให้แอดมินเป็นผู้แก้ไข' }, { status: 403 });
        }

        let shift = null;
        if (typeof requestedShiftId === 'string' && requestedShiftId.trim()) {
            shift = await prisma.shift.findFirst({
                where: {
                    id: requestedShiftId.trim(),
                    dailyRecordId: dailyRecord.id,
                },
            });

            if (!shift) {
                return NextResponse.json({ error: 'กะของวันที่เลือกเปลี่ยนไปแล้ว กรุณาโหลดข้อมูลใหม่' }, { status: 409 });
            }

            if (shift.status !== 'OPEN' && auth.user.role !== 'ADMIN') {
                return NextResponse.json({ error: 'กะนี้ปิดแล้ว กรุณาให้แอดมินเป็นผู้แก้ไข' }, { status: 403 });
            }
        } else {
            shift = await ensureOpenFullStationShiftForDailyRecord({
                dailyRecordId: dailyRecord.id,
                userId: auth.user.id,
                requireStartedMeters: false,
            });
        }
        const existingMeters = await prisma.meterReading.findMany({
            where: shift
                ? { shiftId: shift.id }
                : { dailyRecordId: dailyRecord.id },
        });
        const existingByNozzle = new Map(existingMeters.map(m => [m.nozzleNumber, m]));
        const getIncomingPhoto = (meter: MeterPayload) => {
            if (typeof meter.photo === 'string' && meter.photo.trim()) return meter.photo.trim();
            if (typeof meter.photoUrl === 'string' && meter.photoUrl.trim()) return meter.photoUrl.trim();
            const typedPhoto = type === 'start' ? meter.startPhoto : meter.endPhoto;
            return typeof typedPhoto === 'string' && typedPhoto.trim() ? typedPhoto.trim() : null;
        };

        const missingPhotoNozzles = meterPayloads
            .filter((meter) => {
                const existing = existingByNozzle.get(Number(meter.nozzleNumber));
                const existingPhoto = type === 'start' ? existing?.startPhoto : existing?.endPhoto;
                return !getIncomingPhoto(meter) && !existingPhoto;
            })
            .map((meter) => Number(meter.nozzleNumber))
            .sort((a: number, b: number) => a - b);

        if (missingPhotoNozzles.length > 0) {
            return NextResponse.json(
                { error: `กรุณาแนบรูปมิเตอร์${type === 'start' ? 'เริ่มต้น' : 'สิ้นสุด'} หัวจ่าย ${missingPhotoNozzles.join(', ')}` },
                { status: 400 }
            );
        }

        const invalidSequence = meterPayloads.find(meter => {
            const existingMeter = existingByNozzle.get(meter.nozzleNumber);
            const nextStart = type === 'start'
                ? meter.reading
                : Number(existingMeter?.startReading || 0);
            const nextEnd = type === 'end'
                ? meter.reading
                : existingMeter?.endReading == null
                    ? null
                    : Number(existingMeter.endReading);
            return nextStart > 0 && nextEnd != null && nextEnd > 0 && nextEnd < nextStart;
        });

        if (invalidSequence) {
            return NextResponse.json(
                { error: `มิเตอร์หัวจ่าย ${invalidSequence.nozzleNumber} มีเลขสิ้นสุดน้อยกว่าเลขเริ่มต้น` },
                { status: 400 }
            );
        }

        // Save all four readings and their audit trail as one unit.
        await prisma.$transaction(async tx => {
            for (const meter of meterPayloads) {
                const incomingPhoto = getIncomingPhoto(meter);
                const nozzleNumber = Number(meter.nozzleNumber);
                const existingMeter = existingByNozzle.get(nozzleNumber);
                const startReading = type === 'start'
                    ? meter.reading
                    : Number(existingMeter?.startReading || 0);
                const endReading = type === 'end'
                    ? meter.reading
                    : existingMeter?.endReading == null
                        ? null
                        : Number(existingMeter.endReading);
                const soldQty = startReading > 0 && endReading != null && endReading >= startReading
                    ? endReading - startReading
                    : null;
                let savedMeter;

                if (shift) {
                    savedMeter = await tx.meterReading.upsert({
                        where: {
                            shiftId_nozzleNumber: {
                                shiftId: shift.id,
                                nozzleNumber,
                            },
                        },
                        update: type === 'start'
                            ? {
                                startReading: meter.reading,
                                soldQty,
                                capturedById: auth.user.id,
                                capturedAt: new Date(),
                                ...(incomingPhoto ? { startPhoto: incomingPhoto } : {}),
                            }
                            : {
                                endReading: meter.reading,
                                soldQty,
                                capturedById: auth.user.id,
                                capturedAt: new Date(),
                                ...(incomingPhoto ? { endPhoto: incomingPhoto } : {}),
                            },
                        create: {
                            dailyRecordId: dailyRecord.id,
                            shiftId: shift.id,
                            nozzleNumber,
                            startReading: type === 'start' ? meter.reading : 0,
                            endReading: type === 'end' ? meter.reading : null,
                            soldQty,
                            startPhoto: type === 'start' ? incomingPhoto : null,
                            endPhoto: type === 'end' ? incomingPhoto : null,
                            capturedById: auth.user.id,
                            capturedAt: new Date(),
                        },
                    });
                } else if (existingMeter) {
                    savedMeter = await tx.meterReading.update({
                        where: { id: existingMeter.id },
                        data: type === 'start'
                            ? {
                                startReading: meter.reading,
                                soldQty,
                                capturedById: auth.user.id,
                                capturedAt: new Date(),
                                ...(incomingPhoto ? { startPhoto: incomingPhoto } : {}),
                            }
                            : {
                                endReading: meter.reading,
                                soldQty,
                                capturedById: auth.user.id,
                                capturedAt: new Date(),
                                ...(incomingPhoto ? { endPhoto: incomingPhoto } : {}),
                            },
                    });
                } else {
                    savedMeter = await tx.meterReading.create({
                        data: {
                            dailyRecordId: dailyRecord.id,
                            nozzleNumber,
                            startReading: type === 'start' ? meter.reading : 0,
                            endReading: type === 'end' ? meter.reading : null,
                            soldQty,
                            startPhoto: type === 'start' ? incomingPhoto : null,
                            endPhoto: type === 'end' ? incomingPhoto : null,
                            capturedById: auth.user.id,
                            capturedAt: new Date(),
                        },
                    });
                }

                if (auth.user.role === 'ADMIN') {
                    await tx.auditLog.create({
                        data: {
                            userId: auth.user.id,
                            action: existingMeter ? 'UPDATE' : 'CREATE',
                            model: 'MeterReading',
                            recordId: savedMeter.id,
                            oldData: existingMeter ? {
                                startReading: Number(existingMeter.startReading),
                                endReading: existingMeter.endReading == null ? null : Number(existingMeter.endReading),
                                soldQty: existingMeter.soldQty == null ? null : Number(existingMeter.soldQty),
                                startPhoto: existingMeter.startPhoto,
                                endPhoto: existingMeter.endPhoto,
                            } : undefined,
                            newData: {
                                source: 'admin-full-station-meter-entry',
                                date: dateStr,
                                shiftId: shift?.id || null,
                                nozzleNumber,
                                type,
                                reading: meter.reading,
                                soldQty,
                                photo: incomingPhoto || (type === 'start'
                                    ? existingMeter?.startPhoto || null
                                    : existingMeter?.endPhoto || null),
                            },
                        },
                    });
                }
            }
        });

        return NextResponse.json({ success: true, shiftId: shift?.id || null });
    } catch (error) {
        console.error('Meters POST error:', error);
        return NextResponse.json({ error: 'Failed to save meters' }, { status: 500 });
    }
}
