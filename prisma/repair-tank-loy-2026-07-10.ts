import { config } from 'dotenv';
import { Prisma, PrismaClient } from '@prisma/client';

config({ path: '.env.local' });

const prisma = new PrismaClient();

const BUSINESS_DATE = '2026-07-10';
const DAILY_RECORD_ID = 'dc1fa412-1936-4bd1-ac23-ad454d2bba00';
const DUPLICATE_SHIFT_ID = 'c88ca92f-fed0-478c-8f12-28395819c161';
const CANONICAL_SHIFT_ID = 'd1cc3783-1d79-4500-abab-8468d245f866';
const REPAIR_SOURCE = 'codex-repair-tank-loy-duplicate-shift-2026-07-10';

const END_READINGS = new Map<number, number>([
    [1, 6_054_256.5],
    [2, 6_467_087.89],
    [3, 10_186_199.52],
    [4, 7_120_757.98],
]);

function toNumber(value: Prisma.Decimal | number | null): number | null {
    return value == null ? null : Number(value);
}

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(message);
}

async function loadRepairState() {
    return prisma.dailyRecord.findUnique({
        where: { id: DAILY_RECORD_ID },
        include: {
            station: { select: { id: true, name: true } },
            shifts: {
                include: {
                    meters: { orderBy: { nozzleNumber: 'asc' } },
                    transactions: { select: { id: true } },
                    reconciliation: { select: { shiftId: true } },
                },
                orderBy: { shiftNumber: 'asc' },
            },
        },
    });
}

function validateRepairState(record: Awaited<ReturnType<typeof loadRepairState>>) {
    assert(record, 'ไม่พบ DailyRecord ที่ต้องซ่อม');
    assert(record.station.id === 'station-1', 'DailyRecord ไม่ได้อยู่ที่ station-1');
    assert(record.date.toISOString() === '2026-07-09T17:00:00.000Z', 'วันที่ DailyRecord ไม่ตรงกับ 10 กรกฎาคม เวลา Bangkok');

    const duplicateShift = record.shifts.find(shift => shift.id === DUPLICATE_SHIFT_ID);
    const canonicalShift = record.shifts.find(shift => shift.id === CANONICAL_SHIFT_ID);

    assert(duplicateShift, 'ไม่พบกะซ้ำที่ระบุ');
    assert(canonicalShift, 'ไม่พบกะจริงที่ระบุ');
    assert(duplicateShift.transactions.length === 0, 'กะซ้ำมีรายการขายแล้ว จึงหยุดซ่อมอัตโนมัติ');
    assert(!duplicateShift.reconciliation, 'กะซ้ำมียอดกระทบยอดแล้ว จึงหยุดซ่อมอัตโนมัติ');
    assert(duplicateShift.meters.length === 1, 'จำนวนมิเตอร์ในกะซ้ำเปลี่ยนไปแล้ว');
    assert(duplicateShift.meters[0].nozzleNumber === 1, 'มิเตอร์กะซ้ำไม่ใช่หัวจ่าย 1');
    assert(Number(duplicateShift.meters[0].startReading) === 0, 'เลขเปิดของกะซ้ำไม่ใช่ 0');
    assert(toNumber(duplicateShift.meters[0].endReading) == null, 'กะซ้ำมีเลขปิดแล้ว');
    assert(canonicalShift.transactions.length >= 10, 'จำนวนรายการขายของกะจริงน้อยกว่าหลักฐานเดิม');
    assert(canonicalShift.meters.length === 4, 'กะจริงไม่มีมิเตอร์ครบ 4 หัว');

    for (const meter of canonicalShift.meters) {
        const expectedEnd = END_READINGS.get(meter.nozzleNumber);
        assert(expectedEnd !== undefined, `ไม่พบเลขปิดที่ยืนยันแล้วของหัวจ่าย ${meter.nozzleNumber}`);
        assert(meter.startPhoto, `หัวจ่าย ${meter.nozzleNumber} ไม่มีรูปเปิด`);
        assert(meter.endPhoto, `หัวจ่าย ${meter.nozzleNumber} ไม่มีรูปปิด`);

        const currentEnd = toNumber(meter.endReading);
        assert(
            currentEnd === 0 || currentEnd === expectedEnd,
            `หัวจ่าย ${meter.nozzleNumber} ถูกแก้เป็น ${currentEnd} แล้ว จึงหยุดเพื่อไม่เขียนทับ`
        );
    }

    return { duplicateShift, canonicalShift };
}

async function main() {
    const shouldApply = process.argv.includes('--apply');
    const record = await loadRepairState();
    const { duplicateShift, canonicalShift } = validateRepairState(record);

    if (!shouldApply) {
        const repairRecordIds = [
            duplicateShift.id,
            ...canonicalShift.meters.map(meter => meter.id),
        ];
        const auditCandidates = await prisma.auditLog.findMany({
            where: { recordId: { in: repairRecordIds } },
            orderBy: { createdAt: 'desc' },
            take: 20,
            select: {
                action: true,
                model: true,
                recordId: true,
                newData: true,
            },
        });
        const repairAudits = auditCandidates.filter(log => {
            const newData = log.newData as Record<string, unknown> | null;
            return newData?.source === REPAIR_SOURCE;
        });

        console.log(JSON.stringify({
            mode: 'dry-run',
            businessDate: BUSINESS_DATE,
            stationId: record.station.id,
            duplicateShift: {
                id: duplicateShift.id,
                status: duplicateShift.status,
                transactionCount: duplicateShift.transactions.length,
                meterCount: duplicateShift.meters.length,
            },
            canonicalShift: {
                id: canonicalShift.id,
                status: canonicalShift.status,
                transactionCount: canonicalShift.transactions.length,
                meters: canonicalShift.meters.map(meter => ({
                    nozzleNumber: meter.nozzleNumber,
                    startReading: Number(meter.startReading),
                    currentEndReading: toNumber(meter.endReading),
                    repairedEndReading: END_READINGS.get(meter.nozzleNumber),
                })),
            },
            repairAuditCount: repairAudits.length,
            repairAudits: repairAudits.map(log => ({
                action: log.action,
                model: log.model,
                recordId: log.recordId,
            })),
        }, null, 2));
        return;
    }

    const result = await prisma.$transaction(async tx => {
        const freshRecord = await tx.dailyRecord.findUnique({
            where: { id: DAILY_RECORD_ID },
            include: {
                station: { select: { id: true, name: true } },
                shifts: {
                    include: {
                        meters: { orderBy: { nozzleNumber: 'asc' } },
                        transactions: { select: { id: true } },
                        reconciliation: { select: { shiftId: true } },
                    },
                    orderBy: { shiftNumber: 'asc' },
                },
            },
        });
        const {
            duplicateShift: currentDuplicateShift,
            canonicalShift: currentCanonicalShift,
        } = validateRepairState(freshRecord);
        const admin = await tx.user.findFirst({
            where: { role: 'ADMIN' },
            orderBy: { createdAt: 'asc' },
            select: { id: true, name: true },
        });
        assert(admin, 'ไม่พบบัญชีแอดมินสำหรับ Audit Log');

        let updatedMeterCount = 0;
        for (const meter of currentCanonicalShift.meters) {
            const endReading = END_READINGS.get(meter.nozzleNumber)!;
            const startReading = Number(meter.startReading);
            const soldQty = Math.max(endReading - startReading, 0);
            const currentEnd = toNumber(meter.endReading);

            if (currentEnd !== endReading) {
                await tx.meterReading.update({
                    where: { id: meter.id },
                    data: {
                        endReading,
                        soldQty,
                        capturedAt: new Date(),
                        capturedById: admin.id,
                        note: REPAIR_SOURCE,
                    },
                });
                await tx.auditLog.create({
                    data: {
                        userId: admin.id,
                        action: 'UPDATE',
                        model: 'MeterReading',
                        recordId: meter.id,
                        oldData: {
                            endReading: currentEnd,
                            soldQty: toNumber(meter.soldQty),
                        },
                        newData: {
                            endReading,
                            soldQty,
                            nozzleNumber: meter.nozzleNumber,
                            shiftId: CANONICAL_SHIFT_ID,
                            businessDate: BUSINESS_DATE,
                            source: REPAIR_SOURCE,
                            evidence: 'existing-end-meter-photo',
                        },
                    },
                });
                updatedMeterCount += 1;
            }
        }

        let closedDuplicateShift = false;
        if (currentDuplicateShift.status === 'OPEN') {
            await tx.shift.update({
                where: { id: currentDuplicateShift.id },
                data: {
                    status: 'CLOSED',
                    closedAt: new Date(),
                    closedById: admin.id,
                    varianceNote: `${REPAIR_SOURCE}; superseded-by=${CANONICAL_SHIFT_ID}`,
                },
            });
            await tx.auditLog.create({
                data: {
                    userId: admin.id,
                    action: 'UPDATE',
                    model: 'Shift',
                    recordId: currentDuplicateShift.id,
                    oldData: {
                        status: currentDuplicateShift.status,
                        transactionCount: currentDuplicateShift.transactions.length,
                        meterCount: currentDuplicateShift.meters.length,
                    },
                    newData: {
                        status: 'CLOSED',
                        canonicalShiftId: CANONICAL_SHIFT_ID,
                        businessDate: BUSINESS_DATE,
                        source: REPAIR_SOURCE,
                    },
                },
            });
            closedDuplicateShift = true;
        }

        return {
            adminName: admin.name,
            updatedMeterCount,
            closedDuplicateShift,
        };
    }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });

    console.log(JSON.stringify({ mode: 'applied', ...result }, null, 2));
}

main()
    .catch(error => {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
