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
}

const RECEIPT_CONFIG: Record<string, { name: string; address1: string; address2: string; tel: string }> = {
    'station-1': { name: 'ศุภชัยบริการ(กำแพงเพชร)', address1: '172 หมู่ 1 ถนนพหลโยธิน ตำบลนครชุม', address2: 'อำเภอเมือง จังหวัดกำแพงเพชร 62000', tel: '055-840585, 055-773003' },
    'station-2': { name: 'ศุภชัยบริการ(กำแพงเพชร)', address1: '172 หมู่ 1 ถนนพหลโยธิน ตำบลนครชุม', address2: 'อำเภอเมือง จังหวัดกำแพงเพชร 62000', tel: '055-840585, 055-773003' },
    'station-3': { name: 'ศุภชัยบริการ(กำแพงเพชร)', address1: '172 หมู่ 1 ถนนพหลโยธิน ตำบลนครชุม', address2: 'อำเภอเมือง จังหวัดกำแพงเพชร 62000', tel: '055-840585, 055-773003' },
    'station-4': { name: 'ศุภชัยบริการ(กำแพงเพชร)', address1: '172 หมู่ 1 ถนนพหลโยธิน ตำบลนครชุม', address2: 'อำเภอเมือง จังหวัดกำแพงเพชร 62000', tel: '055-840585, 055-773003' },
};

const FUEL_LABELS: Record<string, string> = {
    DIESEL: 'ดีเซล B7',
    POWER_DIESEL: 'พาวเวอร์ดีเซล',
    GASOHOL_91: 'แก๊สโซฮอล์ 91',
    GASOHOL_95: 'แก๊สโซฮอล์ 95',
    GASOLINE_95: 'เบนซิน 95',
    GASOHOL_E20: 'E20',
};

// Receipt Component
function ReceiptContent({ txn, config, docNo, copyType }: {
    txn: Transaction;
    config: { name: string; address1: string; address2: string; tel: string };
    docNo: string;
    copyType: 'ต้นฉบับ' | 'สำเนา';
}) {
    const fmt = (n: number) => new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2 }).format(n);
    const fmtDate = (d: string) => {
        const date = new Date(d);
        return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
    };
    const fmtTime = (d: string) => new Date(d).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

    return (
        <div className="receipt bg-white w-[80mm] p-3 text-black">
            {/* Copy Type Label */}
            <div className="text-center font-bold border-2 border-black py-1 mb-2">
                [ {copyType} ]
            </div>

            {/* Header */}
            <div className="line"></div>
            <div className="text-center py-2">
                {/* Caltex Logo */}
                <img
                    src="/caltex-logo.jpg"
                    alt="Caltex"
                    className="mx-auto mb-2 grayscale"
                    style={{ width: '60px', height: 'auto' }}
                />
                <div className="font-bold">{config.name}</div>
                <div className="text-[10px]">{config.address1}</div>
                <div className="text-[10px]">{config.address2}</div>
                <div className="text-[10px]">โทร: {config.tel}</div>
            </div>
            <div className="line"></div>

            {/* Title */}
            <div className="text-center py-1">
                <div className="font-bold">[ ใบแจ้งหนี้ / ใบส่งของ (เงินเชื่อ) ]</div>
            </div>
            <div className="line"></div>

            {/* Document Info */}
            <div className="py-1">
                <div className="flex justify-between">
                    <span>เลขที่:</span>
                    <span className="font-bold">{docNo}</span>
                </div>
                <div className="flex justify-between">
                    <span>วันที่:</span>
                    <span>{fmtDate(txn.createdAt)} {fmtTime(txn.createdAt)}</span>
                </div>
            </div>

            {/* Customer Info */}
            <div className="line"></div>
            <div className="py-1">
                <div className="font-bold">ลูกค้า</div>
                <div className="flex justify-between">
                    <span>ชื่อ:</span>
                    <span className="font-bold">{txn.ownerName || '-'}</span>
                </div>
                <div className="flex justify-between">
                    <span>ทะเบียน:</span>
                    <span className="font-bold">{txn.licensePlate || '-'}</span>
                </div>
            </div>
            <div className="line"></div>

            {/* Items */}
            <div className="py-1">
                <div className="flex justify-between font-bold">
                    <span>รายการ</span>
                    <span>รวม(บาท)</span>
                </div>
                <div className="line"></div>
                {txn.liters > 0 && (
                    <div className="py-1">
                        <div className="font-bold">{FUEL_LABELS[txn.fuelType] || txn.fuelType}</div>
                        <div className="flex justify-between pl-2">
                            <span>{fmt(txn.liters)} L x {fmt(txn.pricePerLiter)}</span>
                            <span>{fmt(txn.amount)}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Total */}
            <div className="dline"></div>
            <div className="text-center py-2">
                <div className="font-bold">ยอดสุทธิ</div>
                <div className="text-xl font-bold">฿ {fmt(txn.amount)}</div>
            </div>
            <div className="dline"></div>

            {/* Signature - more space */}
            <div className="py-2 flex justify-between">
                <div className="text-center flex-1">
                    <div className="h-14 border-b border-black mb-1"></div>
                    <div className="text-[10px]">ผู้รับสินค้า</div>
                </div>
                <div className="w-4"></div>
                <div className="text-center flex-1">
                    <div className="h-14 border-b border-black mb-1"></div>
                    <div className="text-[10px]">ผู้ส่งสินค้า</div>
                </div>
            </div>

            {/* Date line */}
            <div className="py-1 text-center text-[10px]">
                วันที่ _____/_____/_____
            </div>

            {/* Footer */}
            <div className="line"></div>
            <div className="text-center py-1">
                <div className="font-bold">ขอบคุณที่ใช้บริการ</div>
            </div>
            <div className="line"></div>

            {/* Receipt ID */}
            <div className="text-center text-[9px] text-black pt-1">
                #{txn.id.slice(-8).toUpperCase()}
            </div>
        </div>
    );
}

export default function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const searchParams = useSearchParams();
    const transactionId = searchParams.get('txn');
    const stationId = `station-${id}`;
    const config = RECEIPT_CONFIG[stationId] || RECEIPT_CONFIG['station-1'];

    const [txn, setTxn] = useState<Transaction | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetch_ = async () => {
            if (!transactionId) { setLoading(false); return; }
            try {
                const res = await fetch(`/api/station/${id}/transactions/${transactionId}`);
                if (res.ok) setTxn(await res.json());
            } catch (e) { console.error(e); }
            finally { setLoading(false); }
        };
        fetch_();
    }, [id, transactionId]);

    if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-8 w-8 border-2 border-black border-t-transparent rounded-full"></div></div>;
    if (!txn) return <div className="min-h-screen flex items-center justify-center"><p>ไม่พบรายการ</p></div>;

    const docNo = `${txn.billBookNo || '00'}/${txn.billNo || '000'}`;

    return (
        <>
            <style jsx global>{`
                @media print {
                    @page { size: 80mm auto; margin: 0; }
                    body { margin: 0; padding: 0; }
                    .no-print { display: none !important; }
                    .receipt { width: 80mm !important; padding: 2mm !important; margin: 0 !important; box-shadow: none !important; page-break-after: always; }
                    .receipt:last-child { page-break-after: auto; }
                }
                .receipt { font-family: 'Courier New', Courier, monospace; font-size: 11px; line-height: 1.3; color: black; }
                .line { border-top: 1px solid black; margin: 4px 0; }
                .dline { border-top: 2px double black; margin: 4px 0; }
            `}</style>

            <div className="no-print fixed top-4 right-4 z-50 flex gap-2">
                <button onClick={() => window.history.back()} className="px-3 py-2 bg-gray-200 rounded-lg font-bold">← กลับ</button>
                <button onClick={() => window.print()} className="px-4 py-2 bg-black text-white rounded-lg font-bold">🖨️ พิมพ์</button>
            </div>

            <div className="min-h-screen bg-gray-300 flex flex-col items-center py-6 gap-4">
                {/* ต้นฉบับ (Original) */}
                <ReceiptContent txn={txn} config={config} docNo={docNo} copyType="ต้นฉบับ" />

                {/* Separator for screen view */}
                <div className="no-print text-gray-500 text-sm">- - - ตัดตรงนี้ - - -</div>

                {/* สำเนา (Copy) */}
                <ReceiptContent txn={txn} config={config} docNo={docNo} copyType="สำเนา" />
            </div>
        </>
    );
}
