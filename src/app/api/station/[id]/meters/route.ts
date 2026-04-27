import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getStartOfDayBangkok } from '@/lib/date-utils';
import { requireStationAccessApi } from '@/lib/api-auth';

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
        const { date: dateStr, type, meters } = body;

        if (type !== 'start' && type !== 'end') {
            return NextResponse.json({ error: 'ประเภทมิเตอร์ไม่ถูกต้อง' }, { status: 400 });
        }

        if (!Array.isArray(meters) || meters.length === 0) {
            return NextResponse.json({ error: 'ไม่พบข้อมูลมิเตอร์' }, { status: 400 });
        }
        const meterPayloads = meters as MeterPayload[];

        const date = getStartOfDayBangkok(dateStr);

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

        const existingMeters = await prisma.meterReading.findMany({
            where: { dailyRecordId: dailyRecord.id },
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

        // Update meter readings
        for (const meter of meterPayloads) {
            const incomingPhoto = getIncomingPhoto(meter);
            await prisma.meterReading.upsert({
                where: {
                    dailyRecordId_nozzleNumber: {
                        dailyRecordId: dailyRecord.id,
                        nozzleNumber: Number(meter.nozzleNumber),
                    }
                },
                update: type === 'start'
                    ? {
                        startReading: meter.reading,
                        ...(incomingPhoto ? { startPhoto: incomingPhoto } : {}),
                    }
                    : {
                        endReading: meter.reading,
                        ...(incomingPhoto ? { endPhoto: incomingPhoto } : {}),
                    },
                create: {
                    dailyRecordId: dailyRecord.id,
                    nozzleNumber: Number(meter.nozzleNumber),
                    startReading: type === 'start' ? meter.reading : 0,
                    endReading: type === 'end' ? meter.reading : null,
                    startPhoto: type === 'start' ? incomingPhoto : null,
                    endPhoto: type === 'end' ? incomingPhoto : null,
                }
            });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Meters POST error:', error);
        return NextResponse.json({ error: 'Failed to save meters' }, { status: 500 });
    }
}
