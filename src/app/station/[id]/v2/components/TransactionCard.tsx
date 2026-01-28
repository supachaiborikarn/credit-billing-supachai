'use client';

import { useState } from 'react';
import { Edit, Trash2, Lock, Image as ImageIcon, X } from 'lucide-react';
import { PAYMENT_TYPES } from '@/constants';

interface Transaction {
    id: string;
    date: string;
    licensePlate: string;
    ownerName: string;
    ownerCode?: string | null;
    paymentType: string;
    nozzleNumber: number;
    liters: number;
    pricePerLiter: number;
    amount: number;
    billBookNo?: string;
    billNo?: string;
    recordedByName?: string;
    transferProofUrl?: string | null;
}

interface TransactionCardProps {
    transaction: Transaction;
    onEdit: () => void;
    onDelete: () => void;
    showActions?: boolean;
    isLocked?: boolean;
}

export default function TransactionCard({
    transaction,
    onEdit,
    onDelete,
    showActions = false,
    isLocked = false,
}: TransactionCardProps) {
    const [showImageModal, setShowImageModal] = useState(false);

    const paymentConfig = PAYMENT_TYPES.find(p => p.value === transaction.paymentType);
    const paymentLabel = paymentConfig?.label || transaction.paymentType;
    const paymentColor = paymentConfig?.color || 'bg-gray-500';

    const isTransfer = transaction.paymentType === 'TRANSFER';
    const hasTransferProof = !!transaction.transferProofUrl;

    const formatCurrency = (num: number) =>
        new Intl.NumberFormat('th-TH', {
            style: 'currency',
            currency: 'THB',
            maximumFractionDigits: 0,
        }).format(num);

    const formatNumber = (num: number) =>
        new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 }).format(num);

    const formatTime = (dateStr: string) =>
        new Date(dateStr).toLocaleTimeString('th-TH', {
            hour: '2-digit',
            minute: '2-digit',
        });

    const handleDelete = async () => {
        if (isLocked) {
            alert('ไม่สามารถลบได้ วันนี้ปิดแล้ว');
            return;
        }
        if (!confirm('ต้องการลบรายการนี้?')) return;

        try {
            const res = await fetch(`/api/station/transactions/${transaction.id}`, {
                method: 'DELETE',
            });
            if (res.ok) {
                onDelete();
            } else {
                alert('ลบไม่สำเร็จ');
            }
        } catch {
            alert('เกิดข้อผิดพลาด');
        }
    };

    return (
        <>
            <div className={`bg-white rounded-xl p-4 shadow-sm ${isLocked ? 'opacity-90' : ''}`}>
                <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                        {/* Header: License + Owner Code */}
                        <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-gray-800 truncate">
                                {transaction.licensePlate || '-'}
                            </span>
                            {transaction.ownerCode && (
                                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-medium">
                                    {transaction.ownerCode}
                                </span>
                            )}
                            {isLocked && (
                                <Lock size={12} className="text-gray-400" />
                            )}
                        </div>

                        {/* Owner Name */}
                        <p className="text-sm text-gray-500 truncate">{transaction.ownerName || '-'}</p>

                        {/* Details Row */}
                        <div className="flex items-center gap-3 mt-2 text-sm">
                            <span className="text-gray-400">หัว {transaction.nozzleNumber}</span>
                            <span className="text-blue-600 font-medium">
                                {formatNumber(transaction.liters)} ลิตร
                            </span>
                            <span className="text-gray-400">@{transaction.pricePerLiter}</span>
                        </div>

                        {/* Time & Bill */}
                        <p className="text-xs text-gray-400 mt-1">
                            {formatTime(transaction.date)}
                            {transaction.billBookNo && transaction.billNo && (
                                <span> • เล่ม {transaction.billBookNo}/{transaction.billNo}</span>
                            )}
                            {transaction.recordedByName && (
                                <span> • {transaction.recordedByName}</span>
                            )}
                        </p>
                    </div>

                    {/* Amount + Payment Badge */}
                    <div className="text-right ml-3">
                        <p className="text-lg font-bold text-green-600">
                            {formatCurrency(transaction.amount)}
                        </p>
                        <span
                            className={`text-xs px-2 py-0.5 rounded-full text-white ${paymentColor}`}
                        >
                            {paymentLabel}
                        </span>
                    </div>
                </div>

                {/* Transfer Image Button - Show for TRANSFER type */}
                {isTransfer && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                        {hasTransferProof ? (
                            <button
                                onClick={() => setShowImageModal(true)}
                                className="flex items-center gap-2 text-sm bg-blue-50 text-blue-600 px-3 py-2 rounded-lg hover:bg-blue-100 transition"
                            >
                                <ImageIcon size={16} />
                                <span>ดูหลักฐานการโอน</span>
                            </button>
                        ) : (
                            <span className="flex items-center gap-2 text-sm text-orange-500">
                                <ImageIcon size={16} />
                                <span>ไม่มีหลักฐานการโอน</span>
                            </span>
                        )}
                    </div>
                )}

                {/* Action Buttons */}
                {showActions && !isLocked && (
                    <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-gray-100">
                        <button
                            onClick={onEdit}
                            className="p-2 text-gray-400 hover:text-blue-500 transition"
                        >
                            <Edit size={18} />
                        </button>
                        <button
                            onClick={handleDelete}
                            className="p-2 text-gray-400 hover:text-red-500 transition"
                        >
                            <Trash2 size={18} />
                        </button>
                    </div>
                )}

                {/* Locked indicator for actions */}
                {showActions && isLocked && (
                    <div className="flex justify-end items-center gap-2 mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400">
                        <Lock size={12} />
                        <span>ล็อคแล้ว</span>
                    </div>
                )}
            </div>

            {/* Image Modal */}
            {showImageModal && hasTransferProof && (
                <div
                    className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
                    onClick={() => setShowImageModal(false)}
                >
                    <div className="relative max-w-lg w-full" onClick={e => e.stopPropagation()}>
                        <button
                            onClick={() => setShowImageModal(false)}
                            className="absolute -top-12 right-0 p-2 text-white hover:text-gray-300 transition"
                        >
                            <X size={28} />
                        </button>
                        <div className="bg-white rounded-xl overflow-hidden">
                            <div className="p-3 bg-blue-50 border-b border-blue-100">
                                <h3 className="font-bold text-blue-800 text-center">
                                    หลักฐานการโอนเงิน
                                </h3>
                                <p className="text-xs text-blue-600 text-center mt-1">
                                    {transaction.licensePlate} • {formatCurrency(transaction.amount)}
                                </p>
                            </div>
                            <img
                                src={transaction.transferProofUrl!}
                                alt="หลักฐานการโอน"
                                className="w-full max-h-[70vh] object-contain"
                            />
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
