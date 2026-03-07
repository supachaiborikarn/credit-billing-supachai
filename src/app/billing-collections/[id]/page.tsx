'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Breadcrumb from '@/components/Breadcrumb';
import { LoadingState } from '@/components/Spinner';
import { formatCurrency } from '@/utils/format';
import { BillingCollection } from '@/types';
import {
    Receipt, ArrowLeft, CheckCircle, XCircle, Clock, Upload,
    Image as ImageIcon, Trash2, Calendar, FileText, AlertTriangle
} from 'lucide-react';

export default function BillingCollectionDetailPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;
    const [loading, setLoading] = useState(true);
    const [collection, setCollection] = useState<BillingCollection | null>(null);
    const [mounted, setMounted] = useState(false);

    // Upload slip state
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [slipFile, setSlipFile] = useState<File | null>(null);
    const [slipPreview, setSlipPreview] = useState('');
    const [slipAmount, setSlipAmount] = useState('');
    const [slipTransferDate, setSlipTransferDate] = useState('');
    const [slipSenderName, setSlipSenderName] = useState('');
    const [slipBankName, setSlipBankName] = useState('');
    const [slipNotes, setSlipNotes] = useState('');
    const [uploading, setUploading] = useState(false);

    // Lightbox for viewing slip images
    const [lightboxUrl, setLightboxUrl] = useState('');

    useEffect(() => {
        setMounted(true);
        if (id) fetchCollection();
    }, [id]);

    const fetchCollection = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/billing-collections/${id}`);
            if (res.ok) {
                const data = await res.json();
                setCollection(data);
            }
        } catch (error) {
            console.error('Error fetching collection:', error);
        } finally {
            setLoading(false);
        }
    }, [id]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSlipFile(file);
            const reader = new FileReader();
            reader.onload = (ev) => setSlipPreview(ev.target?.result as string);
            reader.readAsDataURL(file);
        }
    };

    const handleUploadSlip = async () => {
        if (!slipFile || !slipAmount) {
            alert('กรุณาเลือกรูปสลิปและกรอกยอดเงิน');
            return;
        }

        setUploading(true);
        try {
            // 1. Upload image to Cloudinary
            const formData = new FormData();
            formData.append('file', slipFile);
            const uploadRes = await fetch('/api/upload/transfer-proof', {
                method: 'POST',
                body: formData,
            });

            if (!uploadRes.ok) {
                alert('อัพโหลดรูปไม่สำเร็จ');
                return;
            }
            const uploadData = await uploadRes.json();

            // 2. Create payment slip
            const res = await fetch(`/api/billing-collections/${id}/payment-slips`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    slipImageUrl: uploadData.url,
                    amount: parseFloat(slipAmount),
                    transferDate: slipTransferDate || undefined,
                    senderName: slipSenderName || undefined,
                    bankName: slipBankName || undefined,
                    notes: slipNotes || undefined,
                }),
            });

            if (res.ok) {
                alert('✅ อัพโหลดสลิปเรียบร้อย');
                resetUploadForm();
                setShowUploadModal(false);
                fetchCollection();
            } else {
                const err = await res.json();
                alert(err.error || 'เกิดข้อผิดพลาด');
            }
        } catch (error) {
            console.error('Error uploading slip:', error);
            alert('เกิดข้อผิดพลาด');
        } finally {
            setUploading(false);
        }
    };

    const handleVerifySlip = async (slipId: string, status: 'VERIFIED' | 'REJECTED') => {
        const action = status === 'VERIFIED' ? 'ยืนยัน' : 'ปฏิเสธ';
        if (!confirm(`ต้องการ${action}สลิปนี้ใช่หรือไม่?`)) return;

        try {
            const res = await fetch(`/api/billing-collections/${id}/payment-slips/${slipId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status }),
            });

            if (res.ok) {
                alert(`✅ ${action}สลิปเรียบร้อย`);
                fetchCollection();
            }
        } catch (error) {
            console.error('Error verifying slip:', error);
        }
    };

    const handleDeleteSlip = async (slipId: string) => {
        if (!confirm('ต้องการลบสลิปนี้ใช่หรือไม่?')) return;

        try {
            const res = await fetch(`/api/billing-collections/${id}/payment-slips/${slipId}`, {
                method: 'DELETE',
            });
            if (res.ok) {
                alert('✅ ลบสลิปเรียบร้อย');
                fetchCollection();
            }
        } catch (error) {
            console.error('Error deleting slip:', error);
        }
    };

    const resetUploadForm = () => {
        setSlipFile(null);
        setSlipPreview('');
        setSlipAmount('');
        setSlipTransferDate('');
        setSlipSenderName('');
        setSlipBankName('');
        setSlipNotes('');
    };

    const getSlipStatusBadge = (status: string) => {
        switch (status) {
            case 'VERIFIED': return 'badge-green';
            case 'REJECTED': return 'badge-red';
            default: return 'badge-orange';
        }
    };

    const getSlipStatusLabel = (status: string) => {
        switch (status) {
            case 'VERIFIED': return '✅ ยืนยันแล้ว';
            case 'REJECTED': return '❌ ปฏิเสธ';
            default: return '⏳ รอตรวจสอบ';
        }
    };

    if (loading) return <Sidebar><LoadingState /></Sidebar>;
    if (!collection) return <Sidebar><div className="p-8 text-center text-gray-400">ไม่พบใบวางบิลรวม</div></Sidebar>;

    const remaining = Number(collection.totalAmount) - Number(collection.paidAmount);
    const progressPercent = Number(collection.totalAmount) > 0
        ? Math.min((Number(collection.paidAmount) / Number(collection.totalAmount)) * 100, 100)
        : 0;

    return (
        <Sidebar>
            <div className={`max-w-5xl mx-auto p-4 lg:p-6 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
                <Breadcrumb items={[
                    { label: 'ใบวางบิลรวม', href: '/billing-collections' },
                    { label: collection.collectionNo }
                ]} className="mb-4" />

                {/* Back button */}
                <button onClick={() => router.push('/billing-collections')} className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors">
                    <ArrowLeft size={18} /> กลับ
                </button>

                {/* Header Card */}
                <div className="glass-card p-6 mb-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-3 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500">
                                <Receipt className="text-white" size={28} />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-white">{collection.collectionNo}</h1>
                                <p className="text-gray-400">{collection.ownerName}</p>
                            </div>
                        </div>
                        <div className={`badge text-lg px-4 py-2 ${collection.status === 'PAID' ? 'badge-green' :
                                collection.status === 'PARTIAL' ? 'badge-orange' :
                                    collection.status === 'OVERDUE' ? 'badge-red' : 'badge-purple'
                            }`}>
                            {collection.status === 'PAID' ? 'ชำระแล้ว' :
                                collection.status === 'PARTIAL' ? 'ชำระบางส่วน' :
                                    collection.status === 'OVERDUE' ? 'เกินกำหนด' : 'รอชำระ'}
                        </div>
                    </div>

                    {/* Period Info */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <div>
                            <p className="text-xs text-gray-500 mb-1">ช่วงเวลา</p>
                            <p className="text-white flex items-center gap-1">
                                <Calendar size={14} className="text-emerald-400" />
                                {collection.periodLabel || `${new Date(collection.periodStart).toLocaleDateString('th-TH')} - ${new Date(collection.periodEnd).toLocaleDateString('th-TH')}`}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 mb-1">ครบกำหนด</p>
                            <p className="text-white">{collection.dueDate ? new Date(collection.dueDate).toLocaleDateString('th-TH') : '-'}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 mb-1">สร้างเมื่อ</p>
                            <p className="text-white">{new Date(collection.createdAt).toLocaleDateString('th-TH')}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 mb-1">หมายเหตุ</p>
                            <p className="text-white">{collection.notes || '-'}</p>
                        </div>
                    </div>

                    {/* Payment Progress Bar */}
                    <div className="bg-white/5 rounded-xl p-4">
                        <div className="flex justify-between mb-2">
                            <span className="text-sm text-gray-400">ชำระแล้ว {formatCurrency(collection.paidAmount)} / {formatCurrency(collection.totalAmount)}</span>
                            <span className="text-sm font-mono text-red-400">คงเหลือ {formatCurrency(remaining)}</span>
                        </div>
                        <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden">
                            <div
                                className="h-full rounded-full transition-all duration-700 bg-gradient-to-r from-emerald-500 to-teal-500"
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>
                        <p className="text-right text-xs text-gray-500 mt-1">{progressPercent.toFixed(1)}%</p>
                    </div>
                </div>

                {/* Items Table */}
                <div className="glass-card p-6 mb-6">
                    <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <FileText size={20} className="text-emerald-400" />
                        รายการบิล ({collection.items?.length || 0} รายการ)
                    </h2>
                    <div className="overflow-x-auto">
                        <table className="table-glass">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>รายละเอียด</th>
                                    <th>สถานี</th>
                                    <th>เลขที่บิล</th>
                                    <th>ยอดเงิน</th>
                                </tr>
                            </thead>
                            <tbody>
                                {collection.items?.map((item, idx) => (
                                    <tr key={item.id}>
                                        <td className="text-gray-500">{idx + 1}</td>
                                        <td className="text-white">{item.sourceDescription}</td>
                                        <td className="text-gray-300">{item.sourceStation || '-'}</td>
                                        <td className="font-mono text-gray-400">{item.sourceInvoiceNo || '-'}</td>
                                        <td className="font-mono text-emerald-400">{formatCurrency(item.amount)}</td>
                                    </tr>
                                ))}
                                <tr className="border-t border-white/20">
                                    <td colSpan={4} className="text-right font-medium text-white">ยอดรวม</td>
                                    <td className="font-mono font-bold text-lg text-emerald-400">{formatCurrency(collection.totalAmount)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Payment Slips Section */}
                <div className="glass-card p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <ImageIcon size={20} className="text-blue-400" />
                            สลิปการชำระเงิน ({collection.paymentSlips?.length || 0})
                        </h2>
                        <button
                            onClick={() => setShowUploadModal(true)}
                            className="btn btn-primary flex items-center gap-2"
                        >
                            <Upload size={16} /> อัพโหลดสลิป
                        </button>
                    </div>

                    {(collection.paymentSlips?.length || 0) === 0 ? (
                        <div className="text-center py-8 text-gray-400">
                            <ImageIcon size={48} className="mx-auto mb-4 opacity-30" />
                            <p>ยังไม่มีสลิปการชำระเงิน</p>
                            <p className="text-sm mt-1">กดปุ่ม &quot;อัพโหลดสลิป&quot; เพื่อเพิ่มสลิป</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {collection.paymentSlips?.map((slip) => (
                                <div key={slip.id} className="bg-white/5 rounded-xl p-4 border border-white/10 hover:border-white/20 transition-all">
                                    <div className="flex gap-4">
                                        {/* Slip Image */}
                                        <div
                                            className="w-24 h-24 rounded-lg overflow-hidden bg-white/10 flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-emerald-500 transition-all"
                                            onClick={() => setLightboxUrl(slip.slipImageUrl)}
                                        >
                                            <img
                                                src={slip.slipImageUrl}
                                                alt="สลิป"
                                                className="w-full h-full object-cover"
                                            />
                                        </div>

                                        {/* Slip Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-lg font-bold font-mono text-white">
                                                    {formatCurrency(slip.amount)}
                                                </span>
                                                <span className={`badge text-xs ${getSlipStatusBadge(slip.status)}`}>
                                                    {getSlipStatusLabel(slip.status)}
                                                </span>
                                            </div>
                                            <div className="space-y-1 text-sm text-gray-400">
                                                {slip.senderName && <p>👤 {slip.senderName}</p>}
                                                {slip.bankName && <p>🏦 {slip.bankName}</p>}
                                                {slip.transferDate && <p>📅 {new Date(slip.transferDate).toLocaleDateString('th-TH')}</p>}
                                                {slip.notes && <p>📝 {slip.notes}</p>}
                                            </div>

                                            {/* Actions */}
                                            {slip.status === 'PENDING' && (
                                                <div className="flex gap-2 mt-3">
                                                    <button
                                                        onClick={() => handleVerifySlip(slip.id, 'VERIFIED')}
                                                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-400 text-sm transition-colors"
                                                    >
                                                        <CheckCircle size={14} /> ยืนยัน
                                                    </button>
                                                    <button
                                                        onClick={() => handleVerifySlip(slip.id, 'REJECTED')}
                                                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm transition-colors"
                                                    >
                                                        <XCircle size={14} /> ปฏิเสธ
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteSlip(slip.id)}
                                                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 text-sm transition-colors ml-auto"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Payment Summary */}
                    {(collection.paymentSlips?.length || 0) > 0 && (
                        <div className="mt-6 bg-gradient-to-r from-blue-900/30 to-cyan-900/30 rounded-xl p-4 border border-blue-500/20">
                            <h3 className="text-sm font-medium text-blue-300 mb-3 flex items-center gap-2">
                                <AlertTriangle size={16} />
                                สรุปเทียบยอด
                            </h3>
                            <div className="grid grid-cols-3 gap-4 text-center">
                                <div>
                                    <p className="text-xs text-gray-400">ยอดวางบิล</p>
                                    <p className="text-lg font-bold font-mono text-white">{formatCurrency(collection.totalAmount)}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-400">สลิปยืนยันแล้ว</p>
                                    <p className="text-lg font-bold font-mono text-green-400">{formatCurrency(collection.paidAmount)}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-400">คงเหลือ</p>
                                    <p className={`text-lg font-bold font-mono ${remaining <= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {formatCurrency(remaining)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Upload Slip Modal */}
            {showUploadModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="relative w-full max-w-md animate-fade-in">
                        <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-600 rounded-3xl blur-xl opacity-30" />
                        <div className="relative backdrop-blur-2xl rounded-2xl border border-white/10 p-6"
                            style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)' }}>
                            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <Upload size={20} className="text-blue-400" />
                                อัพโหลดสลิปการชำระเงิน
                            </h3>

                            {/* Image Upload */}
                            <div className="mb-4">
                                <label className="block text-sm text-gray-400 mb-2">รูปสลิป *</label>
                                {slipPreview ? (
                                    <div className="relative w-full h-48 rounded-xl overflow-hidden mb-2">
                                        <img src={slipPreview} alt="Preview" className="w-full h-full object-contain bg-white/5" />
                                        <button
                                            onClick={() => { setSlipFile(null); setSlipPreview(''); }}
                                            className="absolute top-2 right-2 p-1 rounded-lg bg-red-500/80 text-white"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ) : (
                                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-white/20 rounded-xl cursor-pointer hover:border-blue-500/50 transition-colors">
                                        <Upload size={32} className="text-gray-500 mb-2" />
                                        <span className="text-sm text-gray-400">คลิกเพื่อเลือกรูป</span>
                                        <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                                    </label>
                                )}
                            </div>

                            <div className="mb-4">
                                <label className="block text-sm text-gray-400 mb-2">ยอดเงิน (บาท) *</label>
                                <input
                                    type="number"
                                    value={slipAmount}
                                    onChange={(e) => setSlipAmount(e.target.value)}
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white font-mono text-lg focus:outline-none focus:border-blue-500/50"
                                    placeholder="0.00"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3 mb-4">
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">วันที่โอน</label>
                                    <input type="date" value={slipTransferDate} onChange={(e) => setSlipTransferDate(e.target.value)}
                                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500/50" />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">ธนาคาร</label>
                                    <input type="text" value={slipBankName} onChange={(e) => setSlipBankName(e.target.value)}
                                        placeholder="เช่น กสิกร, กรุงเทพ"
                                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500/50" />
                                </div>
                            </div>

                            <div className="mb-4">
                                <label className="block text-sm text-gray-400 mb-1">ชื่อผู้โอน</label>
                                <input type="text" value={slipSenderName} onChange={(e) => setSlipSenderName(e.target.value)}
                                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500/50" />
                            </div>

                            <div className="mb-6">
                                <label className="block text-sm text-gray-400 mb-1">หมายเหตุ</label>
                                <input type="text" value={slipNotes} onChange={(e) => setSlipNotes(e.target.value)}
                                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500/50" />
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={handleUploadSlip}
                                    disabled={uploading || !slipFile}
                                    className="flex-1 relative group px-6 py-3 rounded-xl font-semibold text-white overflow-hidden disabled:opacity-50"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-600" />
                                    <span className="relative flex items-center justify-center gap-2">
                                        <Upload size={18} />
                                        {uploading ? 'กำลังอัพโหลด...' : 'อัพโหลดสลิป'}
                                    </span>
                                </button>
                                <button
                                    onClick={() => { setShowUploadModal(false); resetUploadForm(); }}
                                    className="px-6 py-3 rounded-xl font-medium text-gray-300 bg-white/5 hover:bg-white/10 transition-colors"
                                >
                                    ยกเลิก
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Lightbox */}
            {lightboxUrl && (
                <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
                    onClick={() => setLightboxUrl('')}>
                    <img src={lightboxUrl} alt="สลิป" className="max-w-full max-h-[90vh] object-contain rounded-xl" />
                </div>
            )}
        </Sidebar>
    );
}
