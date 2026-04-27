'use client';

import { useEffect, useState, use } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import NextImage from 'next/image';
import Link from 'next/link';
import { Printer, ArrowLeft, Home, FileText } from 'lucide-react';

type ReceiptDocType = 'receipt' | 'credit';
type PaperSize = '58' | '80';

const PRINTER_PROFILE = {
    model: 'Epson TM-m30III',
    recommendedPaper: '80' as PaperSize,
    paperWidthMm: { '58': 58, '80': 80 } as Record<PaperSize, number>,
    printableWidthMm: { '58': 52.5, '80': 72 } as Record<PaperSize, number>,
};

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
    recordedBy?: { name: string };
}

const RECEIPT_CONFIG: Record<string, { name: string; address1: string; address2: string; tel: string }> = {
    'station-1': { name: 'วัชรเกียรติออยล์', address1: '657 ถ.เจริญสุข ต.ในเมือง อ.เมือง', address2: 'จ.กำแพงเพชร 62000', tel: '055-840585, 055-773003' },
    'station-2': { name: 'หจก.วัชรเกียรติออยล์', address1: '657 ถ.เจริญสุข ต.ในเมือง อ.เมือง', address2: 'จ.กำแพงเพชร 62000', tel: '055-773003' },
    'station-3': { name: 'ศุภชัยบริการ(กำแพงเพชร)', address1: '172 หมู่ 1 ถนนพหลโยธิน ตำบลนครชุม', address2: 'อำเภอเมือง จังหวัดกำแพงเพชร 62000', tel: '055-840585, 055-773003' },
    'station-4': { name: 'ศุภชัยบริการ(กำแพงเพชร)', address1: '172 หมู่ 1 ถนนพหลโยธิน ตำบลนครชุม', address2: 'อำเภอเมือง จังหวัดกำแพงเพชร 62000', tel: '055-840585, 055-773003' },
    'station-5': { name: 'ปั๊มแก๊สพงษ์อนันต์', address1: '172 หมู่ 1 ถนนพหลโยธิน ตำบลนครชุม', address2: 'อำเภอเมือง จังหวัดกำแพงเพชร 62000', tel: '055-840585' },
    'station-6': { name: 'ปั๊มแก๊สศุภชัย', address1: '172 หมู่ 1 ถนนพหลโยธิน ตำบลนครชุม', address2: 'อำเภอเมือง จังหวัดกำแพงเพชร 62000', tel: '055-840585' },
};

const FUEL_LABELS: Record<string, string> = {
    DIESEL: 'ดีเซล B7',
    POWER_DIESEL: 'พาวเวอร์ดีเซล',
    GASOHOL_91: 'แก๊สโซฮอล์ 91',
    GASOHOL_95: 'แก๊สโซฮอล์ 95',
    GASOLINE_95: 'เบนซิน 95',
    GASOHOL_E20: 'E20',
    LPG: 'แก๊ส LPG',
    ENGINE_OIL: 'น้ำมันเครื่อง/สินค้า',
    COOLANT: 'น้ำยาหล่อเย็น',
    OTHER_PRODUCT: 'สินค้าอื่นๆ',
};

const PAYMENT_LABELS: Record<string, string> = {
    CASH: 'เงินสด',
    CREDIT: 'เงินเชื่อ',
    TRANSFER: 'โอนเงิน',
    CREDIT_CARD: 'บัตรเครดิต',
    BOX_TRUCK: 'รถตู้ทึบ',
    OIL_TRUCK_SUPACHAI: 'รถน้ำมันศุภชัย',
};

// Receipt Component
function ReceiptContent({ txn, config, docNo, copyType, docType, paperSize }: {
    txn: Transaction;
    config: { name: string; address1: string; address2: string; tel: string };
    docNo: string;
    copyType: 'ต้นฉบับ' | 'สำเนา';
    docType: ReceiptDocType;
    paperSize: PaperSize;
}) {
    const fmt = (n: number) => new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2 }).format(n);
    const fmtDate = (d: string) => {
        const date = new Date(d);
        return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
    };
    const fmtTime = (d: string) => new Date(d).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

    const paymentLabel = PAYMENT_LABELS[txn.paymentType] || txn.paymentType;
    const isCreditDocument = docType === 'credit';
    const isCompact = paperSize === '58';
    const printableWidthMm = PRINTER_PROFILE.printableWidthMm[paperSize];
    const receiptDate = txn.createdAt || txn.date;
    const documentTitle = isCreditDocument ? 'บิลเงินเชื่อ / ใบส่งของ' : 'ใบเสร็จรับเงิน';

    return (
        <div
            className={`receipt bg-white text-black mx-auto overflow-hidden ${isCompact ? 'p-2' : 'p-3'}`}
            style={{ width: `${printableWidthMm}mm`, boxSizing: 'border-box' }}
        >
            <style jsx>{`
                @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap');
                
                .receipt {
                    font-family: 'Sarabun', sans-serif;
                    line-height: ${isCompact ? '1.25' : '1.4'};
                }
                .line { border-top: 1px solid black; margin: ${isCompact ? '6px' : '8px'} 0; }
                .line-dashed { border-top: 1px dashed black; margin: ${isCompact ? '6px' : '8px'} 0; }
                .dline { border-top: 3px double black; margin: ${isCompact ? '6px' : '8px'} 0; }
            `}</style>

            {/* Copy Type Tag */}
            <div className={`text-center font-bold border-2 border-black py-1 rounded-lg uppercase tracking-wide ${isCompact ? 'mb-2 text-[11px]' : 'mb-3 text-sm'}`}>
                [ {copyType} ]
            </div>

            {/* Header / Logo */}
            <div className="text-center pb-2">
                <NextImage
                    src="/caltex-logo.jpg"
                    alt="Caltex"
                    width={isCompact ? 38 : 50}
                    height={isCompact ? 38 : 50}
                    priority
                    className={`mx-auto grayscale ${isCompact ? 'mb-1' : 'mb-2'}`}
                    style={{ height: 'auto', display: 'block' }}
                />
                <h1 className={`font-bold leading-tight mb-1 ${isCompact ? 'text-[15px]' : 'text-lg'}`}>{config.name}</h1>
                <p className={`${isCompact ? 'text-[9px]' : 'text-[11px]'} leading-tight`}>{config.address1}</p>
                <p className={`${isCompact ? 'text-[9px]' : 'text-[11px]'} leading-tight`}>{config.address2}</p>
                <p className={`${isCompact ? 'text-[9px]' : 'text-[11px]'} font-semibold mt-1`}>โทร: {config.tel}</p>
            </div>
            
            <div className="dline"></div>

            {/* Document Title */}
            <div className="text-center py-1">
                <h2 className={`${isCompact ? 'text-[12px]' : 'text-[14px]'} font-bold`}>
                    {documentTitle}
                </h2>
                <div className={`${isCompact ? 'text-[11px]' : 'text-[13px]'} font-semibold`}>({paymentLabel})</div>
            </div>
            
            <div className="line"></div>

            {/* Generic Info */}
            <div className={`${isCompact ? 'text-[10px]' : 'text-[12px]'} space-y-1 py-1`}>
                <div className="flex justify-between">
                    <span className="text-gray-800">เลขที่:</span>
                    <span className="font-bold">{docNo}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-gray-800">วันที่:</span>
                    <span>{fmtDate(receiptDate)} {fmtTime(receiptDate)}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-gray-800">พนักงาน:</span>
                    <span>{txn.recordedBy?.name || '-'}</span>
                </div>
            </div>

            {/* Customer Info (especially for credit) */}
            <div className="line-dashed"></div>
            <div className={`py-1 ${isCompact ? 'text-[10px]' : 'text-[12px]'}`}>
                <div className="font-bold mb-1">ข้อมูลลูกค้า</div>
                <div className="flex justify-between">
                    <span className="text-gray-800">ชื่อลูกค้า:</span>
                    <span className={`font-bold text-right truncate ${isCompact ? 'max-w-[118px]' : 'max-w-[180px]'}`}>{txn.ownerName || 'เงินสดทั่วไป'}</span>
                </div>
                {txn.licensePlate && (
                    <div className="flex justify-between mt-1">
                        <span className="text-gray-800">ทะเบียนรถ:</span>
                        <span className="font-bold">{txn.licensePlate}</span>
                    </div>
                )}
            </div>
            <div className="line-dashed"></div>

            {/* Items */}
            <div className="py-2">
                <div className={`flex justify-between font-bold mb-2 ${isCompact ? 'text-[11px]' : 'text-[13px]'}`}>
                    <span>รายการสินค้า</span>
                    <span>รวม (บาท)</span>
                </div>
                
                {txn.liters > 0 ? (
                    <div className={isCompact ? 'text-[10px]' : 'text-[12px]'}>
                        <div className={`font-bold ${isCompact ? 'text-[11px]' : 'text-[13px]'}`}>{FUEL_LABELS[txn.fuelType] || txn.fuelType}</div>
                        <div className="flex justify-between items-end mt-1">
                            <span className="text-gray-800">{fmt(txn.liters)} ลิตร @ {fmt(txn.pricePerLiter)}</span>
                            <span className={`font-semibold ${isCompact ? 'text-[11px]' : 'text-[13px]'}`}>{fmt(txn.amount)}</span>
                        </div>
                    </div>
                ) : (
                    <div className={isCompact ? 'text-[10px]' : 'text-[12px]'}>
                        <div className={`font-bold ${isCompact ? 'text-[11px]' : 'text-[13px]'}`}>{FUEL_LABELS[txn.fuelType] || txn.fuelType || 'สินค้าอื่นๆ'}</div>
                        <div className="flex justify-between items-end mt-1">
                            <span className="text-gray-800">1 รายการ</span>
                            <span className={`font-semibold ${isCompact ? 'text-[11px]' : 'text-[13px]'}`}>{fmt(txn.amount)}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Total */}
            <div className="dline mt-2"></div>
            <div className="flex justify-between items-center py-2">
                <div className={`font-bold ${isCompact ? 'text-[12px]' : 'text-[14px]'}`}>ยอดสุทธิ</div>
                <div className={`${isCompact ? 'text-[15px]' : 'text-[18px]'} font-bold`}>฿ {fmt(txn.amount)}</div>
            </div>
            <div className="dline mb-2"></div>

            {/* Signatures (Show clearly for credit transactions) */}
            {isCreditDocument && (
                <div className={`${isCompact ? 'py-3 gap-2' : 'py-4 gap-4'} mt-2 flex justify-between`}>
                    <div className="text-center flex-1">
                        <div className={`${isCompact ? 'h-8' : 'h-10'} border-b border-black mb-2 relative`}>
                            {/* Line for signature */}
                        </div>
                        <div className={isCompact ? 'text-[9px]' : 'text-[11px]'}>ผู้รับสินค้า / ลูกค้า</div>
                    </div>
                    <div className="text-center flex-1">
                        <div className={`${isCompact ? 'h-8' : 'h-10'} border-b border-black mb-2 relative`}>
                            {/* Line for signature */}
                        </div>
                        <div className={isCompact ? 'text-[9px]' : 'text-[11px]'}>ผู้ส่งสินค้า / ผู้ขาย</div>
                    </div>
                </div>
            )}

            {/* Date line for signature validation */}
            {isCreditDocument && (
                <div className={`pb-2 text-center ${isCompact ? 'text-[9px]' : 'text-[11px]'}`}>
                    วันที่ลงนาม: _____/_____/_____
                </div>
            )}

            {/* Footer */}
            <div className="line"></div>
            <div className={`text-center py-2 ${isCompact ? 'text-[10px]' : 'text-[12px]'}`}>
                <div className="font-bold">ขอบคุณที่ใช้บริการครับ 😊</div>
                <div className={`${isCompact ? 'text-[8px]' : 'text-[9px]'} text-gray-500 mt-2`}>Ref: {txn.id.slice(0, 8).toUpperCase()}</div>
            </div>
        </div>
    );
}

export default function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const transactionId = searchParams.get('txn');
    const autoPrint = searchParams.get('autoPrint') === 'true';
    const initialDocType: ReceiptDocType = searchParams.get('docType') === 'credit' ? 'credit' : 'receipt';
    const initialPaperSize: PaperSize = searchParams.get('paper') === '58' ? '58' : '80';
    
    const stationId = `station-${id}`;
    const config = RECEIPT_CONFIG[stationId] || RECEIPT_CONFIG['station-1'];
    const routeBase = pathname.startsWith('/station/')
        ? `/station/${id}/new`
        : `/simple-station/${id}/new`;

    const [txn, setTxn] = useState<Transaction | null>(null);
    const [loading, setLoading] = useState(true);
    const [docType, setDocType] = useState<ReceiptDocType>(initialDocType);
    const [paperSize, setPaperSize] = useState<PaperSize>(initialPaperSize);
    const [autoPrintStarted, setAutoPrintStarted] = useState(false);
    const paperWidthMm = PRINTER_PROFILE.paperWidthMm[paperSize];
    const printableWidthMm = PRINTER_PROFILE.printableWidthMm[paperSize];

    // Fetch Transaction
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

    // Handle Auto Print Action
    useEffect(() => {
        if (!loading && txn && autoPrint) {
            // Slight delay to ensure fonts and layout are fully rendered
            const timer = setTimeout(() => {
                setAutoPrintStarted(true);
                window.print();
            }, 800);
            return () => clearTimeout(timer);
        }
    }, [loading, txn, autoPrint]);

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center">
                <div className="animate-spin h-10 w-10 border-4 border-orange-500 border-t-transparent rounded-full mb-4"></div>
                <p className="text-gray-600 font-medium">กำลังโหลดแบบฟอร์มใบเสร็จ...</p>
            </div>
        );
    }
    
    if (!txn) {
        return (
            <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center">
                <FileText size={48} className="text-gray-400 mb-4" />
                <p className="text-xl font-bold text-gray-700 mb-6">ไม่พบรายการบิลนี้</p>
                <Link href={`${routeBase}/home`} className="px-6 py-3 bg-orange-500 text-white rounded-xl font-bold flex items-center gap-2">
                    <Home size={20} /> กลับไปหน้าแรก
                </Link>
            </div>
        );
    }

    const docNo = `${txn.billBookNo || '00'}/${txn.billNo || '000'}`;

    return (
        <>
            <style jsx global>{`
                @media print {
                    @page { 
                        size: ${paperWidthMm}mm 297mm; /* Ensure continuous roll length logic */
                        margin: 0; 
                    }
                    body { 
                        margin: 0; 
                        padding: 0; 
                        background-color: white;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    .no-print { display: none !important; }
                    /* Make sure scaling doesn't truncate the receipt */
                    .receipt-container { 
                        width: ${paperWidthMm}mm !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        background: none !important;
                    }
                    .receipt {
                        width: ${printableWidthMm}mm !important;
                        margin-left: auto !important;
                        margin-right: auto !important;
                    }
                    /* Force page breaks properly if multiple receipts */
                    .receipt-item {
                        page-break-after: always;
                    }
                    .receipt-item:last-child { 
                        page-break-after: auto; 
                    }
                }
            `}</style>

            {/* Floating Action Menu Data (Desktop/Mobile Non-Print View) */}
            <div className="no-print fixed top-0 left-0 right-0 bg-white/90 backdrop-blur-md shadow-sm z-50 p-3 flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center sm:px-6">
                <div className="flex flex-wrap gap-2">
                    <button onClick={() => window.history.back()} className="p-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg flex items-center gap-1 font-medium transition-colors">
                        <ArrowLeft size={18} /> <span className="hidden sm:inline">ย้อนกลับ</span>
                    </button>
                    <Link href={`${routeBase}/sell`} className="p-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg flex items-center gap-1 font-medium transition-colors">
                        <FileText size={18} /> <span className="hidden sm:inline">ไปหน้าขายน้ำมัน</span>
                    </Link>
                    <Link href={`${routeBase}/home`} className="p-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg flex items-center gap-1 font-medium transition-colors">
                        <Home size={18} /> <span className="hidden sm:inline">หน้าแรก</span>
                    </Link>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex rounded-xl bg-gray-100 p-1">
                        <button
                            type="button"
                            onClick={() => setDocType('receipt')}
                            className={`rounded-lg px-3 py-1.5 text-sm font-bold transition-all ${docType === 'receipt' ? 'bg-white text-orange-600 shadow' : 'text-gray-500'}`}
                        >
                            ใบเสร็จ
                        </button>
                        <button
                            type="button"
                            onClick={() => setDocType('credit')}
                            className={`rounded-lg px-3 py-1.5 text-sm font-bold transition-all ${docType === 'credit' ? 'bg-white text-orange-600 shadow' : 'text-gray-500'}`}
                        >
                            บิลเงินเชื่อ
                        </button>
                    </div>
                    <div className="flex rounded-xl bg-gray-100 p-1">
                        <button
                            type="button"
                            onClick={() => setPaperSize('58')}
                            className={`rounded-lg px-3 py-1.5 text-sm font-bold transition-all ${paperSize === '58' ? 'bg-white text-blue-600 shadow' : 'text-gray-500'}`}
                        >
                            58mm
                        </button>
                        <button
                            type="button"
                            onClick={() => setPaperSize('80')}
                            className={`rounded-lg px-3 py-1.5 text-sm font-bold transition-all ${paperSize === '80' ? 'bg-white text-blue-600 shadow' : 'text-gray-500'}`}
                        >
                            80mm
                        </button>
                    </div>
                    <div className="text-xs font-medium text-gray-500">
                        โปรไฟล์: {PRINTER_PROFILE.model} • แนะนำ 80mm
                    </div>
                    <button
                        onClick={() => window.print()}
                        className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-md rounded-lg font-bold flex items-center gap-2 transform active:scale-95 transition-all"
                    >
                        <Printer size={18} /> {autoPrint ? 'พิมพ์ซ้ำ' : 'พิมพ์บิล'}
                    </button>
                </div>
            </div>

            {/* Receipt Preview Area */}
            <div className="min-h-screen bg-gray-200 flex flex-col items-center pt-44 sm:pt-24 pb-12 gap-6">
                {autoPrint && (
                    <div className="no-print bg-blue-100 text-blue-800 px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 mb-2">
                        <Printer size={16} />
                        {autoPrintStarted
                            ? 'พิมพ์อัตโนมัติแล้ว ถ้าต้องการออกบิลซ้ำให้กด “พิมพ์ซ้ำ” ด้านบนได้'
                            : 'กำลังเริ่มพิมพ์บิลอัตโนมัติ...'}
                    </div>
                )}
                
                {/* ต้นฉบับ (Original) */}
                <div className="receipt-container receipt-item bg-white shadow-xl rounded-sm">
                    <ReceiptContent txn={txn} config={config} docNo={docNo} copyType="ต้นฉบับ" docType={docType} paperSize={paperSize} />
                </div>

                {/* Separator for screen view */}
                <div className="no-print flex items-center gap-2 text-gray-400 font-medium text-sm w-full max-w-xs">
                    <div className="h-px bg-gray-300 flex-1"></div>
                    <span className="shrink-0 text-xl font-mono">✂️ ตัดกระดาษ</span>
                    <div className="h-px bg-gray-300 flex-1"></div>
                </div>

                {/* สำเนา (Copy) */}
                <div className="receipt-container receipt-item bg-white shadow-xl rounded-sm">
                    <ReceiptContent txn={txn} config={config} docNo={docNo} copyType="สำเนา" docType={docType} paperSize={paperSize} />
                </div>
            </div>
        </>
    );
}
