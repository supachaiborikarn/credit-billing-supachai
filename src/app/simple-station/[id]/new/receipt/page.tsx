'use client';

import { useEffect, useState, use } from 'react';
import { useSearchParams } from 'next/navigation';
import { STATIONS } from '@/constants';
import Image from 'next/image';

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
        address: '172 หมู่ 1 ถ.พหลโยธิน ต.นครชุม อ.เมือง จ.กำแพงเพชร 62000',
        tel: '055-840585, 055-773003',
    },
    'station-2': {
        name: 'ศุภชัยบริการ(กำแพงเพชร)',
        address: '172 หมู่ 1 ถ.พหลโยธิน ต.นครชุม อ.เมือง จ.กำแพงเพชร 62000',
        tel: '055-840585, 055-773003',
    },
    'station-3': {
        name: 'ศุภชัยบริการ(กำแพงเพชร)',
        address: '172 หมู่ 1 ถ.พหลโยธิน ต.นครชุม อ.เมือง จ.กำแพงเพชร 62000',
        tel: '055-840585, 055-773003',
    },
    'station-4': {
        name: 'ศุภชัยบริการ(กำแพงเพชร)',
        address: '172 หมู่ 1 ถ.พหลโยธิน ต.นครชุม อ.เมือง จ.กำแพงเพชร 62000',
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
            month: 'long',
            day: 'numeric',
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
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
            </div>
        );
    }

    if (!transaction) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <p className="text-gray-600 font-medium">ไม่พบรายการ</p>
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
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    .no-print {
                        display: none !important;
                    }
                    .receipt-container {
                        width: 80mm !important;
                        max-width: 80mm !important;
                        padding: 4mm !important;
                        margin: 0 !important;
                        box-shadow: none !important;
                    }
                }
            `}</style>

            {/* Print Button (hidden when printing) */}
            <div className="no-print fixed top-4 right-4 z-50 flex gap-2">
                <button
                    onClick={() => window.history.back()}
                    className="px-4 py-3 bg-gray-500 text-white font-bold rounded-xl shadow-lg hover:bg-gray-600 transition"
                >
                    ← กลับ
                </button>
                <button
                    onClick={handlePrint}
                    className="px-6 py-3 bg-red-600 text-white font-bold rounded-xl shadow-lg hover:bg-red-700 transition flex items-center gap-2"
                >
                    🖨️ พิมพ์ใบเสร็จ
                </button>
            </div>

            {/* Receipt */}
            <div className="min-h-screen bg-gray-200 flex items-start justify-center py-8">
                <div className="receipt-container bg-white w-[80mm] shadow-2xl border border-gray-300" style={{ fontFamily: 'Tahoma, sans-serif' }}>

                    {/* Header with Red Background */}
                    <div className="bg-red-600 text-white p-3 text-center">
                        {/* Caltex Logo */}
                        <div className="flex justify-center mb-2">
                            <Image
                                src="https://upload.wikimedia.org/wikipedia/commons/thumb/7/76/Caltex_logo.svg/200px-Caltex_logo.svg.png"
                                alt="Caltex"
                                width={80}
                                height={50}
                                className="brightness-0 invert"
                                unoptimized
                            />
                        </div>
                        <div className="text-lg font-bold">{receiptConfig.name}</div>
                    </div>

                    {/* Document Title */}
                    <div className="bg-gray-900 text-white py-2 text-center">
                        <span className="text-lg font-bold tracking-wider">ใบส่งของเงินเชื่อ</span>
                    </div>

                    {/* Station Info */}
                    <div className="p-3 bg-gray-50 border-b-2 border-gray-300 text-center text-xs text-gray-700">
                        <p>{receiptConfig.address}</p>
                        <p className="font-medium">โทร: {receiptConfig.tel}</p>
                    </div>

                    {/* Receipt Details */}
                    <div className="p-3 space-y-2 text-sm text-gray-900">
                        <div className="flex justify-between border-b border-gray-200 pb-1">
                            <span className="font-medium">วันที่:</span>
                            <span className="font-bold">{formatDate(transaction.createdAt)}</span>
                        </div>
                        <div className="flex justify-between border-b border-gray-200 pb-1">
                            <span className="font-medium">เวลา:</span>
                            <span className="font-bold">{formatTime(transaction.createdAt)} น.</span>
                        </div>
                        {(transaction.billBookNo || transaction.billNo) && (
                            <div className="flex justify-between border-b border-gray-200 pb-1">
                                <span className="font-medium">เลขที่บิล:</span>
                                <span className="font-bold text-red-600">{transaction.billBookNo}/{transaction.billNo}</span>
                            </div>
                        )}
                    </div>

                    {/* Customer Info */}
                    <div className="bg-yellow-50 p-3 border-y-2 border-yellow-400">
                        <div className="text-xs text-gray-600 mb-1">ข้อมูลลูกค้า</div>
                        <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-700">ทะเบียน:</span>
                                <span className="font-bold text-lg text-gray-900">{transaction.licensePlate || '-'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-700">ชื่อ:</span>
                                <span className="font-bold text-gray-900">{transaction.ownerName || '-'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Items */}
                    <div className="p-3">
                        <div className="text-xs text-gray-600 mb-2">รายการ</div>
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b-2 border-gray-400">
                                    <th className="text-left py-1 text-gray-700">รายการ</th>
                                    <th className="text-right py-1 text-gray-700">จำนวน</th>
                                    <th className="text-right py-1 text-gray-700">ราคา</th>
                                </tr>
                            </thead>
                            <tbody>
                                {transaction.liters > 0 && (
                                    <tr className="border-b border-gray-200">
                                        <td className="py-2 font-medium text-gray-900">
                                            {FUEL_LABELS[transaction.fuelType] || transaction.fuelType}
                                            <div className="text-xs text-gray-600">@{formatCurrency(transaction.pricePerLiter)} บ./ลิตร</div>
                                        </td>
                                        <td className="py-2 text-right text-gray-900">{formatCurrency(transaction.liters)} ลิตร</td>
                                        <td className="py-2 text-right font-bold text-gray-900">{formatCurrency(transaction.liters * transaction.pricePerLiter)}</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Total */}
                    <div className="bg-red-600 text-white p-4">
                        <div className="flex justify-between items-center">
                            <span className="text-lg font-bold">รวมทั้งสิ้น</span>
                            <span className="text-2xl font-bold">{formatCurrency(transaction.amount)} ฿</span>
                        </div>
                        <div className="text-right text-xs mt-1 text-red-200">
                            ชำระ: {PAYMENT_LABELS[transaction.paymentType] || transaction.paymentType}
                        </div>
                    </div>

                    {/* Signature Area */}
                    <div className="p-3 border-b-2 border-gray-300">
                        <div className="flex justify-between text-xs text-gray-600">
                            <div className="text-center flex-1">
                                <div className="border-b border-gray-400 h-8 mb-1"></div>
                                <span>ผู้รับสินค้า</span>
                            </div>
                            <div className="w-4"></div>
                            <div className="text-center flex-1">
                                <div className="border-b border-gray-400 h-8 mb-1"></div>
                                <span>ผู้ส่งสินค้า</span>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-3 text-center bg-gray-100">
                        <div className="text-sm font-bold text-gray-800 mb-1">ขอบคุณที่ใช้บริการ</div>
                        <div className="text-xs text-gray-500">Thank you for your patronage</div>
                        <div className="text-[10px] text-gray-400 mt-2">
                            #{transaction.id.slice(-8).toUpperCase()}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
