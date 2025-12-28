'use client';

import { useEffect, useState, use } from 'react';
import { useSearchParams } from 'next/navigation';
import { STATIONS } from '@/constants';

interface Transaction {
    id: string;
    date: string;
    licensePlate: string;
    ownerName: string;
    paymentType: string;
    fuelType: string;
    liters: number;
    pricePerLiter: number;
    amount: number;
    billBookNo: string;
    billNo: string;
    createdAt: string;
    recordedBy?: {
        name: string;
    };
}

const RECEIPT_CONFIG: Record<string, { name: string; address: string; tel: string }> = {
    'station-1': { name: 'ศุภชัยบริการ(กำแพงเพชร)', address: '172 หมู่ 1 ถ.พหลโยธิน ต.นครชุม อ.เมือง จ.กำแพงเพชร 62000', tel: '055-840585' },
    'station-2': { name: 'ศุภชัยบริการ(กำแพงเพชร)', address: '172 หมู่ 1 ถ.พหลโยธิน ต.นครชุม อ.เมือง จ.กำแพงเพชร 62000', tel: '055-840585' },
    'station-3': { name: 'ศุภชัยบริการ(กำแพงเพชร)', address: '172 หมู่ 1 ถ.พหลโยธิน ต.นครชุม อ.เมือง จ.กำแพงเพชร 62000', tel: '055-840585' },
    'station-4': { name: 'ศุภชัยบริการ(กำแพงเพชร)', address: '172 หมู่ 1 ถ.พหลโยธิน ต.นครชุม อ.เมือง จ.กำแพงเพชร 62000', tel: '055-840585' },
};

const FUEL_LABELS: Record<string, string> = {
    DIESEL: 'ดีเซล B7',
    POWER_DIESEL: 'พาวเวอร์ดีเซล',
    GASOHOL_91: 'แก๊สโซฮอล์ 91',
    GASOHOL_95: 'แก๊สโซฮอล์ 95',
    GASOLINE_95: 'เบนซิน 95',
    GASOHOL_E20: 'E20',
};

export default function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const searchParams = useSearchParams();
    const transactionId = searchParams.get('txn');
    const stationId = `station-${id}`;
    const receiptConfig = RECEIPT_CONFIG[stationId] || RECEIPT_CONFIG['station-1'];

    const [transaction, setTransaction] = useState<Transaction | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTransaction = async () => {
            if (!transactionId) { setLoading(false); return; }
            try {
                const res = await fetch(`/api/station/${id}/transactions/${transactionId}`);
                if (res.ok) { setTransaction(await res.json()); }
            } catch (e) { console.error(e); }
            finally { setLoading(false); }
        };
        fetchTransaction();
    }, [id, transactionId]);

    const fmt = (n: number) => new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2 }).format(n);
    const fmtDate = (d: string) => new Date(d).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' });
    const fmtTime = (d: string) => new Date(d).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

    if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-8 w-8 border-2 border-black border-t-transparent rounded-full"></div></div>;
    if (!transaction) return <div className="min-h-screen flex items-center justify-center"><p>ไม่พบรายการ</p></div>;

    return (
        <>
            <style jsx global>{`
                @media print {
                    @page { size: 80mm auto; margin: 0; }
                    body { margin: 0; padding: 0; }
                    .no-print { display: none !important; }
                    .receipt { width: 80mm !important; padding: 2mm !important; margin: 0 !important; box-shadow: none !important; }
                }
            `}</style>

            {/* Buttons */}
            <div className="no-print fixed top-4 right-4 z-50 flex gap-2">
                <button onClick={() => window.history.back()} className="px-3 py-2 bg-gray-200 rounded-lg font-bold">← กลับ</button>
                <button onClick={() => window.print()} className="px-4 py-2 bg-black text-white rounded-lg font-bold">🖨️ พิมพ์</button>
            </div>

            {/* Receipt */}
            <div className="min-h-screen bg-gray-200 flex justify-center py-6">
                <div className="receipt bg-white w-[80mm] p-3 shadow-lg" style={{ fontFamily: 'monospace' }}>

                    {/* Header */}
                    <div className="text-center border-b-2 border-black pb-2 mb-2">
                        <pre className="text-xs leading-tight">{`
   ★ CALTEX ★
`}</pre>
                        <div className="font-bold text-sm">{receiptConfig.name}</div>
                        <div className="text-[10px]">{receiptConfig.address}</div>
                        <div className="text-[10px]">โทร: {receiptConfig.tel}</div>
                    </div>

                    {/* Title */}
                    <div className="text-center font-bold border border-black py-1 mb-2">
                        ใบส่งของเงินเชื่อ
                    </div>

                    {/* Info */}
                    <div className="text-xs space-y-0.5 mb-2">
                        <div className="flex justify-between">
                            <span>วันที่:</span>
                            <span>{fmtDate(transaction.createdAt)} {fmtTime(transaction.createdAt)}</span>
                        </div>
                        {(transaction.billBookNo || transaction.billNo) && (
                            <div className="flex justify-between">
                                <span>เล่ม/เลขที่:</span>
                                <span className="font-bold">{transaction.billBookNo || '-'}/{transaction.billNo || '-'}</span>
                            </div>
                        )}
                    </div>

                    {/* Customer */}
                    <div className="border border-black p-1.5 mb-2 text-xs">
                        <div className="flex justify-between">
                            <span>ทะเบียน:</span>
                            <span className="font-bold">{transaction.licensePlate || '-'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>ชื่อ:</span>
                            <span className="font-bold">{transaction.ownerName || '-'}</span>
                        </div>
                    </div>

                    {/* Items */}
                    {transaction.liters > 0 && (
                        <div className="text-xs mb-2 border-b border-black pb-1">
                            <div className="flex justify-between font-bold">
                                <span>{FUEL_LABELS[transaction.fuelType] || transaction.fuelType}</span>
                            </div>
                            <div className="flex justify-between text-[10px]">
                                <span>{fmt(transaction.liters)} L x {fmt(transaction.pricePerLiter)}</span>
                                <span>{fmt(transaction.liters * transaction.pricePerLiter)}</span>
                            </div>
                        </div>
                    )}

                    {/* Total */}
                    <div className="border-2 border-black p-2 text-center mb-2">
                        <div className="text-xs">รวมทั้งสิ้น</div>
                        <div className="text-xl font-bold">{fmt(transaction.amount)} บาท</div>
                    </div>

                    {/* Signature */}
                    <div className="flex justify-between text-[10px] mb-2">
                        <div className="text-center flex-1">
                            <div className="border-b border-black h-5 mb-0.5"></div>
                            <span>ผู้รับ</span>
                        </div>
                        <div className="w-3"></div>
                        <div className="text-center flex-1">
                            <div className="border-b border-black h-5 mb-0.5"></div>
                            <span>ผู้ส่ง</span>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="text-center text-[10px] border-t border-black pt-1">
                        <div>ขอบคุณที่ใช้บริการ</div>
                        <div className="text-[8px] text-gray-500">#{transaction.id.slice(-6).toUpperCase()}</div>
                    </div>
                </div>
            </div>
        </>
    );
}
