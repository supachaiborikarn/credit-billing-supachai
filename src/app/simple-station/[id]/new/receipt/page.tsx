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

const RECEIPT_CONFIG: Record<string, { name: string; address1: string; address2: string; tel: string; taxId?: string }> = {
    'station-1': { name: 'ศุภชัยบริการ(กำแพงเพชร)', address1: '172 หมู่ 1 ถนนพหลโยธิน ตำบลนครชุม', address2: 'อำเภอเมือง จังหวัดกำแพงเพชร 62000', tel: '055-840585, 055-773003' },
    'station-2': { name: 'ศุภชัยบริการ(กำแพงเพชร)', address1: '172 หมู่ 1 ถนนพหลโยธิน ตำบลนครชุม', address2: 'อำเภอเมือง จังหวัดกำแพงเพชร 62000', tel: '055-840585, 055-773003' },
    'station-3': { name: 'ศุภชัยบริการ(กำแพงเพชร)', address1: '172 หมู่ 1 ถนนพหลโยธิน ตำบลนครชุม', address2: 'อำเภอเมือง จังหวัดกำแพงเพชร 62000', tel: '055-840585, 055-773003' },
    'station-4': { name: 'ศุภชัยบริการ(กำแพงเพชร)', address1: '172 หมู่ 1 ถนนพหลโยธิน ตำบลนครชุม', address2: 'อำเภอเมือง จังหวัดกำแพงเพชร 62000', tel: '055-840585, 055-773003' },
};

const FUEL_LABELS: Record<string, string> = {
    DIESEL: 'ดีเซล B7 (Diesel B7)',
    POWER_DIESEL: 'พาวเวอร์ดีเซล (Power Diesel)',
    GASOHOL_91: 'แก๊สโซฮอล์ 91 (Gasohol 91)',
    GASOHOL_95: 'แก๊สโซฮอล์ 95 (Gasohol 95)',
    GASOLINE_95: 'เบนซิน 95 (Gasoline 95)',
    GASOHOL_E20: 'E20 (Gasohol E20)',
};

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

    const fmt = (n: number) => new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2 }).format(n);
    const fmtDate = (d: string) => {
        const date = new Date(d);
        return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
    };
    const fmtTime = (d: string) => new Date(d).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

    if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-8 w-8 border-2 border-black border-t-transparent rounded-full"></div></div>;
    if (!txn) return <div className="min-h-screen flex items-center justify-center"><p>ไม่พบรายการ</p></div>;

    const docNo = `CRED-${txn.billBookNo || '00'}${txn.billNo || '000'}`;

    return (
        <>
            <style jsx global>{`
                @media print {
                    @page { size: 80mm auto; margin: 0; }
                    body { margin: 0; padding: 0; }
                    .no-print { display: none !important; }
                    .receipt { width: 80mm !important; padding: 2mm !important; margin: 0 !important; box-shadow: none !important; }
                }
                .receipt { font-family: 'Courier New', Courier, monospace; font-size: 11px; line-height: 1.3; }
                .line { border-top: 1px solid black; margin: 4px 0; }
                .dline { border-top: 2px double black; margin: 4px 0; }
            `}</style>

            <div className="no-print fixed top-4 right-4 z-50 flex gap-2">
                <button onClick={() => window.history.back()} className="px-3 py-2 bg-gray-200 rounded-lg font-bold">← กลับ</button>
                <button onClick={() => window.print()} className="px-4 py-2 bg-black text-white rounded-lg font-bold">🖨️ พิมพ์</button>
            </div>

            <div className="min-h-screen bg-gray-300 flex justify-center py-6">
                <div className="receipt bg-white w-[80mm] p-3 shadow-xl">

                    {/* Header */}
                    <div className="line"></div>
                    <div className="text-center py-1">
                        <div className="font-bold">★ CALTEX ★</div>
                        <div className="font-bold">{config.name}</div>
                        <div>{config.address1}</div>
                        <div>{config.address2}</div>
                        <div>โทร: {config.tel}</div>
                    </div>
                    <div className="line"></div>

                    {/* Title */}
                    <div className="text-center py-1">
                        <div className="font-bold">[ ใบแจ้งหนี้ / ใบส่งของ (เงินเชื่อ) ]</div>
                        <div>CREDIT INVOICE / DELIVERY NOTE</div>
                    </div>
                    <div className="line"></div>

                    {/* Document Info */}
                    <div className="py-1">
                        <div className="flex justify-between">
                            <span>เลขที่เอกสาร (INV No.):</span>
                            <span className="font-bold">{docNo}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>วันที่ (Date):</span>
                            <span>{fmtDate(txn.createdAt)} {fmtTime(txn.createdAt)}</span>
                        </div>
                    </div>

                    {/* Customer Info */}
                    <div className="line"></div>
                    <div className="py-1">
                        <div className="font-bold">ลูกค้า (Customer Info)</div>
                        <div className="flex justify-between">
                            <span>ชื่อบัญชี:</span>
                            <span className="font-bold">{txn.ownerName || '-'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>ทะเบียนรถ:</span>
                            <span className="font-bold">{txn.licensePlate || '-'}</span>
                        </div>
                    </div>
                    <div className="line"></div>

                    {/* Items */}
                    <div className="py-1">
                        <div className="flex justify-between font-bold">
                            <span>รายการสินค้า</span>
                            <span>รวม(บาท)</span>
                        </div>
                        <div className="line"></div>
                        {txn.liters > 0 && (
                            <div className="py-1">
                                <div>{FUEL_LABELS[txn.fuelType] || txn.fuelType}</div>
                                <div className="flex justify-between pl-2">
                                    <span>@ {fmt(txn.pricePerLiter)} บาท x {fmt(txn.liters)} L</span>
                                    <span>{fmt(txn.amount)}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Total */}
                    <div className="dline"></div>
                    <div className="text-center py-2">
                        <div className="font-bold">ยอดสุทธิที่ต้องชำระ (TOTAL DUE)</div>
                        <div className="text-xl font-bold">฿ {fmt(txn.amount)}</div>
                    </div>
                    <div className="dline"></div>

                    {/* Note */}
                    <div className="py-1 text-[10px]">
                        <div>หมายเหตุ: เอกสารนี้เป็นใบแจ้งหนี้/ใบส่งของ</div>
                        <div>ยังไม่ถือเป็นใบเสร็จรับเงินจนกว่าจะได้รับชำระเงินครบถ้วน</div>
                    </div>

                    {/* Signature - more space */}
                    <div className="py-3 flex justify-between">
                        <div className="text-center flex-1">
                            <div className="h-12 border-b border-black mb-1"></div>
                            <div className="text-[10px]">ผู้รับสินค้า / ผู้ขับขี่</div>
                            <div className="text-[9px]">(Received By / Driver)</div>
                        </div>
                        <div className="w-4"></div>
                        <div className="text-center flex-1">
                            <div className="h-12 border-b border-black mb-1"></div>
                            <div className="text-[10px]">ผู้ออกเอกสาร / ผู้ขาย</div>
                            <div className="text-[9px]">(Authorized Signature)</div>
                        </div>
                    </div>

                    {/* Date line */}
                    <div className="py-1 text-center text-[10px]">
                        วันที่ _____/_____/_____
                    </div>

                    {/* Footer */}
                    <div className="line"></div>
                    <div className="text-center py-2">
                        <div className="font-bold">ขอบคุณที่ใช้บริการคาลเท็กซ์</div>
                        <div>Thank you for choosing Caltex</div>
                    </div>
                    <div className="line"></div>

                    {/* Receipt ID */}
                    <div className="text-center text-[9px] text-black pt-1">
                        #{txn.id.slice(-8).toUpperCase()}
                    </div>
                </div>
            </div>
        </>
    );
}
