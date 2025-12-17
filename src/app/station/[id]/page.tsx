'use client';

import { useState, useEffect, use, useRef } from 'react';
import Sidebar from '@/components/Sidebar';
import BillEntryForm from '@/components/BillEntryForm';
import ConfirmDialog from '@/components/ConfirmDialog';
import {
    Calendar,
    Save,
    Camera,
    Fuel,
    Clock,
    AlertTriangle,
    CheckCircle,
    Filter,
    User,
    Phone,
    Plus,
    FileText,
    Printer,
    X,
    Sparkles,
    Edit,
    Trash2,
    List,
    BarChart3,
    PenLine,
    Gauge
} from 'lucide-react';
import { PAYMENT_TYPES, DEFAULT_RETAIL_PRICE, DEFAULT_WHOLESALE_PRICE, STATIONS } from '@/constants';

interface DailyRecord {
    id: string;
    date: string;
    retailPrice: number;
    wholesalePrice: number;
    status: string;
    meters: MeterReading[];
}

interface MeterReading {
    nozzleNumber: number;
    startReading: number;
    endReading: number | null;
}

interface Transaction {
    id: string;
    date: string;
    licensePlate: string;
    ownerName: string;
    paymentType: string;
    nozzleNumber: number;
    liters: number;
    pricePerLiter: number;
    amount: number;
    billBookNo?: string;
    billNo?: string;
    recordedByName?: string;
}

interface TruckSearchResult {
    id: string;
    licensePlate: string;
    ownerId: string;
    ownerName: string;
    ownerCode: string | null;
    ownerPhone: string | null;
    ownerGroup: string;
}

export default function StationPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const stationIndex = parseInt(id) - 1;
    const station = STATIONS[stationIndex];
    const isFullStation = station?.type === 'FULL';

    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [dailyRecord, setDailyRecord] = useState<DailyRecord | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [activeFilter, setActiveFilter] = useState('all');

    // Mobile tab navigation: 'record' | 'list' | 'meter' | 'summary'
    const [activeTab, setActiveTab] = useState<'record' | 'list' | 'meter' | 'summary'>('record');
    const [isMobile, setIsMobile] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [currentUser, setCurrentUser] = useState<{ role: string } | null>(null);

    // Detect mobile screen - runs after mount to avoid SSR issues
    useEffect(() => {
        setMounted(true);
        const checkMobile = () => setIsMobile(window.innerWidth <= 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Fetch current user role
    useEffect(() => {
        const fetchCurrentUser = async () => {
            try {
                const res = await fetch('/api/auth/me');
                if (res.ok) {
                    const data = await res.json();
                    setCurrentUser(data.user);
                }
            } catch (error) {
                console.error('Error fetching user:', error);
            }
        };
        fetchCurrentUser();
    }, []);

    // Helper: determines if section should be visible based on tab
    // Before mount, show all sections to avoid flash. After mount, use tab logic on mobile.
    const showSection = (tab: 'record' | 'list' | 'meter' | 'summary') => {
        if (!mounted) return true; // Before mount, show all (SSR safe)
        if (!isMobile) return true; // Desktop shows all
        return activeTab === tab;
    };

    // Form states for FULL station
    const [retailPrice, setRetailPrice] = useState(DEFAULT_RETAIL_PRICE);
    const [wholesalePrice, setWholesalePrice] = useState(DEFAULT_WHOLESALE_PRICE);
    const [meters, setMeters] = useState<{ nozzle: number; start: number; end: number; startPhoto?: string; endPhoto?: string }[]>([
        { nozzle: 1, start: 0, end: 0 },
        { nozzle: 2, start: 0, end: 0 },
        { nozzle: 3, start: 0, end: 0 },
        { nozzle: 4, start: 0, end: 0 },
    ]);

    // Transaction form
    const [showForm, setShowForm] = useState(false);
    const [paymentType, setPaymentType] = useState('CREDIT');
    const [licensePlate, setLicensePlate] = useState('');
    const [ownerName, setOwnerName] = useState('');
    const [ownerId, setOwnerId] = useState<string | null>(null);
    const [ownerCode, setOwnerCode] = useState<string | null>(null);
    const [ownerPhone, setOwnerPhone] = useState<string | null>(null);
    const [nozzleNumber, setNozzleNumber] = useState(1);
    const [liters, setLiters] = useState('');
    const [useSpecialPrice, setUseSpecialPrice] = useState(false);
    const [specialPrice, setSpecialPrice] = useState('');
    const [bookNo, setBookNo] = useState('');
    const [billNo, setBillNo] = useState('');
    const [transferProofUrl, setTransferProofUrl] = useState<string | null>(null);
    const [transferUploading, setTransferUploading] = useState(false);

    // License plate search
    const [searchResults, setSearchResults] = useState<TruckSearchResult[]>([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [searchLoading, setSearchLoading] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Daily summary modal
    const [showDailySummary, setShowDailySummary] = useState(false);
    const [includeTransactionsInPrint, setIncludeTransactionsInPrint] = useState(true);

    // Edit modal state
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
    const [editLicensePlate, setEditLicensePlate] = useState('');
    const [editOwnerName, setEditOwnerName] = useState('');
    const [editLiters, setEditLiters] = useState('');
    const [editPricePerLiter, setEditPricePerLiter] = useState('');
    const [editPaymentType, setEditPaymentType] = useState('');
    const [editBillBookNo, setEditBillBookNo] = useState('');
    const [editBillNo, setEditBillNo] = useState('');
    const [editSaving, setEditSaving] = useState(false);

    const [showAddTruckForm, setShowAddTruckForm] = useState(false);
    const [owners, setOwners] = useState<{ id: string; name: string; code: string | null }[]>([]);
    const [selectedOwnerId, setSelectedOwnerId] = useState('');
    const [addingTruck, setAddingTruck] = useState(false);

    // Meter continuity check
    const [previousDayMeters, setPreviousDayMeters] = useState<{ nozzle: number; endReading: number }[]>([]);
    const [meterWarnings, setMeterWarnings] = useState<string[]>([]);

    // Delete confirmation
    const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; transactionId: string | null; licensePlate: string }>({
        isOpen: false,
        transactionId: null,
        licensePlate: '',
    });
    const [deleting, setDeleting] = useState(false);

    // Duplicate bill check
    const [duplicateBillWarning, setDuplicateBillWarning] = useState<{
        exists: boolean;
        count: number;
        transactions: { id: string; date: string; licensePlate: string; ownerName: string; amount: number }[];
    } | null>(null);
    const [checkingBill, setCheckingBill] = useState(false);

    useEffect(() => {
        if (station) {
            fetchDailyData();
        }
    }, [selectedDate, station]);

    // Search license plates
    useEffect(() => {
        const searchTrucks = async () => {
            if (licensePlate.length < 2) {
                setSearchResults([]);
                setShowDropdown(false);
                return;
            }

            setSearchLoading(true);
            try {
                const res = await fetch(`/api/trucks/search?q=${encodeURIComponent(licensePlate)}`);
                if (res.ok) {
                    const data = await res.json();
                    setSearchResults(data);
                    // Show dropdown even if no results (to show "Add Truck" option)
                    setShowDropdown(true);
                }
            } catch (error) {
                console.error('Search error:', error);
            } finally {
                setSearchLoading(false);
            }
        };

        const debounce = setTimeout(searchTrucks, 300);
        return () => clearTimeout(debounce);
    }, [licensePlate]);

    // Click outside to close dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectTruck = (truck: TruckSearchResult) => {
        setLicensePlate(truck.licensePlate);
        setOwnerName(truck.ownerName);
        setOwnerId(truck.ownerId);
        setOwnerCode(truck.ownerCode);
        setOwnerPhone(truck.ownerPhone);
        setShowDropdown(false);
        setSearchResults([]);
    };

    const clearOwner = () => {
        setOwnerName('');
        setOwnerId(null);
        setOwnerCode(null);
        setOwnerPhone(null);
    };

    const fetchOwners = async () => {
        try {
            const res = await fetch('/api/owners');
            if (res.ok) {
                const data = await res.json();
                setOwners(data);
            }
        } catch (error) {
            console.error('Error fetching owners:', error);
        }
    };

    const handleAddTruck = async () => {
        if (!licensePlate || !selectedOwnerId) {
            alert('กรุณากรอกทะเบียนและเลือกเจ้าของ');
            return;
        }

        setAddingTruck(true);
        try {
            const res = await fetch('/api/trucks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    licensePlate: licensePlate.toUpperCase(),
                    ownerId: selectedOwnerId,
                }),
            });

            if (res.ok) {
                const truck = await res.json();
                // Auto-select the newly created truck
                setOwnerName(truck.owner.name);
                setOwnerId(truck.owner.id);
                setOwnerCode(truck.owner.code);
                setShowAddTruckForm(false);
                setShowDropdown(false);
                setSelectedOwnerId('');
                alert(`เพิ่มทะเบียน ${truck.licensePlate} สำเร็จ`);
            } else {
                const errorData = await res.json();
                alert(errorData.error || 'เกิดข้อผิดพลาด');
            }
        } catch (error) {
            console.error('Error adding truck:', error);
            alert('เกิดข้อผิดพลาดในการเพิ่มทะเบียน');
        } finally {
            setAddingTruck(false);
        }
    };

    const openAddTruckForm = () => {
        setShowAddTruckForm(true);
        setShowDropdown(false);
        fetchOwners();
    };


    const fetchDailyData = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/station/${id}/daily?date=${selectedDate}`);
            if (res.ok) {
                const data = await res.json();
                setDailyRecord(data.dailyRecord);
                setTransactions(data.transactions || []);

                // Store previous day meters for continuity check
                if (data.previousDayMeters) {
                    setPreviousDayMeters(data.previousDayMeters);
                }

                if (data.dailyRecord) {
                    setRetailPrice(data.dailyRecord.retailPrice);
                    setWholesalePrice(data.dailyRecord.wholesalePrice);
                    // Only update meters if API returns non-empty array
                    if (data.dailyRecord.meters && data.dailyRecord.meters.length > 0) {
                        const currentMeters = data.dailyRecord.meters.map((m: MeterReading) => ({
                            nozzle: m.nozzleNumber,
                            start: Number(m.startReading),
                            end: Number(m.endReading) || 0,
                        }));
                        setMeters(currentMeters);

                        // Check meter continuity warnings
                        if (data.previousDayMeters && data.previousDayMeters.length > 0) {
                            const warnings: string[] = [];
                            currentMeters.forEach((m: { nozzle: number; start: number }) => {
                                const prevMeter = data.previousDayMeters.find((p: { nozzle: number }) => p.nozzle === m.nozzle);
                                if (prevMeter && prevMeter.endReading > 0 && m.start !== prevMeter.endReading) {
                                    warnings.push(`หัวจ่าย ${m.nozzle}: มิเตอร์ไม่ต่อเนื่อง (เมื่อวาน: ${prevMeter.endReading.toLocaleString("th-TH", { maximumFractionDigits: 2 })}, วันนี้: ${m.start.toLocaleString("th-TH", { maximumFractionDigits: 2 })})`);
                                }
                            });
                            setMeterWarnings(warnings);
                        } else {
                            setMeterWarnings([]);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching daily data:', error);
        } finally {
            setLoading(false);
        }
    };

    // Check for duplicate bill number
    const checkDuplicateBill = async () => {
        if (!bookNo || !billNo) {
            setDuplicateBillWarning(null);
            return;
        }

        setCheckingBill(true);
        try {
            const res = await fetch(`/api/station/${id}/check-bill?bookNo=${encodeURIComponent(bookNo)}&billNo=${encodeURIComponent(billNo)}`);
            if (res.ok) {
                const data = await res.json();
                if (data.exists) {
                    setDuplicateBillWarning(data);
                } else {
                    setDuplicateBillWarning(null);
                }
            }
        } catch (error) {
            console.error('Error checking bill:', error);
        } finally {
            setCheckingBill(false);
        }
    };

    const savePriceSettings = async () => {
        try {
            const res = await fetch(`/api/station/${id}/daily`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: selectedDate,
                    retailPrice,
                    wholesalePrice,
                }),
            });
            if (res.ok) {
                alert('บันทึกราคาเรียบร้อย');
                fetchDailyData();
            }
        } catch (error) {
            console.error('Error saving price:', error);
        }
    };

    const saveMeters = async (type: 'start' | 'end') => {
        try {
            const res = await fetch(`/api/station/${id}/meters`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: selectedDate,
                    type,
                    meters: meters.map(m => ({
                        nozzleNumber: m.nozzle,
                        reading: type === 'start' ? m.start : m.end,
                    })),
                }),
            });
            if (res.ok) {
                alert(`บันทึกมิเตอร์${type === 'start' ? 'เริ่มต้น' : 'สิ้นสุด'}เรียบร้อย`);
                fetchDailyData();
            }
        } catch (error) {
            console.error('Error saving meters:', error);
        }
    };

    const calculatePrice = () => {
        if (useSpecialPrice && specialPrice) {
            return parseFloat(specialPrice);
        }
        return paymentType === 'CASH' || paymentType === 'TRANSFER' ? wholesalePrice : retailPrice;
    };

    const calculateAmount = () => {
        const price = calculatePrice();
        const qty = parseFloat(liters) || 0;
        return qty * price;
    };

    const handleTransferProofUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setTransferUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('type', 'transfer');
            formData.append('date', selectedDate);
            formData.append('stationId', `station-${id}`);

            const res = await fetch('/api/upload/meter-photo', {
                method: 'POST',
                body: formData,
            });

            if (res.ok) {
                const data = await res.json();
                setTransferProofUrl(data.url);
            } else {
                alert('อัพโหลดรูปไม่สำเร็จ');
            }
        } catch (error) {
            console.error('Upload error:', error);
        } finally {
            setTransferUploading(false);
        }
    };

    const handleSubmitTransaction = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validate transfer requires photo (except for admin entering past records)
        const isAdmin = currentUser?.role === 'ADMIN';
        if (paymentType === 'TRANSFER' && !transferProofUrl && !isAdmin) {
            alert('กรุณาแนบรูปหลักฐานการโอน');
            return;
        }

        try {
            const res = await fetch(`/api/station/${id}/transactions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: selectedDate,
                    licensePlate,
                    ownerName,
                    paymentType,
                    nozzleNumber: isFullStation ? nozzleNumber : null,
                    liters: parseFloat(liters),
                    pricePerLiter: calculatePrice(),
                    amount: calculateAmount(),
                    billBookNo: bookNo,
                    billNo: billNo,
                    productType: 'ดีเซล',
                    transferProofUrl: paymentType === 'TRANSFER' ? transferProofUrl : null,
                }),
            });

            if (res.ok) {
                alert('✅ บันทึกรายการสำเร็จ!');
                // Reset form
                setLicensePlate('');
                setOwnerName('');
                setLiters('');
                setBookNo('');
                setBillNo('');
                setTransferProofUrl(null);
                setShowForm(false);
                fetchDailyData();
            } else {
                const errorData = await res.json();
                alert(`เกิดข้อผิดพลาด: ${errorData?.error || 'ไม่สามารถบันทึกได้'}`);
                console.error('Transaction save failed:', errorData);
            }
        } catch (error) {
            console.error('Error saving transaction:', error);
            alert('เกิดข้อผิดพลาดในการเชื่อมต่อ');
        }
    };

    const filteredTransactions = transactions.filter(t => {
        if (activeFilter === 'all') return true;
        return t.paymentType === activeFilter;
    });

    // Open delete confirmation dialog
    const openDeleteConfirm = (transactionId: string, licensePlate: string) => {
        setDeleteConfirm({
            isOpen: true,
            transactionId,
            licensePlate,
        });
    };

    // Confirm delete transaction
    const confirmDeleteTransaction = async () => {
        if (!deleteConfirm.transactionId) return;

        setDeleting(true);
        try {
            const res = await fetch(`/api/station/${id}/transactions/${deleteConfirm.transactionId}`, {
                method: 'DELETE',
            });
            if (res.ok) {
                fetchDailyData();
                setDeleteConfirm({ isOpen: false, transactionId: null, licensePlate: '' });
            } else {
                alert('ลบไม่สำเร็จ');
            }
        } catch (error) {
            console.error('Delete error:', error);
        } finally {
            setDeleting(false);
        }
    };

    const openEditModal = (t: Transaction) => {
        setEditingTransaction(t);
        setEditLicensePlate(t.licensePlate || '');
        setEditOwnerName(t.ownerName || '');
        setEditLiters(String(t.liters));
        setEditPricePerLiter(String(t.pricePerLiter));
        setEditPaymentType(t.paymentType);
        setEditBillBookNo(t.billBookNo || '');
        setEditBillNo(t.billNo || '');
    };

    const handleSaveEdit = async () => {
        if (!editingTransaction) return;
        setEditSaving(true);

        try {
            const res = await fetch(`/api/station/${id}/transactions/${editingTransaction.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    licensePlate: editLicensePlate,
                    ownerName: editOwnerName,
                    liters: parseFloat(editLiters),
                    pricePerLiter: parseFloat(editPricePerLiter),
                    amount: parseFloat(editLiters) * parseFloat(editPricePerLiter),
                    paymentType: editPaymentType,
                    billBookNo: editBillBookNo,
                    billNo: editBillNo,
                }),
            });

            if (res.ok) {
                setEditingTransaction(null);
                fetchDailyData();
            } else {
                alert('บันทึกไม่สำเร็จ');
            }
        } catch (error) {
            console.error('Save error:', error);
        } finally {
            setEditSaving(false);
        }
    };

    const handlePrintTransaction = (t: Transaction) => {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(`
                <html>
                <head>
                    <title>ใบเสร็จ</title>
                    <style>
                        body { font-family: 'Sarabun', sans-serif; padding: 20px; }
                        .header { text-align: center; margin-bottom: 20px; }
                        .detail { margin: 10px 0; }
                        .amount { font-size: 24px; font-weight: bold; text-align: center; margin: 20px 0; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h2>${station?.name}</h2>
                        <p>${new Date(t.date).toLocaleDateString('th-TH')}</p>
                    </div>
                    <div class="detail">ทะเบียน: ${t.licensePlate}</div>
                    <div class="detail">ชื่อ: ${t.ownerName || '-'}</div>
                    <div class="detail">เล่ม/เลขที่: ${t.billBookNo || '-'}/${t.billNo || '-'}</div>
                    <div class="detail">ลิตร: ${t.liters}</div>
                    <div class="detail">ราคา/ลิตร: ${t.pricePerLiter}</div>
                    <div class="amount">รวม: ${Number(t.amount).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท</div>
                </body>
                </html>
            `);
            printWindow.document.close();
            printWindow.print();
        }
    };

    const meterTotal = meters.reduce((sum, m) => sum + (m.end - m.start), 0);
    const transactionsTotal = transactions.reduce((sum, t) => sum + Number(t.liters), 0);
    const meterDiff = transactionsTotal - meterTotal;

    const formatNumber = (num: number) => new Intl.NumberFormat('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(num);
    const formatCurrency = (num: number) => new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);

    if (!station) {
        return (
            <Sidebar>
                <div className="text-center py-20">
                    <p className="text-gray-400">ไม่พบสถานี</p>
                </div>
            </Sidebar>
        );
    }

    return (
        <Sidebar>
            <div className="max-w-6xl mx-auto relative">
                {/* Background orbs */}
                <div className="fixed top-20 right-20 w-[400px] h-[400px] rounded-full opacity-20 blur-3xl pointer-events-none"
                    style={{ background: 'radial-gradient(circle, rgba(168, 85, 247, 0.3) 0%, transparent 70%)' }} />

                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl blur-lg opacity-50" />
                            <div className="relative p-3 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500">
                                <Fuel className="text-white" size={28} />
                            </div>
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-white via-purple-200 to-white bg-clip-text text-transparent">
                                {station.name}
                            </h1>
                            <p className="text-gray-400 flex items-center gap-2">
                                <Sparkles size={14} className="text-purple-400" />
                                {isFullStation ? 'ระบบเต็ม (FULL)' : 'ระบบลงบิล (SIMPLE)'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setShowDailySummary(true)}
                            className="relative group px-5 py-2.5 rounded-xl font-semibold text-white overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600" />
                            <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 blur-xl opacity-50 group-hover:opacity-70 transition-opacity" />
                            <span className="relative flex items-center gap-2">
                                <FileText size={18} />
                                สรุปงานประจำวัน
                            </span>
                        </button>
                        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10">
                            <Calendar size={18} className="text-purple-400" />
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="bg-transparent text-white focus:outline-none w-[150px]"
                            />
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="spinner" />
                    </div>
                ) : (
                    <>
                        {/* FULL Station: Price Settings & Meters */}
                        {isFullStation && (
                            <>
                                {/* Price Settings - only show on meter tab on mobile */}
                                <div className="glass-card p-6 mb-6" style={{ display: showSection('meter') ? 'block' : 'none' }}>
                                    <h2 className="text-lg font-bold text-white mb-4">⛽ ตั้งค่าราคาน้ำมัน</h2>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm text-gray-400 mb-2">ราคาปลีก (ราคาเชื่อ)</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={retailPrice}
                                                onChange={(e) => setRetailPrice(parseFloat(e.target.value))}
                                                className="input-glow text-center text-xl font-mono"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm text-gray-400 mb-2">ราคาส่งหลัก (ราคาปลีก)</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={wholesalePrice}
                                                onChange={(e) => setWholesalePrice(parseFloat(e.target.value))}
                                                className="input-glow text-center text-xl font-mono"
                                            />
                                        </div>
                                    </div>
                                    <button onClick={savePriceSettings} className="btn btn-primary mt-4">
                                        <Save size={18} />
                                        บันทึกราคา
                                    </button>
                                </div>

                                {/* Meter Readings */}
                                <div className="space-y-6 mb-6" style={{ display: showSection('meter') ? 'block' : 'none' }}>
                                    {/* Start Meters */}
                                    <div className="glass-card p-6">
                                        <h3 className="font-bold text-white mb-4">📟 เลขมิเตอร์เริ่มต้น (4 หัวจ่าย)</h3>

                                        {/* Meter Continuity Warning */}
                                        {meterWarnings.length > 0 && (
                                            <div className="mb-4 p-3 bg-yellow-900/30 border border-yellow-500/50 rounded-xl">
                                                <p className="text-sm font-medium text-yellow-400 mb-2">⚠️ พบมิเตอร์ไม่ต่อเนื่องจากกะก่อนหน้า:</p>
                                                <ul className="text-xs text-yellow-300 space-y-1">
                                                    {meterWarnings.map((warning, i) => (
                                                        <li key={i}>• {warning}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}

                                        {/* Previous Day Reference */}
                                        {previousDayMeters.length > 0 && (
                                            <div className="mb-3 text-xs text-gray-500">
                                                <span className="font-medium">เมื่อวาน:</span>{' '}
                                                {previousDayMeters.map((p, i) => (
                                                    <span key={i} className="mr-2">
                                                        หัวจ่าย{p.nozzle}: {p.endReading.toLocaleString("th-TH", { maximumFractionDigits: 2 })}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                        {/* Meter Inputs - Force Visible */}
                                        <div style={{ display: 'block', visibility: 'visible' }}>
                                            {meters.map((m, i) => (
                                                <div key={i} className="bg-white/5 rounded-lg p-3 mb-3" style={{ display: 'block', visibility: 'visible' }}>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <label className="text-sm text-gray-400">❶ หัวจ่าย {m.nozzle}</label>
                                                        <label className="btn btn-secondary text-xs py-1 px-3 cursor-pointer">
                                                            <Camera size={14} />
                                                            <span>เลือกรูป</span>
                                                            <input
                                                                type="file"
                                                                accept="image/*"
                                                                className="hidden"
                                                                onChange={async (e) => {
                                                                    const file = e.target.files?.[0];
                                                                    if (!file) return;
                                                                    const formData = new FormData();
                                                                    formData.append('file', file);
                                                                    formData.append('type', 'start');
                                                                    formData.append('nozzle', String(m.nozzle));
                                                                    formData.append('date', selectedDate);
                                                                    try {
                                                                        const res = await fetch('/api/upload/meter-photo', {
                                                                            method: 'POST',
                                                                            body: formData,
                                                                        });
                                                                        if (res.ok) {
                                                                            const data = await res.json();
                                                                            const newMeters = [...meters];
                                                                            newMeters[i] = { ...newMeters[i], startPhoto: data.url };
                                                                            setMeters(newMeters);
                                                                            alert(`อัพโหลดรูปหัวจ่าย ${m.nozzle} สำเร็จ`);
                                                                        }
                                                                    } catch (err) {
                                                                        alert('อัพโหลดรูปไม่สำเร็จ');
                                                                    }
                                                                }}
                                                            />
                                                        </label>
                                                    </div>
                                                    <input
                                                        type="number"
                                                        value={m.start}
                                                        onChange={(e) => {
                                                            const newMeters = [...meters];
                                                            newMeters[i].start = parseFloat(e.target.value) || 0;
                                                            setMeters(newMeters);
                                                        }}
                                                        className="input-glow text-center font-mono"
                                                    />
                                                    {m.startPhoto && (
                                                        <p className="text-xs text-green-400 mt-1">✓ มีรูปแล้ว</p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                        <button onClick={() => saveMeters('start')} className="btn btn-success w-full mt-4">
                                            <Save size={18} />
                                            บันทึกมิเตอร์เริ่มต้น
                                        </button>
                                    </div>

                                    {/* End Meters */}
                                    <div className="glass-card p-6">
                                        <h3 className="font-bold text-white mb-4">📟 เลขมิเตอร์สิ้นสุด (4 หัวจ่าย)</h3>
                                        {/* Meter Inputs - Force Visible */}
                                        <div style={{ display: 'block', visibility: 'visible' }}>
                                            {meters.map((m, i) => (
                                                <div key={i} className="bg-white/5 rounded-lg p-3 mb-3" style={{ display: 'block', visibility: 'visible' }}>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <label className="text-sm text-gray-400">❶ หัวจ่าย {m.nozzle}</label>
                                                        <label className="btn btn-secondary text-xs py-1 px-3 cursor-pointer">
                                                            <Camera size={14} />
                                                            <span>เลือกรูป</span>
                                                            <input
                                                                type="file"
                                                                accept="image/*"
                                                                className="hidden"
                                                                onChange={async (e) => {
                                                                    const file = e.target.files?.[0];
                                                                    if (!file) return;
                                                                    const formData = new FormData();
                                                                    formData.append('file', file);
                                                                    formData.append('type', 'end');
                                                                    formData.append('nozzle', String(m.nozzle));
                                                                    formData.append('date', selectedDate);
                                                                    try {
                                                                        const res = await fetch('/api/upload/meter-photo', {
                                                                            method: 'POST',
                                                                            body: formData,
                                                                        });
                                                                        if (res.ok) {
                                                                            const data = await res.json();
                                                                            const newMeters = [...meters];
                                                                            newMeters[i] = { ...newMeters[i], endPhoto: data.url };
                                                                            setMeters(newMeters);
                                                                            alert(`อัพโหลดรูปหัวจ่าย ${m.nozzle} สำเร็จ`);
                                                                        }
                                                                    } catch (err) {
                                                                        alert('อัพโหลดรูปไม่สำเร็จ');
                                                                    }
                                                                }}
                                                            />
                                                        </label>
                                                    </div>
                                                    <input
                                                        type="number"
                                                        value={m.end}
                                                        onChange={(e) => {
                                                            const newMeters = [...meters];
                                                            newMeters[i].end = parseFloat(e.target.value) || 0;
                                                            setMeters(newMeters);
                                                        }}
                                                        className="input-glow text-center font-mono"
                                                    />
                                                    {m.endPhoto && (
                                                        <p className="text-xs text-green-400 mt-1">✓ มีรูปแล้ว</p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                        <button onClick={() => saveMeters('end')} className="btn btn-success w-full mt-4">
                                            <Save size={18} />
                                            บันทึกมิเตอร์สิ้นสุด
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Transaction Form */}
                        <div className="glass-card p-6 mb-6" style={{ display: showSection('record') ? 'block' : 'none' }}>
                            <h2 className="text-lg font-bold text-white mb-4">📝 บันทึกการเติม</h2>

                            {/* Payment Type Buttons */}
                            <div className="mb-4">
                                <label className="block text-sm text-gray-400 mb-2">ประเภทการชำระ</label>
                                <div className="flex flex-wrap gap-2">
                                    {PAYMENT_TYPES.map(pt => (
                                        <button
                                            key={pt.value}
                                            onClick={() => setPaymentType(pt.value)}
                                            className={`payment-type-btn ${pt.value.toLowerCase()} ${paymentType === pt.value ? 'active' : ''}`}
                                        >
                                            {pt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Transfer Proof Upload - Only show when TRANSFER selected */}
                            {paymentType === 'TRANSFER' && (
                                <div className="mb-4 p-4 bg-blue-900/20 border border-blue-500/30 rounded-xl">
                                    <label className="block text-sm text-blue-400 mb-2 font-medium">
                                        📷 หลักฐานการโอน (จำเป็น)
                                    </label>
                                    {transferProofUrl ? (
                                        <div className="flex items-center gap-4">
                                            <img
                                                src={transferProofUrl}
                                                alt="หลักฐานการโอน"
                                                className="w-24 h-24 object-cover rounded-lg border border-blue-500/30"
                                            />
                                            <div className="flex flex-col gap-2">
                                                <span className="text-green-400 text-sm flex items-center gap-1">
                                                    <CheckCircle size={14} /> อัพโหลดแล้ว
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => setTransferProofUrl(null)}
                                                    className="text-red-400 text-sm hover:underline"
                                                >
                                                    ลบรูป
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="relative">
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={handleTransferProofUpload}
                                                disabled={transferUploading}
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                            />
                                            <div className={`flex items-center justify-center gap-2 p-4 border-2 border-dashed rounded-xl transition-colors ${transferUploading
                                                ? 'border-blue-500/50 bg-blue-900/30'
                                                : 'border-blue-500/30 hover:border-blue-500/60 hover:bg-blue-900/20'
                                                }`}>
                                                {transferUploading ? (
                                                    <>
                                                        <div className="spinner w-5 h-5" />
                                                        <span className="text-blue-400">กำลังอัพโหลด...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Camera size={20} className="text-blue-400" />
                                                        <span className="text-blue-400">คลิกเพื่อเลือกรูปหลักฐาน</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Book/Bill No & Fuel Type */}
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                                <div>
                                    <label className="block text-sm text-gray-400 mb-2">เล่มที่</label>
                                    <input
                                        type="text"
                                        value={bookNo}
                                        onChange={(e) => setBookNo(e.target.value)}
                                        onBlur={checkDuplicateBill}
                                        className="input-glow text-center"
                                        placeholder="เช่น 369"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-2">เลขที่</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={billNo}
                                            onChange={(e) => setBillNo(e.target.value)}
                                            onBlur={checkDuplicateBill}
                                            className="input-glow text-center w-full"
                                            placeholder="เช่น 1500"
                                        />
                                        {checkingBill && (
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                                <div className="spinner w-4 h-4" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-2">ชนิดน้ำมัน</label>
                                    <div className="input-glow flex items-center justify-center bg-gray-800 text-gray-400 cursor-not-allowed">
                                        ดีเซล (Diesel)
                                    </div>
                                </div>
                            </div>

                            {/* Duplicate Bill Warning */}
                            {duplicateBillWarning && duplicateBillWarning.exists && (
                                <div className="mb-4 p-3 bg-red-900/30 border border-red-500/50 rounded-xl">
                                    <p className="text-sm font-medium text-red-400 mb-2">
                                        ⚠️ พบเลขที่บิลซ้ำ! (เล่มที่ {bookNo} เลขที่ {billNo} มีอยู่แล้ว {duplicateBillWarning.count} รายการ)
                                    </p>
                                    <div className="text-xs text-red-300 space-y-1">
                                        {duplicateBillWarning.transactions.map((t, i) => (
                                            <div key={i}>
                                                • {new Date(t.date).toLocaleDateString('th-TH')} - {t.licensePlate || 'ไม่ระบุ'} ({t.ownerName || 'ไม่ระบุ'}) - {t.amount.toLocaleString("th-TH", { maximumFractionDigits: 2 })} บาท
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-xs text-gray-400 mt-2">
                                        หากต้องการบันทึกซ้ำ กรุณายืนยันว่าถูกต้อง
                                    </p>
                                </div>
                            )}

                            <form onSubmit={handleSubmitTransaction} className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {isFullStation && (
                                        <div>
                                            <label className="block text-sm text-gray-400 mb-2">หัวจ่าย (Nozzle)</label>
                                            <select
                                                value={nozzleNumber}
                                                onChange={(e) => setNozzleNumber(parseInt(e.target.value))}
                                                className="input-glow"
                                            >
                                                {[1, 2, 3, 4].map(n => (
                                                    <option key={n} value={n}>หัวจ่าย {n}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    <div className={isFullStation ? '' : 'md:col-span-2'}>
                                        <label className="block text-sm text-gray-400 mb-2">ทะเบียนรถ</label>
                                        <div className="relative" ref={dropdownRef}>
                                            <input
                                                ref={inputRef}
                                                type="text"
                                                value={licensePlate}
                                                onChange={(e) => {
                                                    setLicensePlate(e.target.value);
                                                    if (e.target.value !== licensePlate) {
                                                        clearOwner();
                                                    }
                                                }}
                                                onFocus={() => {
                                                    if (searchResults.length > 0) {
                                                        setShowDropdown(true);
                                                    }
                                                }}
                                                placeholder={paymentType === 'CASH' || paymentType === 'TRANSFER' ? 'ทะเบียน (ไม่บังคับ)' : 'พิมพ์ทะเบียน...'}
                                                className="input-glow"
                                                required={paymentType !== 'CASH' && paymentType !== 'TRANSFER'}
                                                autoComplete="off"
                                            />
                                            {searchLoading && (
                                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                                    <div className="spinner w-4 h-4" />
                                                </div>
                                            )}

                                            {/* Dropdown */}
                                            {showDropdown && (
                                                <div className="absolute z-50 w-full mt-1 dropdown-menu max-h-64 overflow-y-auto">
                                                    {searchResults.length > 0 ? (
                                                        <>
                                                            {searchResults.map((truck) => (
                                                                <button
                                                                    key={truck.id}
                                                                    type="button"
                                                                    onClick={() => selectTruck(truck)}
                                                                    className="w-full px-4 py-3 text-left hover:bg-purple-500/20 border-b border-white/10 last:border-b-0 transition-colors"
                                                                >
                                                                    <div className="flex items-start justify-between">
                                                                        <div>
                                                                            <p className="font-mono text-blue-400 font-medium">
                                                                                {truck.licensePlate}
                                                                            </p>
                                                                            <p className="text-sm text-white flex items-center gap-1 mt-1">
                                                                                <User size={12} className="text-gray-400" />
                                                                                {truck.ownerName}
                                                                            </p>
                                                                        </div>
                                                                        <div className="text-right">
                                                                            {truck.ownerCode && (
                                                                                <span className="badge badge-purple text-xs">
                                                                                    {truck.ownerCode}
                                                                                </span>
                                                                            )}
                                                                            {truck.ownerPhone && (
                                                                                <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                                                                                    <Phone size={10} />
                                                                                    {truck.ownerPhone}
                                                                                </p>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </button>
                                                            ))}
                                                        </>
                                                    ) : !searchLoading && licensePlate.length >= 2 ? (
                                                        <div className="px-4 py-3 text-center">
                                                            <p className="text-gray-400 mb-2">ไม่พบทะเบียน "{licensePlate}"</p>
                                                            <button
                                                                type="button"
                                                                onClick={openAddTruckForm}
                                                                className="btn btn-success text-sm py-2 px-4"
                                                            >
                                                                <Plus size={16} />
                                                                เพิ่มทะเบียนใหม่
                                                            </button>
                                                        </div>
                                                    ) : null}
                                                </div>
                                            )}
                                        </div>

                                        {/* Add Truck Form */}
                                        {showAddTruckForm && (
                                            <div className="mt-2 p-3 bg-blue-900/20 rounded-lg border border-blue-500/30">
                                                <p className="text-sm text-blue-400 mb-2 font-medium">
                                                    เพิ่มทะเบียน: <span className="font-mono">{licensePlate.toUpperCase()}</span>
                                                </p>
                                                <div className="flex gap-2">
                                                    <select
                                                        value={selectedOwnerId}
                                                        onChange={(e) => setSelectedOwnerId(e.target.value)}
                                                        className="input-glow flex-1"
                                                    >
                                                        <option value="">เลือกเจ้าของ...</option>
                                                        {owners.map((o) => (
                                                            <option key={o.id} value={o.id}>
                                                                {o.name} {o.code ? `(${o.code})` : ''}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <button
                                                        type="button"
                                                        onClick={handleAddTruck}
                                                        disabled={!selectedOwnerId || addingTruck}
                                                        className="btn btn-success py-2"
                                                    >
                                                        {addingTruck ? 'กำลังบันทึก...' : 'บันทึก'}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowAddTruckForm(false)}
                                                        className="btn btn-secondary py-2"
                                                    >
                                                        ยกเลิก
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {/* Selected owner info */}
                                        {ownerName && !showAddTruckForm && (
                                            <div className="mt-2 p-2 bg-green-900/20 rounded-lg border border-green-500/30">
                                                <p className="text-sm text-green-400 flex items-center gap-2">
                                                    <User size={14} />
                                                    <span className="font-medium">{ownerName}</span>
                                                    {ownerCode && <span className="badge badge-purple text-xs">{ownerCode}</span>}
                                                </p>
                                                {ownerPhone && (
                                                    <p className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                                                        <Phone size={10} />
                                                        {ownerPhone}
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-sm text-gray-400 mb-2">จำนวนลิตร</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={liters}
                                            onChange={(e) => setLiters(e.target.value)}
                                            placeholder="0.00"
                                            className="input-glow text-xl font-mono text-center"
                                            required
                                        />
                                    </div>
                                </div>

                                {/* Special Price */}
                                <div className="flex items-center gap-4">
                                    <label className="flex items-center gap-2 text-sm text-gray-400">
                                        <input
                                            type="checkbox"
                                            checked={useSpecialPrice}
                                            onChange={(e) => setUseSpecialPrice(e.target.checked)}
                                            className="w-4 h-4"
                                        />
                                        ใช้ราคาพิเศษ
                                    </label>
                                    {useSpecialPrice && (
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={specialPrice}
                                            onChange={(e) => setSpecialPrice(e.target.value)}
                                            placeholder="ราคาพิเศษ"
                                            className="input-glow w-32"
                                        />
                                    )}
                                </div>

                                {/* Total */}
                                <div className="bg-purple-900/30 rounded-xl p-4 flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-gray-400">รวมเป็นเงิน</p>
                                        <p className="text-3xl font-bold text-green-400">{formatCurrency(calculateAmount())} <span className="text-lg">บาท</span></p>
                                    </div>
                                    <button type="submit" className="btn btn-success">
                                        <Save size={20} />
                                        บันทึกการเติม
                                    </button>
                                </div>
                            </form>
                        </div>

                        {/* Meter Verification (FULL only) - shows in summary tab on mobile */}
                        {isFullStation && (
                            <div className="glass-card p-6 mb-6" style={{ display: showSection('summary') ? 'block' : 'none' }}>
                                <h2 className="text-lg font-bold text-white mb-4">📊 ตรวจสอบยอดมิเตอร์</h2>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="text-center p-4 bg-blue-900/20 rounded-xl">
                                        <p className="text-sm text-gray-400">ยอดรวมมิเตอร์</p>
                                        <p className="text-2xl font-bold text-blue-400">{formatNumber(meterTotal)}</p>
                                        <p className="text-sm text-gray-400">ลิตร</p>
                                    </div>
                                    <div className="text-center p-4 bg-green-900/20 rounded-xl">
                                        <p className="text-sm text-gray-400">ยอดขายจริง</p>
                                        <p className="text-2xl font-bold text-green-400">{formatNumber(transactionsTotal)}</p>
                                        <p className="text-sm text-gray-400">ลิตร</p>
                                    </div>
                                    <div className={`text-center p-4 rounded-xl ${Math.abs(meterDiff) < 1 ? 'bg-green-900/20' : 'bg-red-900/20'}`}>
                                        <p className="text-sm text-gray-400">ผลต่าง</p>
                                        <p className={`text-2xl font-bold ${Math.abs(meterDiff) < 1 ? 'text-green-400' : 'text-red-400'}`}>
                                            {meterDiff > 0 ? '+' : ''}{formatNumber(meterDiff)}
                                        </p>
                                        {Math.abs(meterDiff) >= 1 ? (
                                            <p className="text-sm text-red-400 flex items-center justify-center gap-1">
                                                <AlertTriangle size={14} />
                                                ยอดไม่ตรงกัน
                                            </p>
                                        ) : (
                                            <p className="text-sm text-green-400 flex items-center justify-center gap-1">
                                                <CheckCircle size={14} />
                                                ตรงกัน
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Transactions List */}
                        <div className="glass-card p-6" style={{ display: showSection('list') ? 'block' : 'none' }}>
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                                <h2 className="text-lg font-bold text-white">📋 รายการเติมวันนี้</h2>
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        onClick={() => setActiveFilter('all')}
                                        className={`badge ${activeFilter === 'all' ? 'badge-purple' : 'badge-gray'}`}
                                    >
                                        ทั้งหมด
                                    </button>
                                    {PAYMENT_TYPES.map(pt => (
                                        <button
                                            key={pt.value}
                                            onClick={() => setActiveFilter(pt.value)}
                                            className={`badge ${activeFilter === pt.value ? 'badge-purple' : 'badge-gray'}`}
                                        >
                                            {pt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-4 text-sm text-gray-400 mb-4">
                                <span>รวมลิตร: <strong className="text-white">{formatNumber(filteredTransactions.reduce((s, t) => s + Number(t.liters), 0))}</strong></span>
                                <span>รวมเงิน: <strong className="text-green-400">{formatCurrency(filteredTransactions.reduce((s, t) => s + Number(t.amount), 0))} บาท</strong></span>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="table-glass">
                                    <thead>
                                        <tr>
                                            <th>ลำดับ</th>
                                            <th>เวลา</th>
                                            <th>เล่ม/เลขที่</th>
                                            <th>ทะเบียน</th>
                                            <th>เจ้าของ</th>
                                            {isFullStation && <th>หัวจ่าย</th>}
                                            <th>ประเภท</th>
                                            <th>ลิตร</th>
                                            <th>ราคา/ลิตร</th>
                                            <th>รวมเงิน</th>
                                            <th>ผู้บันทึก</th>
                                            <th>จัดการ</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredTransactions.length === 0 ? (
                                            <tr>
                                                <td colSpan={isFullStation ? 11 : 10} className="text-center py-8 text-gray-400">
                                                    ไม่มีรายการ
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredTransactions.map((t, i) => {
                                                const paymentInfo = PAYMENT_TYPES.find(pt => pt.value === t.paymentType);
                                                return (
                                                    <tr key={t.id}>
                                                        <td>{i + 1}</td>
                                                        <td>{new Date(t.date).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</td>
                                                        <td className="text-sm text-gray-300">
                                                            {t.billBookNo ? `${t.billBookNo}/${t.billNo}` : '-'}
                                                        </td>
                                                        <td className="font-mono">{t.licensePlate}</td>
                                                        <td>{t.ownerName || '-'}</td>
                                                        {isFullStation && <td>{t.nozzleNumber}</td>}
                                                        <td>
                                                            <span className={`badge ${paymentInfo?.color.replace('bg-', 'badge-').replace('-600', '')}`}>
                                                                {paymentInfo?.label}
                                                            </span>
                                                        </td>
                                                        <td className="font-mono">{formatNumber(Number(t.liters))}</td>
                                                        <td className="font-mono">{Number(t.pricePerLiter).toFixed(2)}</td>
                                                        <td className="font-mono text-green-400">{formatCurrency(Number(t.amount))}</td>
                                                        <td>
                                                            <span className="px-2 py-1 text-xs rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                                                {t.recordedByName || '-'}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <div className="flex gap-1">
                                                                <button
                                                                    onClick={() => openEditModal(t)}
                                                                    className="p-1.5 rounded-lg bg-yellow-500/20 hover:bg-yellow-500/40 text-yellow-400 transition-colors"
                                                                    title="แก้ไข"
                                                                >
                                                                    <Edit size={14} />
                                                                </button>
                                                                <button
                                                                    onClick={() => handlePrintTransaction(t)}
                                                                    className="p-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/40 text-blue-400 transition-colors"
                                                                    title="พิมพ์"
                                                                >
                                                                    <Printer size={14} />
                                                                </button>
                                                                <button
                                                                    onClick={() => openDeleteConfirm(t.id, t.licensePlate)}
                                                                    className="p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/40 text-red-400 transition-colors"
                                                                    title="ลบ"
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Daily Summary Modal */}
            {showDailySummary && (
                <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
                    <div className="bg-[#0f0f1a] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-white/10">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-6 border-b border-white/10 sticky top-0 bg-[#0f0f1a]">
                            <div>
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    <FileText className="text-purple-400" />
                                    สรุปงานประจำวัน
                                </h2>
                                <p className="text-gray-400 text-sm mt-1">
                                    {new Date(selectedDate).toLocaleDateString('th-TH', {
                                        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                                    })}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => window.print()}
                                    className="btn btn-secondary btn-sm"
                                >
                                    <Printer size={16} />
                                    พิมพ์
                                </button>
                                <button
                                    onClick={() => setShowDailySummary(false)}
                                    className="p-2 rounded-lg hover:bg-white/10 text-gray-400"
                                >
                                    <X size={24} />
                                </button>
                            </div>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6 space-y-6">
                            {/* Meter Summary */}
                            {isFullStation && (
                                <div className="bg-white/5 rounded-xl p-4">
                                    <h3 className="font-bold text-cyan-400 mb-3">📟 มิเตอร์หัวจ่าย</h3>
                                    <div className="grid grid-cols-4 gap-2 text-sm">
                                        <div className="font-bold text-gray-400">หัว</div>
                                        <div className="font-bold text-gray-400 text-right">เริ่มต้น</div>
                                        <div className="font-bold text-gray-400 text-right">สิ้นสุด</div>
                                        <div className="font-bold text-gray-400 text-right">ขาย</div>
                                        {meters.map(m => (
                                            <div key={m.nozzle} className="contents">
                                                <div className="text-cyan-400">หัว {m.nozzle}</div>
                                                <div className="font-mono text-right">{m.start.toLocaleString("th-TH", { maximumFractionDigits: 2 })}</div>
                                                <div className="font-mono text-right">{m.end.toLocaleString("th-TH", { maximumFractionDigits: 2 })}</div>
                                                <div className="font-mono text-right text-green-400">{(m.end - m.start).toLocaleString("th-TH", { maximumFractionDigits: 2 })}</div>
                                            </div>
                                        ))}
                                        <div className="font-bold text-white border-t border-white/10 pt-2">รวม</div>
                                        <div className="font-mono text-right border-t border-white/10 pt-2">{meters.reduce((s, m) => s + m.start, 0).toLocaleString("th-TH", { maximumFractionDigits: 2 })}</div>
                                        <div className="font-mono text-right border-t border-white/10 pt-2">{meters.reduce((s, m) => s + m.end, 0).toLocaleString("th-TH", { maximumFractionDigits: 2 })}</div>
                                        <div className="font-mono text-right border-t border-white/10 pt-2 text-green-400 font-bold">{meters.reduce((s, m) => s + (m.end - m.start), 0).toLocaleString("th-TH", { maximumFractionDigits: 2 })}</div>
                                    </div>
                                </div>
                            )}

                            {/* Transaction Summary */}
                            <div className="bg-white/5 rounded-xl p-4">
                                <h3 className="font-bold text-green-400 mb-3">💰 สรุปรายได้</h3>
                                <div className="space-y-2">
                                    {(() => {
                                        const cashTotal = transactions.filter(t => t.paymentType === 'CASH').reduce((s, t) => s + Number(t.amount), 0);
                                        const creditTotal = transactions.filter(t => t.paymentType === 'CREDIT').reduce((s, t) => s + Number(t.amount), 0);
                                        const transferTotal = transactions.filter(t => t.paymentType === 'TRANSFER').reduce((s, t) => s + Number(t.amount), 0);
                                        const boxTotal = transactions.filter(t => t.paymentType === 'BOX_TRUCK').reduce((s, t) => s + Number(t.amount), 0);
                                        const oilTruckTotal = transactions.filter(t => t.paymentType === 'OIL_TRUCK_SUPACHAI').reduce((s, t) => s + Number(t.amount), 0);
                                        const total = transactions.reduce((s, t) => s + Number(t.amount), 0);
                                        const totalLiters = transactions.reduce((s, t) => s + Number(t.liters), 0);
                                        return (
                                            <>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-400">💵 เงินสด:</span>
                                                    <span className="font-mono text-green-400">{cashTotal.toLocaleString("th-TH", { maximumFractionDigits: 2 })} บาท</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-400">💳 เงินเชื่อ:</span>
                                                    <span className="font-mono text-orange-400">{creditTotal.toLocaleString("th-TH", { maximumFractionDigits: 2 })} บาท</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-400">📲 โอนเงิน:</span>
                                                    <span className="font-mono text-blue-400">{transferTotal.toLocaleString("th-TH", { maximumFractionDigits: 2 })} บาท</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-400">📦 รถตู้ทึบ:</span>
                                                    <span className="font-mono text-yellow-400">{boxTotal.toLocaleString("th-TH", { maximumFractionDigits: 2 })} บาท</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-400">🚛 รถน้ำมันศุภชัย:</span>
                                                    <span className="font-mono text-purple-400">{oilTruckTotal.toLocaleString("th-TH", { maximumFractionDigits: 2 })} บาท</span>
                                                </div>
                                                <div className="flex justify-between border-t border-white/10 pt-2 mt-2">
                                                    <span className="font-bold text-white">รวมทั้งหมด:</span>
                                                    <span className="font-mono font-bold text-green-400 text-lg">{total.toLocaleString("th-TH", { maximumFractionDigits: 2 })} บาท</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="font-bold text-white">รวมลิตร:</span>
                                                    <span className="font-mono font-bold text-cyan-400">{totalLiters.toLocaleString("th-TH", { maximumFractionDigits: 2 })} ลิตร</span>
                                                </div>
                                            </>
                                        );
                                    })()}
                                </div>
                            </div>

                            {/* Statistics */}
                            <div className="bg-white/5 rounded-xl p-4">
                                <h3 className="font-bold text-purple-400 mb-3">📈 สถิติ</h3>
                                <div className="grid grid-cols-3 gap-4 text-center">
                                    <div>
                                        <div className="text-2xl font-bold text-white">{transactions.length}</div>
                                        <div className="text-sm text-gray-400">รายการ</div>
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold text-cyan-400">{transactions.reduce((s, t) => s + Number(t.liters), 0).toLocaleString("th-TH", { maximumFractionDigits: 2 })}</div>
                                        <div className="text-sm text-gray-400">ลิตร</div>
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold text-green-400">{transactions.reduce((s, t) => s + Number(t.amount), 0).toLocaleString("th-TH", { maximumFractionDigits: 2 })}</div>
                                        <div className="text-sm text-gray-400">บาท</div>
                                    </div>
                                </div>
                            </div>

                            {/* Transactions Detail with Print Toggle */}
                            <div className="bg-white/5 rounded-xl p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="font-bold text-orange-400">📋 รายการทั้งหมด ({transactions.length} รายการ)</h3>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={includeTransactionsInPrint}
                                            onChange={(e) => setIncludeTransactionsInPrint(e.target.checked)}
                                            className="w-4 h-4 rounded border-gray-500 bg-white/10 accent-orange-500"
                                        />
                                        <span className="text-sm text-gray-400">รวมในการพิมพ์</span>
                                    </label>
                                </div>
                                <div className={`max-h-60 overflow-y-auto ${!includeTransactionsInPrint ? 'no-print' : ''}`} id="transactions-detail">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-left text-gray-400 border-b border-white/10">
                                                <th className="py-2">#</th>
                                                <th>เวลา</th>
                                                <th>ทะเบียน</th>
                                                <th>เจ้าของ</th>
                                                <th className="text-right">ลิตร</th>
                                                <th className="text-right">บาท</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {transactions.map((t, i) => (
                                                <tr key={t.id} className="border-b border-white/5">
                                                    <td className="py-1.5 text-gray-500">{i + 1}</td>
                                                    <td className="text-gray-300">{new Date(t.date).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</td>
                                                    <td className="font-mono text-green-400">{t.licensePlate}</td>
                                                    <td className="text-gray-300">{t.ownerName || '-'}</td>
                                                    <td className="text-right font-mono text-cyan-400">{Number(t.liters).toFixed(1)}</td>
                                                    <td className="text-right font-mono text-green-400">{Number(t.amount).toLocaleString("th-TH", { maximumFractionDigits: 2 })}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Transaction Modal */}
            {editingTransaction && (
                <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
                    <div className="bg-[#0f0f1a] rounded-2xl w-full max-w-lg border border-white/10">
                        <div className="flex items-center justify-between p-4 border-b border-white/10">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <Edit className="text-yellow-400" size={20} />
                                แก้ไขรายการ
                            </h2>
                            <button
                                onClick={() => setEditingTransaction(null)}
                                className="text-gray-400 hover:text-white"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-4 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">ทะเบียน</label>
                                    <input
                                        type="text"
                                        value={editLicensePlate}
                                        onChange={(e) => setEditLicensePlate(e.target.value)}
                                        className="input-glow w-full"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">เจ้าของ</label>
                                    <input
                                        type="text"
                                        value={editOwnerName}
                                        onChange={(e) => setEditOwnerName(e.target.value)}
                                        className="input-glow w-full"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">เล่มที่</label>
                                    <input
                                        type="text"
                                        value={editBillBookNo}
                                        onChange={(e) => setEditBillBookNo(e.target.value)}
                                        className="input-glow w-full"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">เลขที่</label>
                                    <input
                                        type="text"
                                        value={editBillNo}
                                        onChange={(e) => setEditBillNo(e.target.value)}
                                        className="input-glow w-full"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">ลิตร</label>
                                    <input
                                        type="number"
                                        value={editLiters}
                                        onChange={(e) => setEditLiters(e.target.value)}
                                        className="input-glow w-full"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">ราคา/ลิตร</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={editPricePerLiter}
                                        onChange={(e) => setEditPricePerLiter(e.target.value)}
                                        className="input-glow w-full"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm text-gray-400 mb-1">ประเภทการจ่าย</label>
                                <div className="flex flex-wrap gap-2">
                                    {PAYMENT_TYPES.map(pt => (
                                        <button
                                            key={pt.value}
                                            type="button"
                                            onClick={() => setEditPaymentType(pt.value)}
                                            className={`px-3 py-1.5 rounded-lg text-sm transition-all ${editPaymentType === pt.value
                                                ? `${pt.color} text-white`
                                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                                }`}
                                        >
                                            {pt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="text-right text-lg">
                                รวม: <span className="text-green-400 font-bold">
                                    {formatCurrency((parseFloat(editLiters) || 0) * (parseFloat(editPricePerLiter) || 0))} บาท
                                </span>
                            </div>
                        </div>

                        <div className="flex gap-3 p-4 border-t border-white/10">
                            <button
                                onClick={() => setEditingTransaction(null)}
                                className="flex-1 btn btn-secondary"
                            >
                                ยกเลิก
                            </button>
                            <button
                                onClick={handleSaveEdit}
                                disabled={editSaving}
                                className="flex-1 btn btn-primary"
                            >
                                {editSaving ? 'กำลังบันทึก...' : 'บันทึก'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Mobile Bottom Tab Bar */}
            <div className="bottom-tab-bar">
                <button
                    onClick={() => setActiveTab('record')}
                    className={activeTab === 'record' ? 'active' : ''}
                >
                    <PenLine />
                    <span>บันทึก</span>
                </button>
                <button
                    onClick={() => setActiveTab('list')}
                    className={activeTab === 'list' ? 'active' : ''}
                >
                    <List />
                    <span>รายการ</span>
                </button>
                {isFullStation && (
                    <button
                        onClick={() => setActiveTab('meter')}
                        className={activeTab === 'meter' ? 'active' : ''}
                    >
                        <Gauge />
                        <span>มิเตอร์</span>
                    </button>
                )}
                <button
                    onClick={() => setActiveTab('summary')}
                    className={activeTab === 'summary' ? 'active' : ''}
                >
                    <BarChart3 />
                    <span>สรุป</span>
                </button>
            </div>

            {/* Delete Confirmation Dialog */}
            <ConfirmDialog
                isOpen={deleteConfirm.isOpen}
                title="ยืนยันการลบ"
                message={`ต้องการลบรายการ "${deleteConfirm.licensePlate}" หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้`}
                confirmText="ลบรายการ"
                cancelText="ยกเลิก"
                type="danger"
                onConfirm={confirmDeleteTransaction}
                onCancel={() => setDeleteConfirm({ isOpen: false, transactionId: null, licensePlate: '' })}
                loading={deleting}
            />
        </Sidebar>
    );
}
