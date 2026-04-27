'use client';

import { useState } from 'react';
import { Edit, Trash2, Lock, Image as ImageIcon, X, Printer, FileText } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { PAYMENT_TYPES } from '@/constants';
import ConfirmModal from '@/components/ConfirmModal';

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
    transferSlipUrl?: string | null;
    slipUrl?: string | null;
    proofUrl?: string | null;
    paymentProofUrl?: string | null;
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
    const pathname = usePathname();
    const [showImageModal, setShowImageModal] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const paymentConfig = PAYMENT_TYPES.find(p => p.value === transaction.paymentType);
    const paymentLabel = paymentConfig?.label || transaction.paymentType;
    const paymentColor = paymentConfig?.color || 'bg-gray-500';

    const transferProofUrl =
        transaction.transferProofUrl ||
        transaction.transferSlipUrl ||
        transaction.slipUrl ||
        transaction.proofUrl ||
        transaction.paymentProofUrl ||
        null;
    const hasTransferProof = !!transferProofUrl;
    const isTransfer = transaction.paymentType === 'TRANSFER' || hasTransferProof;
    const stationId = pathname.match(/^\/station\/(\d+)/)?.[1] || '1';

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

    const handleDeleteClick = () => {
        if (isLocked) {
            alert('ไม่สามารถลบได้ วันนี้ปิดแล้ว');
            return;
        }
        setShowDeleteConfirm(true);
    };

    const handleConfirmDelete = async () => {
        setDeleting(true);
        try {
            const res = await fetch(`/api/station/transactions/${transaction.id}`, {
                method: 'DELETE',
            });
            if (res.ok) {
                setShowDeleteConfirm(false);
                onDelete();
            } else {
                alert('ลบไม่สำเร็จ');
            }
        } catch {
            alert('เกิดข้อผิดพลาด');
        } finally {
            setDeleting(false);
        }
    };

    const openPrintableDocument = (docType: 'receipt' | 'credit', paper: '58' | '80') => {
        const params = new URLSearchParams({
            txn: transaction.id,
            docType,
            paper,
            autoPrint: 'true',
        });
        window.open(`/station/${stationId}/new/receipt?${params.toString()}`, '_blank');
        setShowPrintModal(false);
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

                {/* Transfer status - the actual view action is in the action row for consistency. */}
                {isTransfer && !hasTransferProof && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                        <span className="flex items-center gap-2 text-sm text-orange-500">
                            <ImageIcon size={16} />
                            <span>ไม่มีหลักฐานการโอน</span>
                        </span>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-gray-100">
                    {hasTransferProof && (
                        <button
                            onClick={() => setShowImageModal(true)}
                            className="flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-600 transition hover:bg-blue-100"
                            title="ดูสลิปโอนเงิน"
                        >
                            <ImageIcon size={18} />
                            <span>ดูสลิป</span>
                        </button>
                    )}
                    <button
                        onClick={() => setShowPrintModal(true)}
                        className="flex items-center gap-1.5 rounded-lg bg-orange-50 px-3 py-2 text-sm font-semibold text-orange-600 transition hover:bg-orange-100"
                        title="พิมพ์ใบเสร็จ/บิล"
                    >
                        <Printer size={18} />
                        <span>พิมพ์</span>
                    </button>
                    {showActions && !isLocked && (
                        <>
                            <button
                                onClick={onEdit}
                                className="p-2 text-gray-400 hover:text-blue-500 transition"
                            >
                                <Edit size={18} />
                            </button>
                            <button
                                onClick={handleDeleteClick}
                                className="p-2 text-gray-400 hover:text-red-500 transition"
                            >
                                <Trash2 size={18} />
                            </button>
                        </>
                    )}

                    {/* Locked indicator for actions */}
                    {showActions && isLocked && (
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                            <Lock size={12} />
                            <span>ล็อคแล้ว</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Print Modal */}
            {showPrintModal && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                    onClick={() => setShowPrintModal(false)}
                >
                    <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl" onClick={e => e.stopPropagation()}>
                        <div className="mb-4 flex items-center justify-between">
                            <div>
                                <h3 className="font-bold text-gray-900">พิมพ์เอกสารรายการนี้</h3>
                                <p className="text-xs text-gray-500">
                                    {transaction.licensePlate || 'ไม่ระบุ'} • {formatCurrency(transaction.amount)}
                                </p>
                            </div>
                            <button
                                onClick={() => setShowPrintModal(false)}
                                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
                                    <Printer size={16} className="text-orange-500" />
                                    ใบเสร็จรับเงิน
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <button onClick={() => openPrintableDocument('receipt', '58')} className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-3 text-sm font-bold text-orange-700 hover:bg-orange-100">
                                        58 มม.
                                    </button>
                                    <button onClick={() => openPrintableDocument('receipt', '80')} className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-3 text-sm font-bold text-orange-700 hover:bg-orange-100">
                                        80 มม.
                                    </button>
                                </div>
                            </div>

                            <div>
                                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
                                    <FileText size={16} className="text-blue-500" />
                                    บิลเงินเชื่อ
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <button onClick={() => openPrintableDocument('credit', '58')} className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-3 text-sm font-bold text-blue-700 hover:bg-blue-100">
                                        58 มม.
                                    </button>
                                    <button onClick={() => openPrintableDocument('credit', '80')} className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-3 text-sm font-bold text-blue-700 hover:bg-blue-100">
                                        80 มม.
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Image Modal */}
            {showImageModal && transferProofUrl && (
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
                                src={transferProofUrl}
                                alt="หลักฐานการโอน"
                                className="w-full max-h-[70vh] object-contain"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            <ConfirmModal
                isOpen={showDeleteConfirm}
                title="ยืนยันการลบรายการ"
                message={`ต้องการลบรายการเติมน้ำมัน ${transaction.licensePlate || 'รายการนี้'} จำนวน ${formatCurrency(transaction.amount)} หรือไม่? การลบไม่สามารถย้อนกลับได้`}
                confirmText="ลบรายการ"
                cancelText="ยกเลิก"
                variant="danger"
                onConfirm={handleConfirmDelete}
                onCancel={() => setShowDeleteConfirm(false)}
                loading={deleting}
            />
        </>
    );
}
