import { describe, expect, it, vi } from 'vitest';
import {
    buildFullStationSummaryCsv,
    buildFullStationSummaryCsvFilename,
    filterFullSummaryTransactions,
    getStationTransactionApiPath,
    replaceFullStationTransferProof,
    voidFullStationTransaction,
    type FullSummaryTransaction,
} from '@/lib/stations/full-summary-compat';

const transaction: FullSummaryTransaction = {
    id: 'txn-1',
    date: '2026-08-28T10:00:00.000Z',
    licensePlate: 'กข,1234',
    ownerId: 'owner-1',
    ownerName: 'ลูกค้า "ทดสอบ"',
    paymentType: 'TRANSFER',
    fuelType: 'DIESEL',
    nozzleNumber: 1,
    liters: 10,
    pricePerLiter: 31.34,
    amount: 313.4,
    billBookNo: '830',
    billNo: '41462',
    transferProofUrl: 'https://example.com/old.webp',
};

describe('FULL summary compatibility helpers', () => {
    it('exports the legacy summary columns with Thai labels, totals and safe CSV escaping', () => {
        const csv = buildFullStationSummaryCsv([transaction]);

        expect(csv.startsWith('\uFEFF')).toBe(true);
        expect(csv).toContain('"ทะเบียน"');
        expect(csv).toContain('"กข,1234"');
        expect(csv).toContain('"ลูกค้า ""ทดสอบ"""');
        expect(csv).toContain('"น้ำมันดีเซล"');
        expect(csv).toContain('"โอนเงิน"');
        expect(csv).toContain('"รวม"');
        expect(csv).toContain('"10"');
        expect(csv).toContain('"313.4"');
    });

    it('keeps legacy payment-type filtering available for CSV export', () => {
        const cash = { ...transaction, id: 'cash', paymentType: 'CASH' };
        expect(filterFullSummaryTransactions([transaction, cash], 'all')).toHaveLength(2);
        expect(filterFullSummaryTransactions([transaction, cash], 'TRANSFER').map((item) => item.id)).toEqual(['txn-1']);
        expect(filterFullSummaryTransactions([transaction, cash], 'CREDIT')).toEqual([]);
    });

    it('builds a filesystem-safe Thai CSV filename', () => {
        expect(buildFullStationSummaryCsvFilename('แท๊งลอย/วัชรเกียรติ', '2026-08-28'))
            .toBe('สรุปรายการ_แท๊งลอย-วัชรเกียรติ_2026-08-28.csv');
    });

    it('binds historical maintenance calls to the station-scoped transaction route', async () => {
        expect(getStationTransactionApiPath('1', 'txn/1')).toBe('/api/station/1/transactions/txn%2F1');

        const deleteFetch = vi.fn(async () => new Response(JSON.stringify({ success: true }), { status: 200 }));
        await voidFullStationTransaction({
            stationParam: '1',
            transactionId: 'txn-1',
            reason: '  ลงรายการซ้ำ  ',
            fetchImpl: deleteFetch,
        });
        expect(deleteFetch).toHaveBeenCalledWith('/api/station/1/transactions/txn-1', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason: 'ลงรายการซ้ำ' }),
        });
    });

    it('blocks historical void calls with an invalid reason before sending the request', async () => {
        const deleteFetch = vi.fn();
        await expect(voidFullStationTransaction({
            stationParam: '1',
            transactionId: 'txn-1',
            reason: '  ',
            fetchImpl: deleteFetch,
        })).rejects.toThrow('เหตุผลในการยกเลิกต้องมีความยาว 3-200 ตัวอักษร');
        expect(deleteFetch).not.toHaveBeenCalled();
    });

    it('uploads a replacement proof then updates the same station-bound transaction without changing money fields', async () => {
        const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
        const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            calls.push({ input, init });
            if (calls.length === 1) {
                return new Response(JSON.stringify({ url: 'https://example.com/new.webp' }), { status: 200 });
            }
            return new Response(JSON.stringify({ success: true }), { status: 200 });
        });

        const file = Object.assign(new Blob(['proof'], { type: 'image/png' }), { name: 'proof.png' });
        const url = await replaceFullStationTransferProof({
            stationParam: '1',
            transaction,
            file,
            fetchImpl,
        });

        expect(url).toBe('https://example.com/new.webp');
        expect(calls[0].input).toBe('/api/upload/transfer-proof');
        expect(calls[0].init?.method).toBe('POST');
        expect(calls[1].input).toBe('/api/station/1/transactions/txn-1');
        expect(calls[1].init?.method).toBe('PUT');
        const body = JSON.parse(String(calls[1].init?.body));
        expect(body).toMatchObject({
            paymentType: 'TRANSFER',
            liters: 10,
            pricePerLiter: 31.34,
            amount: 313.4,
            transferProofUrl: 'https://example.com/new.webp',
        });
    });
});
