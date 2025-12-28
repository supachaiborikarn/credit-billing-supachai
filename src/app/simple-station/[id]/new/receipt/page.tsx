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

// Station receipt configs
const RECEIPT_CONFIG: Record<string, {
    name: string;
    address: string;
    tel: string;
}> = {
    'station-1': {
        name: 'ศุภชัยบริการ(กำแพงเพชร)',
        address: '172 หมู่ 1 ถ.พหลโยธิน ต.นครชุม\nอ.เมือง จ.กำแพงเพชร 62000',
        tel: '055-840585, 055-773003',
    },
    'station-2': {
        name: 'ศุภชัยบริการ(กำแพงเพชร)',
        address: '172 หมู่ 1 ถ.พหลโยธิน ต.นครชุม\nอ.เมือง จ.กำแพงเพชร 62000',
        tel: '055-840585, 055-773003',
    },
    'station-3': {
        name: 'ศุภชัยบริการ(กำแพงเพชร)',
        address: '172 หมู่ 1 ถ.พหลโยธิน ต.นครชุม\nอ.เมือง จ.กำแพงเพชร 62000',
        tel: '055-840585, 055-773003',
    },
    'station-4': {
        name: 'ศุภชัยบริการ(กำแพงเพชร)',
        address: '172 หมู่ 1 ถ.พหลโยธิน ต.นครชุม\nอ.เมือง จ.กำแพงเพชร 62000',
        tel: '055-840585, 055-773003',
    },
};

const PAYMENT_LABELS: Record<string, string> = {
    CASH: 'เงินสด',
    CREDIT: 'เงินเชื่อ',
    TRANSFER: 'โอนเงิน',
    BOX_TRUCK: 'รถตู้ทับ',
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

    const stationIndex = parseInt(id) - 1;
    const station = STATIONS[stationIndex];
    const receiptConfig = RECEIPT_CONFIG[stationId] || RECEIPT_CONFIG['station-1'];

    const [transaction, setTransaction] = useState<Transaction | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTransaction = async () => {
            if (!transactionId) {
                setLoading(false);
                return;
            }

            try {
                const res = await fetch(`/api/station/${id}/transactions/${transactionId}`);
                if (res.ok) {
                    const data = await res.json();
                    setTransaction(data);
                }
            } catch (error) {
                console.error('Error fetching transaction:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchTransaction();
    }, [id, transactionId]);

    const formatCurrency = (num: number) =>
        new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2 }).format(num);

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('th-TH', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        });
    };

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleTimeString('th-TH', {
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const handlePrint = () => {
        window.print();
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
            </div>
        );
    }

    if (!transaction) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <p className="text-gray-500">ไม่พบรายการ</p>
            </div>
        );
    }

    return (
        <>
            {/* Print Styles */}
            <style jsx global>{`
                @media print {
                    @page {
                        size: 80mm auto;
                        margin: 0;
                    }
                    body {
                        margin: 0;
                        padding: 0;
                    }
                    .no-print {
                        display: none !important;
                    }
                    .receipt-container {
                        width: 80mm !important;
                        max-width: 80mm !important;
                        padding: 3mm !important;
                        margin: 0 !important;
                        box-shadow: none !important;
                        border: none !important;
                    }
                }
            `}</style>

            {/* Print Button (hidden when printing) */}
            <div className="no-print fixed top-4 right-4 z-50">
                <button
                    onClick={handlePrint}
                    className="px-6 py-3 bg-orange-500 text-white font-bold rounded-xl shadow-lg hover:bg-orange-600 transition flex items-center gap-2"
                >
                    🖨️ พิมพ์ใบเสร็จ
                </button>
            </div>

            {/* Receipt */}
            <div className="min-h-screen bg-gray-100 flex items-start justify-center py-8 no-print:py-8">
                <div className="receipt-container bg-white w-[80mm] p-4 shadow-lg font-mono text-sm" style={{ fontFamily: 'monospace' }}>

                    {/* Header */}
                    <div className="text-center mb-3">
                        <div className="text-lg font-bold border-2 border-black py-1 mb-2">
                            ใบส่งของเงินเชื่อ
                        </div>
                        {/* Caltex Logo */}
                        <div className="flex justify-center mb-2">
                            <svg width="80" height="40" viewBox="0 0 200 100" className="mx-auto">
                                <circle cx="100" cy="50" r="45" fill="#E31937" />
                                <polygon points="100,15 110,45 145,45 115,65 125,95 100,75 75,95 85,65 55,45 90,45" fill="white" />
                            </svg>
                        </div>
                        <div className="text-base font-bold mb-1">Caltex</div>
                        <div className="text-lg font-bold mb-1">{receiptConfig.name}</div>
                        <div className="text-xs whitespace-pre-line text-gray-600">
                            {receiptConfig.address}
                        </div>
                        <div className="text-xs text-gray-600">
                            โทร: {receiptConfig.tel}
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="border-t-2 border-dashed border-gray-400 my-2"></div>

                    {/* Receipt Info */}
                    <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                            <span>วันที่:</span>
                            <span>{formatDate(transaction.createdAt)} {formatTime(transaction.createdAt)}</span>
                        </div>
                        {(transaction.billBookNo || transaction.billNo) && (
                            <div className="flex justify-between">
                                <span>เลขที่บิล:</span>
                                <span>{transaction.billBookNo}/{transaction.billNo}</span>
                            </div>
                        )}
                        {transaction.recordedBy?.name && (
                            <div className="flex justify-between">
                                <span>พนักงาน:</span>
                                <span>{transaction.recordedBy.name}</span>
                            </div>
                        )}
                    </div>

                    {/* Divider */}
                    <div className="border-t-2 border-dashed border-gray-400 my-2"></div>

                    {/* Customer Info */}
                    {(transaction.licensePlate || transaction.ownerName) && (
                        <>
                            <div className="space-y-1 text-xs">
                                {transaction.licensePlate && (
                                    <div className="flex justify-between">
                                        <span>ทะเบียน:</span>
                                        <span className="font-bold">{transaction.licensePlate}</span>
                                    </div>
                                )}
                                {transaction.ownerName && (
                                    <div className="flex justify-between">
                                        <span>ชื่อ:</span>
                                        <span>{transaction.ownerName}</span>
                                    </div>
                                )}
                            </div>
                            <div className="border-t border-gray-300 my-2"></div>
                        </>
                    )}

                    {/* Items */}
                    <div className="space-y-2">
                        {transaction.liters > 0 && (
                            <div>
                                <div className="flex justify-between text-xs">
                                    <span className="font-medium">{FUEL_LABELS[transaction.fuelType] || transaction.fuelType}</span>
                                    <span>{formatCurrency(transaction.liters)} ลิตร</span>
                                </div>
                                <div className="flex justify-between text-xs text-gray-500">
                                    <span>@ {formatCurrency(transaction.pricePerLiter)} บาท/ลิตร</span>
                                    <span>{formatCurrency(transaction.liters * transaction.pricePerLiter)} ฿</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Divider */}
                    <div className="border-t-2 border-double border-gray-600 my-3"></div>

                    {/* Total */}
                    <div className="flex justify-between items-center">
                        <span className="text-base font-bold">รวมทั้งสิ้น</span>
                        <span className="text-xl font-bold">{formatCurrency(transaction.amount)} ฿</span>
                    </div>

                    {/* Payment Type */}
                    <div className="flex justify-between text-xs mt-2">
                        <span>ชำระโดย:</span>
                        <span className="font-medium">{PAYMENT_LABELS[transaction.paymentType] || transaction.paymentType}</span>
                    </div>

                    {/* Divider */}
                    <div className="border-t-2 border-dashed border-gray-400 my-3"></div>

                    {/* Footer */}
                    <div className="text-center">
                        <div className="text-sm font-medium mb-2">ขอบคุณที่ใช้บริการ</div>
                        <div className="text-xs text-gray-500">Thank you for your patronage</div>
                    </div>

                    {/* Receipt ID (small) */}
                    <div className="text-center mt-3 text-[10px] text-gray-400">
                        #{transaction.id.slice(-8).toUpperCase()}
                    </div>
                </div>
            </div>
        </>
    );
}
