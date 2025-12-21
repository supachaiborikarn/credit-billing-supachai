'use client';

import { useState, useEffect, use, useRef } from 'react';
import Sidebar from '@/components/Sidebar';
import {
    Calendar,
    Save,
    Fuel,
    AlertTriangle,
    CheckCircle,
    User,
    Plus,
    Package,
    Camera,
    Gauge,
    FileText,
    Printer,
    X,
    Sparkles,
    Clock
} from 'lucide-react';
import { GAS_PAYMENT_TYPES, STATIONS, DEFAULT_GAS_PRICE, STATION_STAFF } from '@/constants';

interface DailyRecord {
    id: string;
    date: string;
    gasPrice: number;
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

interface GasSupply {
    id: string;
    date: string;
    liters: number;
    supplier: string | null;
    invoiceNo: string | null;
}

interface ProductInventoryItem {
    id: string;
    productId: string;
    product: {
        id: string;
        name: string;
        unit: string;
        salePrice: number;
    };
    quantity: number;
    alertLevel: number | null;
}

interface Product {
    id: string;
    name: string;
    unit: string;
    salePrice: number;
}

export default function GasStationPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const stationIndex = parseInt(id) - 1;
    const station = STATIONS[stationIndex];
    const isGasStation = station?.type === 'GAS';
    const hasProducts = 'hasProducts' in station && station.hasProducts;

    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [dailyRecord, setDailyRecord] = useState<DailyRecord | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [gasSupplies, setGasSupplies] = useState<GasSupply[]>([]);
    const [activeFilter, setActiveFilter] = useState('all');

    // Gas price
    const [gasPrice, setGasPrice] = useState(DEFAULT_GAS_PRICE);

    // Meters (4 nozzles) with photo support
    const [meters, setMeters] = useState<{ nozzle: number; start: number; end: number; startPhoto?: string; endPhoto?: string }[]>([
        { nozzle: 1, start: 0, end: 0 },
        { nozzle: 2, start: 0, end: 0 },
        { nozzle: 3, start: 0, end: 0 },
        { nozzle: 4, start: 0, end: 0 },
    ]);
    const [uploadingPhoto, setUploadingPhoto] = useState<string | null>(null);

    // Transaction form
    const [paymentType, setPaymentType] = useState('CASH');
    const [licensePlate, setLicensePlate] = useState('');
    const [ownerName, setOwnerName] = useState('');
    const [ownerId, setOwnerId] = useState<string | null>(null);
    const [ownerCode, setOwnerCode] = useState<string | null>(null);
    const [ownerPhone, setOwnerPhone] = useState<string | null>(null);
    const [nozzleNumber, setNozzleNumber] = useState(1);
    const [liters, setLiters] = useState('');
    const [staffName, setStaffName] = useState('');

    // License plate search
    const [searchResults, setSearchResults] = useState<TruckSearchResult[]>([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [searchLoading, setSearchLoading] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Gas supply form - input in KG, convert × 1.85 to liters
    const [showSupplyForm, setShowSupplyForm] = useState(false);
    const [supplyKg, setSupplyKg] = useState('');
    const [supplySupplier, setSupplySupplier] = useState('');
    const [supplyInvoiceNo, setSupplyInvoiceNo] = useState('');
    const KG_TO_LITERS = 1.85; // Conversion factor
    const TANK_CAPACITY_LITERS = 98; // Each tank 100% = 98 liters

    // Stock calculation
    const [currentStock, setCurrentStock] = useState(0);
    const [stockAlert, setStockAlert] = useState(1000); // Alert when below 1000 liters

    // Product inventory (for stations with hasProducts)
    const [productInventory, setProductInventory] = useState<ProductInventoryItem[]>([]);
    const [allProducts, setAllProducts] = useState<Product[]>([]);
    const [showAddProductForm, setShowAddProductForm] = useState(false);
    const [selectedProductId, setSelectedProductId] = useState('');
    const [sellQuantity, setSellQuantity] = useState<Record<string, number>>({});
    const [receiveQuantity, setReceiveQuantity] = useState<Record<string, number>>({});

    // Gauge readings (3 tanks) with start and end for comparison
    const [gaugeReadings, setGaugeReadings] = useState<{ tankNumber: number; startPercentage: number | null; endPercentage: number | null }[]>([
        { tankNumber: 1, startPercentage: null, endPercentage: null },
        { tankNumber: 2, startPercentage: null, endPercentage: null },
        { tankNumber: 3, startPercentage: null, endPercentage: null },
    ]);
    const [newGaugeValues, setNewGaugeValues] = useState<Record<string, string>>({}); // key: "tankNumber-type" e.g. "1-start"

    // User role check
    const [isAdmin, setIsAdmin] = useState(false);

    // Shift management (กะเช้า/กะบ่าย)
    const [currentShift, setCurrentShift] = useState<number | null>(null); // 1=กะเช้า, 2=กะบ่าย
    const [shiftData, setShiftData] = useState<any>(null);
    const [showOpenShiftModal, setShowOpenShiftModal] = useState(false);
    const [showCloseShiftModal, setShowCloseShiftModal] = useState(false);
    const [shiftMeterInputs, setShiftMeterInputs] = useState<Record<number, number>>({});
    const [previousShiftMeters, setPreviousShiftMeters] = useState<Record<number, number> | null>(null);

    // Daily summary modal
    const [showDailySummary, setShowDailySummary] = useState(false);

    // Revenue summary modal
    const [showRevenueSummary, setShowRevenueSummary] = useState(false);

    // Save all loading state
    const [savingAll, setSavingAll] = useState(false);

    // Check user role on mount
    useEffect(() => {
        const checkUser = async () => {
            try {
                const res = await fetch('/api/auth/me');
                if (res.ok) {
                    const data = await res.json();
                    // API returns { user: { role: 'ADMIN' } }
                    setIsAdmin(data.user?.role === 'ADMIN');
                }
            } catch (error) {
                console.error('Error checking user:', error);
            }
        };
        checkUser();
    }, []);

    // Read selected shift from localStorage (set at login)
    useEffect(() => {
        const savedShift = localStorage.getItem('selectedShift');
        if (savedShift) {
            setCurrentShift(parseInt(savedShift));
        }
    }, []);

    // Fetch shift data for the day
    const fetchShiftData = async () => {
        try {
            const res = await fetch(`/api/gas-station/${id}/shifts?date=${selectedDate}`);
            if (res.ok) {
                const data = await res.json();
                setShiftData(data);
                // Note: We don't auto-fill meters here anymore to prevent overwriting 
                // when user switches shifts. User can use "ดึงจากกะก่อน" button instead.
            }
        } catch (error) {
            console.error('Error fetching shift data:', error);
        }
    };

    // Fetch previous shift data for comparison
    const fetchPreviousShift = async () => {
        try {
            // If current shift is 2 (afternoon), get shift 1 from same day
            // If current shift is 1 (morning), get shift 2 from previous day
            let targetDate = selectedDate;
            let targetShift = 1;

            if (currentShift === 2) {
                // Get morning shift of same day
                targetShift = 1;
            } else if (currentShift === 1) {
                // Get afternoon shift of previous day
                const prevDate = new Date(selectedDate);
                prevDate.setDate(prevDate.getDate() - 1);
                targetDate = prevDate.toISOString().split('T')[0];
                targetShift = 2;
            }

            const res = await fetch(`/api/gas-station/${id}/shifts?date=${targetDate}`);
            if (res.ok) {
                const data = await res.json();
                const prevShift = data.shifts?.find((s: any) => s.shiftNumber === targetShift);
                if (prevShift?.meters) {
                    const meters: Record<number, number> = {};
                    prevShift.meters.forEach((m: any) => {
                        // Use end reading if available, otherwise start reading
                        meters[m.nozzleNumber] = m.endReading ?? m.startReading ?? 0;
                    });
                    setPreviousShiftMeters(meters);
                    return meters;
                }
            }
            setPreviousShiftMeters(null);
            return null;
        } catch (error) {
            console.error('Error fetching previous shift:', error);
            return null;
        }
    };

    // Copy meters from previous shift
    const copyFromPreviousShift = async () => {
        const meters = await fetchPreviousShift();
        if (meters) {
            setShiftMeterInputs(meters);
            alert('📋 คัดลอกมิเตอร์จากกะก่อนหน้าเรียบร้อย');
        } else {
            alert('⚠️ ไม่พบข้อมูลกะก่อนหน้า');
        }
    };

    useEffect(() => {
        if (station && isGasStation) {
            fetchDailyData();
            fetchGaugeReadings();
            fetchShiftData();
            if (hasProducts) {
                fetchProductInventory();
            }
        }
    }, [selectedDate, station, currentShift]);

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

    const fetchDailyData = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/gas-station/${id}/daily?date=${selectedDate}`);
            if (res.ok) {
                const data = await res.json();
                setDailyRecord(data.dailyRecord);
                setTransactions(data.transactions || []);
                setGasSupplies(data.gasSupplies || []);
                setCurrentStock(data.currentStock || 0);
                if (data.dailyRecord) {
                    setGasPrice(data.dailyRecord.gasPrice || DEFAULT_GAS_PRICE);
                    if (data.dailyRecord.meters) {
                        setMeters(data.dailyRecord.meters.map((m: MeterReading) => ({
                            nozzle: m.nozzleNumber,
                            start: Number(m.startReading),
                            end: Number(m.endReading) || 0,
                        })));
                    }
                } else {
                    // Reset meters and price when no daily record exists for this date
                    setGasPrice(DEFAULT_GAS_PRICE);
                    setMeters([
                        { nozzle: 1, start: 0, end: 0 },
                        { nozzle: 2, start: 0, end: 0 },
                        { nozzle: 3, start: 0, end: 0 },
                        { nozzle: 4, start: 0, end: 0 },
                    ]);
                }
            }
        } catch (error) {
            console.error('Error fetching daily data:', error);
        } finally {
            setLoading(false);
        }
    };

    const saveGasPrice = async () => {
        try {
            const res = await fetch(`/api/gas-station/${id}/daily`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: selectedDate,
                    gasPrice,
                }),
            });
            if (res.ok) {
                alert('บันทึกราคาแก๊สเรียบร้อย');
                fetchDailyData();
            }
        } catch (error) {
            console.error('Error saving gas price:', error);
        }
    };

    const fetchGaugeReadings = async () => {
        try {
            const res = await fetch(`/api/gas-station/${id}/gauge?date=${selectedDate}`);
            if (res.ok) {
                const data = await res.json();
                setGaugeReadings(data);
            }
        } catch (error) {
            console.error('Error fetching gauge readings:', error);
        }
    };

    const saveGaugeReading = async (tankNumber: number, type: 'start' | 'end') => {
        const key = `${tankNumber}-${type}`;
        const value = newGaugeValues[key];
        if (!value) return;

        try {
            const res = await fetch(`/api/gas-station/${id}/gauge`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: selectedDate,
                    tankNumber,
                    type, // 'start' or 'end'
                    percentage: parseFloat(value),
                }),
            });
            if (res.ok) {
                setNewGaugeValues(prev => ({ ...prev, [key]: '' }));
                fetchGaugeReadings();
                alert(`บันทึกเกจ${type === 'start' ? 'เริ่มต้น' : 'สิ้นสุด'}ถังที่ ${tankNumber} เรียบร้อย`);
            } else {
                const err = await res.json();
                alert(`ไม่สามารถบันทึกได้: ${err.error || 'เกิดข้อผิดพลาด'}`);
            }
        } catch (error) {
            console.error('Error saving gauge reading:', error);
            alert('เกิดข้อผิดพลาดในการบันทึก');
        }
    };

    // Fetch gauge readings from previous day (end percentages)
    const fetchPreviousGauge = async () => {
        try {
            const prevDate = new Date(selectedDate);
            prevDate.setDate(prevDate.getDate() - 1);
            const prevDateStr = prevDate.toISOString().split('T')[0];

            const res = await fetch(`/api/gas-station/${id}/gauge?date=${prevDateStr}`);
            if (res.ok) {
                const data = await res.json();
                // Return end percentages from previous day
                return data;
            }
            return null;
        } catch (error) {
            console.error('Error fetching previous gauge:', error);
            return null;
        }
    };

    // Copy gauge from previous day (end -> start for new day)
    const copyGaugeFromPreviousDay = async () => {
        const prevGauges = await fetchPreviousGauge();
        if (prevGauges && Array.isArray(prevGauges)) {
            const newValues: Record<string, string> = {};
            let copied = false;
            prevGauges.forEach((g: { tankNumber: number; endPercentage: number | null }) => {
                if (g.endPercentage !== null) {
                    // Copy end percentage from previous day to start of current day
                    newValues[`${g.tankNumber}-start`] = g.endPercentage.toString();
                    copied = true;
                }
            });
            if (copied) {
                setNewGaugeValues(prev => ({ ...prev, ...newValues }));
                alert('📋 คัดลอกเกจสิ้นสุดจากวันก่อนมาเป็นเกจเริ่มต้นวันนี้');
            } else {
                alert('⚠️ ไม่พบข้อมูลเกจสิ้นสุดของวันก่อน');
            }
        } else {
            alert('⚠️ ไม่พบข้อมูลเกจของวันก่อน');
        }
    };

    // Save all gauges by type (start or end) in one click
    const saveAllGaugesByType = async (type: 'start' | 'end') => {
        let savedCount = 0;
        let errorCount = 0;

        for (const tankNum of [1, 2, 3]) {
            const key = `${tankNum}-${type}`;
            const value = newGaugeValues[key];
            if (value) {
                try {
                    const res = await fetch(`/api/gas-station/${id}/gauge`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            date: selectedDate,
                            tankNumber: tankNum,
                            type,
                            percentage: parseFloat(value),
                        }),
                    });
                    if (res.ok) {
                        savedCount++;
                    } else {
                        errorCount++;
                    }
                } catch {
                    errorCount++;
                }
            }
        }

        if (savedCount > 0) {
            // Clear inputs and refresh
            const clearedValues = { ...newGaugeValues };
            [1, 2, 3].forEach(t => { clearedValues[`${t}-${type}`] = ''; });
            setNewGaugeValues(clearedValues);
            fetchGaugeReadings();
            alert(`✅ บันทึกเกจ${type === 'start' ? 'เริ่มต้น' : 'สิ้นสุด'} ${savedCount} ถังสำเร็จ${errorCount > 0 ? ` (ล้มเหลว ${errorCount})` : ''}`);
        } else {
            alert('⚠️ กรุณากรอกค่าเกจก่อนบันทึก');
        }
    };

    // Save All Data (Admin only) - meters + gauges in one click
    const saveAllData = async () => {
        if (!isAdmin) return;

        setSavingAll(true);
        let savedCount = 0;
        let errorCount = 0;

        try {
            // 1. Save start meters
            for (const m of meters) {
                if (m.start > 0) {
                    try {
                        await fetch(`/api/gas-station/${id}/meters`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                date: selectedDate,
                                shiftNumber: currentShift,
                                nozzleNumber: m.nozzle,
                                type: 'start',
                                reading: m.start,
                            }),
                        });
                        savedCount++;
                    } catch { errorCount++; }
                }
            }

            // 2. Save end meters
            for (const m of meters) {
                if (m.end > 0) {
                    try {
                        await fetch(`/api/gas-station/${id}/meters`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                date: selectedDate,
                                shiftNumber: currentShift,
                                nozzleNumber: m.nozzle,
                                type: 'end',
                                reading: m.end,
                            }),
                        });
                        savedCount++;
                    } catch { errorCount++; }
                }
            }

            // 3. Save gauge readings
            for (const tankNum of [1, 2, 3]) {
                const startKey = `${tankNum}-start`;
                const endKey = `${tankNum}-end`;

                if (newGaugeValues[startKey]) {
                    try {
                        await fetch(`/api/gas-station/${id}/gauge`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                date: selectedDate,
                                tankNumber: tankNum,
                                type: 'start',
                                percentage: parseFloat(newGaugeValues[startKey]),
                            }),
                        });
                        savedCount++;
                    } catch { errorCount++; }
                }

                if (newGaugeValues[endKey]) {
                    try {
                        await fetch(`/api/gas-station/${id}/gauge`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                date: selectedDate,
                                tankNumber: tankNum,
                                type: 'end',
                                percentage: parseFloat(newGaugeValues[endKey]),
                            }),
                        });
                        savedCount++;
                    } catch { errorCount++; }
                }
            }

            // Clear gauge inputs and refresh
            setNewGaugeValues({});
            fetchGaugeReadings();
            fetchShiftData();

            alert(`✅ บันทึกสำเร็จ ${savedCount} รายการ${errorCount > 0 ? ` (ล้มเหลว ${errorCount})` : ''}`);
        } catch (error) {
            console.error('Error saving all data:', error);
            alert('❌ เกิดข้อผิดพลาด');
        } finally {
            setSavingAll(false);
        }
    };

    // Calculate revenue from transactions
    const calculateRevenue = () => {
        const cashTotal = transactions.filter(t => t.paymentType === 'CASH').reduce((s, t) => s + Number(t.amount), 0);
        const creditTotal = transactions.filter(t => t.paymentType === 'CREDIT').reduce((s, t) => s + Number(t.amount), 0);
        const cardTotal = transactions.filter(t => t.paymentType === 'CREDIT_CARD').reduce((s, t) => s + Number(t.amount), 0);
        const transferTotal = transactions.filter(t => t.paymentType === 'TRANSFER').reduce((s, t) => s + Number(t.amount), 0);
        const boxTruckTotal = transactions.filter(t => t.paymentType === 'BOX_TRUCK').reduce((s, t) => s + Number(t.amount), 0);

        const totalLiters = transactions.reduce((s, t) => s + Number(t.liters), 0);
        const grandTotal = cashTotal + creditTotal + cardTotal + transferTotal + boxTruckTotal;

        // Calculate from meters
        const meterTotal = meters.reduce((s, m) => s + (m.end - m.start), 0);
        const meterRevenue = meterTotal * gasPrice;

        return {
            cashTotal,
            creditTotal,
            cardTotal,
            transferTotal,
            boxTruckTotal,
            grandTotal,
            totalLiters,
            meterTotal,
            meterRevenue,
            difference: meterRevenue - grandTotal,
            transactionCount: transactions.length
        };
    };

    // Open shift with start meters
    const handleOpenShift = async () => {
        if (!currentShift) {
            alert('กรุณาเลือกกะก่อน');
            return;
        }

        const metersData = [1, 2, 3, 4].map(nozzle => ({
            nozzleNumber: nozzle,
            startReading: shiftMeterInputs[nozzle] || 0
        }));

        try {
            const res = await fetch(`/api/gas-station/${id}/shifts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    shiftNumber: currentShift,
                    meters: metersData,
                    dateStr: selectedDate,
                }),
            });

            if (res.ok) {
                const data = await res.json();
                alert(`✅ เปิด${currentShift === 1 ? 'กะเช้า' : 'กะบ่าย'}สำเร็จ!`);
                setShowOpenShiftModal(false);
                fetchShiftData();
            } else {
                const error = await res.json();
                alert(error.error || 'เกิดข้อผิดพลาด');
            }
        } catch (error) {
            console.error('Error opening shift:', error);
            alert('เกิดข้อผิดพลาดในการเปิดกะ');
        }
    };

    // Close shift with end meters
    const handleCloseShift = async () => {
        if (!shiftData?.shifts || !currentShift) return;

        const myShift = shiftData.shifts.find((s: any) => s.shiftNumber === currentShift);
        if (!myShift) {
            alert('ไม่พบกะที่เปิดอยู่');
            return;
        }

        const metersData = [1, 2, 3, 4].map(nozzle => ({
            nozzleNumber: nozzle,
            endReading: shiftMeterInputs[nozzle] || 0
        }));

        try {
            const res = await fetch(`/api/gas-station/${id}/shifts/${myShift.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ meters: metersData }),
            });

            if (res.ok) {
                const data = await res.json();
                alert(`✅ ปิด${currentShift === 1 ? 'กะเช้า' : 'กะบ่าย'}สำเร็จ!\n\nรวมลิตรขาย: ${data.totalLitersSold?.toLocaleString('th-TH')} ลิตร`);
                setShowCloseShiftModal(false);
                fetchShiftData();
            } else {
                const error = await res.json();
                alert(error.error || 'เกิดข้อผิดพลาด');
            }
        } catch (error) {
            console.error('Error closing shift:', error);
            alert('เกิดข้อผิดพลาดในการปิดกะ');
        }
    };

    const saveMeters = async (type: 'start' | 'end') => {
        try {
            const res = await fetch(`/api/gas-station/${id}/meters`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: selectedDate,
                    type,
                    meters: meters.map(m => ({
                        nozzleNumber: m.nozzle,
                        reading: type === 'start' ? m.start : m.end,
                        photo: type === 'start' ? m.startPhoto : m.endPhoto,
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

    const handleMeterPhotoUpload = async (nozzle: number, type: 'start' | 'end', file: File) => {
        const uploadKey = `${nozzle}-${type}`;
        setUploadingPhoto(uploadKey);

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('type', type);
            formData.append('nozzle', String(nozzle));
            formData.append('date', selectedDate);

            const res = await fetch('/api/upload/meter-photo', {
                method: 'POST',
                body: formData,
            });

            if (res.ok) {
                const data = await res.json();
                const newMeters = [...meters];
                const meterIndex = newMeters.findIndex(m => m.nozzle === nozzle);
                if (meterIndex !== -1) {
                    if (type === 'start') {
                        newMeters[meterIndex].startPhoto = data.url;
                    } else {
                        newMeters[meterIndex].endPhoto = data.url;
                    }
                    setMeters(newMeters);
                }
            }
        } catch (error) {
            console.error('Error uploading photo:', error);
        } finally {
            setUploadingPhoto(null);
        }
    };

    // Enter key navigation sequence
    // มิเตอร์เริ่มต้น 1-2-3-4 → เกจเริ่มต้น 1-2-3 → มิเตอร์สิ้นสุด 1-2-3-4 → เกจสิ้นสุด 1-2-3
    const inputSequence = [
        'meter-start-1', 'meter-start-2', 'meter-start-3', 'meter-start-4',
        'gauge-start-1', 'gauge-start-2', 'gauge-start-3',
        'meter-end-1', 'meter-end-2', 'meter-end-3', 'meter-end-4',
        'gauge-end-1', 'gauge-end-2', 'gauge-end-3',
    ];

    const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, currentId: string) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const currentIndex = inputSequence.indexOf(currentId);
            if (currentIndex !== -1 && currentIndex < inputSequence.length - 1) {
                const nextId = inputSequence[currentIndex + 1];
                const nextInput = document.getElementById(nextId) as HTMLInputElement;
                if (nextInput) {
                    nextInput.focus();
                    nextInput.select();
                }
            }
        }
    };

    const handleSubmitTransaction = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            const res = await fetch(`/api/gas-station/${id}/transactions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: selectedDate,
                    licensePlate,
                    ownerName,
                    ownerId,
                    paymentType,
                    nozzleNumber,
                    liters: parseFloat(liters),
                    pricePerLiter: gasPrice,
                    amount: parseFloat(liters) * gasPrice,
                    productType: 'LPG',
                }),
            });

            if (res.ok) {
                setLicensePlate('');
                setOwnerName('');
                setOwnerId(null);
                setLiters('');
                fetchDailyData();
            }
        } catch (error) {
            console.error('Error saving transaction:', error);
        }
    };

    const handleAddGasSupply = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            // Convert KG to liters: KG × 1.85
            const litersFromKg = parseFloat(supplyKg) * KG_TO_LITERS;

            const res = await fetch(`/api/gas-station/${id}/supplies`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: selectedDate,
                    liters: litersFromKg,
                    kilograms: parseFloat(supplyKg), // Store original KG too
                    supplier: supplySupplier || null,
                    invoiceNo: supplyInvoiceNo || null,
                }),
            });
            if (res.ok) {
                setShowSupplyForm(false);
                setSupplyKg('');
                setSupplySupplier('');
                setSupplyInvoiceNo('');
                fetchDailyData();
                alert(`บันทึกการรับแก๊ส ${supplyKg} กก. = ${litersFromKg.toFixed(2)} ลิตร เรียบร้อย`);
            }
        } catch (error) {
            console.error('Error adding gas supply:', error);
        }
    };

    // Product inventory functions
    const fetchProductInventory = async () => {
        try {
            const [invRes, prodRes] = await Promise.all([
                fetch(`/api/gas-station/${id}/products`),
                fetch('/api/products')
            ]);
            if (invRes.ok) {
                setProductInventory(await invRes.json());
            }
            if (prodRes.ok) {
                setAllProducts(await prodRes.json());
            }
        } catch (error) {
            console.error('Error fetching product inventory:', error);
        }
    };

    const handleAddProductToStation = async () => {
        if (!selectedProductId) return;
        try {
            const res = await fetch(`/api/gas-station/${id}/products`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'add_to_inventory',
                    productId: selectedProductId,
                    quantity: 0,
                }),
            });
            if (res.ok) {
                setShowAddProductForm(false);
                setSelectedProductId('');
                fetchProductInventory();
            }
        } catch (error) {
            console.error('Error adding product:', error);
        }
    };

    const handleSellProduct = async (productId: string) => {
        const qty = sellQuantity[productId] || 0;
        if (qty <= 0) return;
        try {
            const res = await fetch(`/api/gas-station/${id}/products`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'sell',
                    productId,
                    quantity: qty,
                    paymentType: 'CASH',
                }),
            });
            if (res.ok) {
                setSellQuantity(prev => ({ ...prev, [productId]: 0 }));
                fetchProductInventory();
            } else {
                const error = await res.json();
                alert(error.error);
            }
        } catch (error) {
            console.error('Error selling product:', error);
        }
    };

    const handleReceiveProduct = async (productId: string) => {
        const qty = receiveQuantity[productId] || 0;
        if (qty <= 0) return;
        try {
            const res = await fetch(`/api/gas-station/${id}/products`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'receive',
                    productId,
                    quantity: qty,
                }),
            });
            if (res.ok) {
                setReceiveQuantity(prev => ({ ...prev, [productId]: 0 }));
                fetchProductInventory();
            }
        } catch (error) {
            console.error('Error receiving product:', error);
        }
    };

    const filteredTransactions = transactions.filter(t => {
        if (activeFilter === 'all') return true;
        return t.paymentType === activeFilter;
    });

    const meterTotal = meters.reduce((sum, m) => sum + (m.end - m.start), 0);
    const transactionsTotal = transactions.reduce((sum, t) => sum + Number(t.liters), 0);
    const meterDiff = transactionsTotal - meterTotal;

    const formatNumber = (num: number) => new Intl.NumberFormat('th-TH').format(num);
    const formatCurrency = (num: number) => new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2 }).format(num);

    const calculateAmount = () => {
        const qty = parseFloat(liters) || 0;
        return qty * gasPrice;
    };

    if (!station || !isGasStation) {
        return (
            <Sidebar>
                <div className="text-center py-20">
                    <p className="text-gray-400">ไม่พบสถานีแก๊ส</p>
                </div>
            </Sidebar>
        );
    }

    return (
        <Sidebar>
            <div className="max-w-6xl mx-auto relative">
                {/* Background orbs */}
                <div className="fixed top-20 right-20 w-[400px] h-[400px] rounded-full opacity-20 blur-3xl pointer-events-none"
                    style={{ background: 'radial-gradient(circle, rgba(6, 182, 212, 0.3) 0%, transparent 70%)' }} />

                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-2xl blur-lg opacity-50" />
                            <div className="relative p-3 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-500">
                                <Fuel className="text-white" size={28} />
                            </div>
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-white via-cyan-200 to-white bg-clip-text text-transparent">
                                {station.name}
                            </h1>
                            <p className="text-gray-400 flex items-center gap-2">
                                <Sparkles size={14} className="text-cyan-400" />
                                ⛽ ปั๊มแก๊ส LPG
                                {currentShift && (
                                    <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${currentShift === 1
                                        ? 'bg-orange-500/20 text-orange-400'
                                        : 'bg-indigo-500/20 text-indigo-400'
                                        }`}>
                                        {currentShift === 0 ? '📅 กะทั้งวัน' : currentShift === 1 ? '🌅 กะเช้า' : '🌙 กะบ่าย'}
                                    </span>
                                )}
                            </p>
                        </div>
                    </div>

                    {/* Shift Controls */}
                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Shift Selector Dropdown */}
                        <div className="flex items-center gap-2">
                            <span className="text-gray-400 text-sm">กะ:</span>
                            <select
                                value={currentShift || ''}
                                onChange={(e) => {
                                    const val = e.target.value ? parseInt(e.target.value) : null;
                                    setCurrentShift(val);
                                    if (val) {
                                        localStorage.setItem('selectedShift', val.toString());
                                    }
                                    // Reset meters when switching shifts (avoid data spillover)
                                    setMeters([
                                        { nozzle: 1, start: 0, end: 0 },
                                        { nozzle: 2, start: 0, end: 0 },
                                        { nozzle: 3, start: 0, end: 0 },
                                        { nozzle: 4, start: 0, end: 0 },
                                    ]);
                                    // Refresh shift data
                                    fetchShiftData();
                                }}
                                className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            >
                                <option value="" className="bg-gray-800">เลือกกะ</option>
                                <option value="0" className="bg-gray-800">📅 กะทั้งวัน</option>
                                <option value="1" className="bg-gray-800">🌅 กะเช้า (กะ 1)</option>
                                <option value="2" className="bg-gray-800">🌙 กะบ่าย (กะ 2)</option>
                            </select>

                            {/* Show shift status */}
                            {shiftData?.shifts && shiftData.shifts.length > 0 && (
                                <div className="flex gap-1">
                                    {shiftData.shifts.map((s: any) => (
                                        <span
                                            key={s.id}
                                            className={`px-2 py-0.5 text-xs rounded-full ${s.status === 'OPEN'
                                                ? 'bg-green-500/20 text-green-400'
                                                : 'bg-gray-500/20 text-gray-400'
                                                }`}
                                        >
                                            กะ{s.shiftNumber}: {s.status === 'OPEN' ? 'เปิด' : 'ปิด'}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        {currentShift && (
                            <>

                                {/* Admin: Save All Button */}
                                {isAdmin && (
                                    <button
                                        onClick={saveAllData}
                                        disabled={savingAll}
                                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:opacity-90 transition-all flex items-center gap-2 text-sm disabled:opacity-50"
                                        title="บันทึกมิเตอร์และเกจทั้งหมด"
                                    >
                                        {savingAll ? (
                                            <span className="animate-spin">⏳</span>
                                        ) : (
                                            <Save size={16} />
                                        )}
                                        💾 บันทึกทั้งหมด
                                    </button>
                                )}

                                {/* Admin: View Revenue Summary */}
                                {isAdmin && (
                                    <button
                                        onClick={() => setShowRevenueSummary(true)}
                                        className="px-4 py-2 rounded-xl bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/30 transition-all flex items-center gap-2 text-sm"
                                        title="ดูสรุปยอดขาย"
                                    >
                                        💰 สรุปยอด
                                    </button>
                                )}

                                {/* Check if shift is open */}
                                {shiftData?.shifts?.find((s: any) => s.shiftNumber === currentShift && s.status === 'OPEN') ? (
                                    <button
                                        onClick={() => setShowCloseShiftModal(true)}
                                        className="px-4 py-2 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-all flex items-center gap-2 text-sm"
                                    >
                                        <Clock size={16} />
                                        ปิดกะ
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => setShowOpenShiftModal(true)}
                                        className="px-4 py-2 rounded-xl bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30 transition-all flex items-center gap-2 text-sm"
                                    >
                                        <Clock size={16} />
                                        เปิดกะ
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setShowDailySummary(true)}
                            className="relative group px-5 py-2.5 rounded-xl font-semibold text-white overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-cyan-600 to-blue-600" />
                            <div className="absolute inset-0 bg-gradient-to-r from-cyan-600 to-blue-600 blur-xl opacity-50 group-hover:opacity-70 transition-opacity" />
                            <span className="relative flex items-center gap-2">
                                <FileText size={18} />
                                สรุปงานประจำวัน
                            </span>
                        </button>
                        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10">
                            <Calendar size={18} className="text-cyan-400" />
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
                        {/* Stock Alert */}
                        {currentStock < stockAlert && (
                            <div className="bg-red-900/30 border border-red-500/50 rounded-xl p-4 mb-6 flex items-center gap-3">
                                <AlertTriangle className="text-red-400" size={24} />
                                <div>
                                    <p className="font-medium text-red-400">⚠️ แก๊สใกล้หมด!</p>
                                    <p className="text-sm text-gray-400">คงเหลือ {formatNumber(currentStock)} ลิตร (ต่ำกว่า {formatNumber(stockAlert)} ลิตร)</p>
                                </div>
                            </div>
                        )}

                        {/* Gas Price & Stock Summary */}
                        <div className="grid md:grid-cols-3 gap-6 mb-6">
                            {/* Gas Price */}
                            <div className="glass-card p-6">
                                <h2 className="text-lg font-bold text-white mb-4">💰 ราคาแก๊ส LPG</h2>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={gasPrice}
                                        onChange={(e) => setGasPrice(parseFloat(e.target.value))}
                                        className="input-glow text-center text-2xl font-mono flex-1"
                                    />
                                    <span className="text-gray-400">บาท/ลิตร</span>
                                </div>
                                <button onClick={saveGasPrice} className="btn btn-primary w-full mt-4">
                                    <Save size={18} />
                                    บันทึกราคา
                                </button>
                            </div>

                            {/* Current Stock */}
                            <div className="glass-card p-6">
                                <h2 className="text-lg font-bold text-white mb-4">⛽ สต็อกแก๊สคงเหลือ</h2>

                                {/* Calculated Stock */}
                                <div className="mb-4">
                                    <p className="text-sm text-gray-400 mb-1">จากการคำนวณ (รับ-ขาย):</p>
                                    <p className={`text-3xl font-bold font-mono ${currentStock < stockAlert ? 'text-red-400' : 'text-cyan-400'}`}>
                                        {formatNumber(currentStock)} <span className="text-sm text-gray-400">ลิตร</span>
                                    </p>
                                </div>

                                {/* Gauge-based Estimation */}
                                <div className="bg-yellow-900/20 rounded-lg p-3 mb-4">
                                    <p className="text-sm text-gray-400 mb-1">จากเกจ 3 ถัง (ถัง×98):</p>
                                    {(() => {
                                        const totalPercentage = gaugeReadings.reduce((sum, g) => sum + (g.endPercentage || 0), 0);
                                        const gaugeEstimate = totalPercentage * TANK_CAPACITY_LITERS;
                                        const difference = gaugeEstimate - currentStock;
                                        return (
                                            <>
                                                <p className="text-xl font-bold font-mono text-yellow-400">
                                                    ({gaugeReadings.map(g => g.endPercentage || 0).join('% + ')}%) × 98
                                                </p>
                                                <p className="text-2xl font-bold font-mono text-yellow-400">
                                                    = {formatNumber(gaugeEstimate)} <span className="text-sm">ลิตร</span>
                                                </p>
                                                {Math.abs(difference) > 10 && (
                                                    <p className={`text-xs mt-1 ${difference > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                        ต่าง {difference > 0 ? '+' : ''}{formatNumber(difference)} ลิตร
                                                    </p>
                                                )}
                                            </>
                                        );
                                    })()}
                                </div>

                                {isAdmin && (
                                    <button
                                        onClick={() => setShowSupplyForm(true)}
                                        className="btn btn-success w-full"
                                    >
                                        <Plus size={18} />
                                        รับแก๊สเข้า (KG)
                                    </button>
                                )}
                            </div>

                            {/* Today Summary */}
                            <div className="glass-card p-6">
                                <h2 className="text-lg font-bold text-white mb-4">📊 สรุปวันนี้</h2>
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">ยอดขาย:</span>
                                        <span className="font-mono text-cyan-400">{formatNumber(transactionsTotal)} ลิตร</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">รายได้:</span>
                                        <span className="font-mono text-green-400">{formatCurrency(transactions.reduce((s, t) => s + Number(t.amount), 0))} บาท</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">รายการ:</span>
                                        <span className="font-mono">{transactions.length} รายการ</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Gauge Readings (3 Tanks) */}
                        <div className="glass-card p-6 mb-6">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                    <Gauge className="text-yellow-400" />
                                    📊 เกจถังแก๊ส (3 ถัง) - เปรียบเทียบกับมิเตอร์
                                </h2>
                                <button
                                    onClick={copyGaugeFromPreviousDay}
                                    className="btn btn-info btn-sm"
                                    title="คัดลอกเกจสิ้นสุดจากวันก่อน"
                                >
                                    📋 ดึงเกจวันก่อน
                                </button>
                            </div>
                            <div className="grid md:grid-cols-3 gap-4">
                                {[1, 2, 3].map(tankNum => {
                                    const reading = gaugeReadings.find(g => g.tankNumber === tankNum);
                                    const usedLiters = reading && reading.startPercentage !== null && reading.endPercentage !== null
                                        ? (reading.startPercentage - reading.endPercentage) * TANK_CAPACITY_LITERS / 100
                                        : null;
                                    return (
                                        <div key={tankNum} className="bg-white/5 rounded-xl p-4">
                                            <h3 className="font-bold text-yellow-400 mb-3">ถังที่ {tankNum}</h3>

                                            {/* Start Gauge */}
                                            <div className="mb-3">
                                                <div className="flex justify-between text-sm mb-1">
                                                    <span className="text-gray-400">🌅 เริ่มต้น:</span>
                                                    <span className="text-cyan-400 font-mono">
                                                        {reading?.startPercentage !== null ? `${reading?.startPercentage}%` : '-'}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        id={`gauge-start-${tankNum}`}
                                                        type="number"
                                                        min="0"
                                                        max="100"
                                                        step="1"
                                                        value={newGaugeValues[`${tankNum}-start`] || ''}
                                                        onChange={(e) => setNewGaugeValues(prev => ({
                                                            ...prev,
                                                            [`${tankNum}-start`]: e.target.value
                                                        }))}
                                                        onKeyDown={(e) => handleInputKeyDown(e, `gauge-start-${tankNum}`)}
                                                        placeholder="0-100%"
                                                        className="input-glow flex-1 text-center text-sm"
                                                    />
                                                </div>
                                            </div>

                                            {/* End Gauge */}
                                            <div className="mb-3">
                                                <div className="flex justify-between text-sm mb-1">
                                                    <span className="text-gray-400">🌙 สิ้นสุด:</span>
                                                    <span className={`font-mono ${reading?.endPercentage !== null && (reading?.endPercentage ?? 100) < 20 ? 'text-red-400' : 'text-green-400'}`}>
                                                        {reading?.endPercentage !== null ? `${reading?.endPercentage}%` : '-'}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        id={`gauge-end-${tankNum}`}
                                                        type="number"
                                                        min="0"
                                                        max="100"
                                                        step="1"
                                                        value={newGaugeValues[`${tankNum}-end`] || ''}
                                                        onChange={(e) => setNewGaugeValues(prev => ({
                                                            ...prev,
                                                            [`${tankNum}-end`]: e.target.value
                                                        }))}
                                                        onKeyDown={(e) => handleInputKeyDown(e, `gauge-end-${tankNum}`)}
                                                        placeholder="0-100%"
                                                        className="input-glow flex-1 text-center text-sm"
                                                    />
                                                </div>
                                            </div>

                                            {/* Used liters from this tank */}
                                            {usedLiters !== null && (
                                                <div className="bg-purple-500/10 rounded-lg p-2 text-center">
                                                    <span className="text-xs text-gray-400">ใช้ไป: </span>
                                                    <span className="font-mono text-purple-400 font-bold">
                                                        {formatNumber(usedLiters)} ลิตร
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Save Gauge Buttons */}
                            <div className="flex gap-3 mt-4">
                                <button
                                    onClick={() => saveAllGaugesByType('start')}
                                    className="btn btn-info flex-1"
                                >
                                    <Save size={16} />
                                    บันทึกเกจเริ่มต้น (3 ถัง)
                                </button>
                                <button
                                    onClick={() => saveAllGaugesByType('end')}
                                    className="btn btn-success flex-1"
                                >
                                    <Save size={16} />
                                    บันทึกเกจสิ้นสุด (3 ถัง)
                                </button>
                            </div>

                            {/* Total comparison with meters */}
                            {(() => {
                                const totalStartGauge = gaugeReadings.reduce((s, g) => s + (g.startPercentage || 0), 0);
                                const totalEndGauge = gaugeReadings.reduce((s, g) => s + (g.endPercentage || 0), 0);
                                const totalGaugeUsed = ((totalStartGauge - totalEndGauge) / 100) * TANK_CAPACITY_LITERS * 3;
                                const metersTotal = meters.reduce((s, m) => s + (m.end - m.start), 0);
                                const difference = metersTotal - totalGaugeUsed;

                                if (totalStartGauge > 0 && totalEndGauge > 0) {
                                    return (
                                        <div className="mt-4 bg-white/5 rounded-xl p-4">
                                            <h4 className="font-bold text-white mb-3">📈 เปรียบเทียบ</h4>
                                            <div className="grid grid-cols-3 gap-4 text-center">
                                                <div>
                                                    <div className="text-gray-400 text-sm">จากเกจ (ใช้ไป)</div>
                                                    <div className="text-xl font-bold font-mono text-yellow-400">{formatNumber(totalGaugeUsed)} ลิตร</div>
                                                </div>
                                                <div>
                                                    <div className="text-gray-400 text-sm">จากมิเตอร์ (ขาย)</div>
                                                    <div className="text-xl font-bold font-mono text-cyan-400">{formatNumber(metersTotal)} ลิตร</div>
                                                </div>
                                                <div>
                                                    <div className="text-gray-400 text-sm">ผลต่าง</div>
                                                    <div className={`text-xl font-bold font-mono ${Math.abs(difference) < 10 ? 'text-green-400' : 'text-red-400'}`}>
                                                        {difference > 0 ? '+' : ''}{formatNumber(difference)} ลิตร
                                                    </div>
                                                </div>
                                            </div>
                                            {Math.abs(difference) >= 10 && (
                                                <div className="mt-2 text-center text-red-400 text-sm">
                                                    ⚠️ ผลต่างมากกว่า 10 ลิตร - ตรวจสอบข้อมูล
                                                </div>
                                            )}
                                        </div>
                                    );
                                }
                                return null;
                            })()}
                        </div>

                        {/* Gas Supply Form (Modal) */}
                        {showSupplyForm && (
                            <div className="glass-card p-6 mb-6 border-2 border-cyan-500/50">
                                <h3 className="font-bold text-cyan-400 mb-4">📦 รับแก๊สเข้าสต็อก (Admin Only)</h3>
                                <form onSubmit={handleAddGasSupply} className="space-y-4">
                                    <div className="grid md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm text-gray-400 mb-2">จำนวน (กิโลกรัม)</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={supplyKg}
                                                onChange={(e) => setSupplyKg(e.target.value)}
                                                className="input-glow text-center font-mono w-full"
                                                placeholder="เช่น 1000"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm text-gray-400 mb-2">แปลงเป็นลิตร (× 1.85)</label>
                                            <div className="bg-green-900/30 p-3 rounded-lg text-center">
                                                <span className="text-2xl font-bold text-green-400 font-mono">
                                                    {supplyKg ? (parseFloat(supplyKg) * KG_TO_LITERS).toFixed(2) : '0.00'}
                                                </span>
                                                <span className="text-gray-400 ml-2">ลิตร</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="grid md:grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-sm text-gray-400 mb-2">ผู้ส่ง</label>
                                            <input
                                                type="text"
                                                value={supplySupplier}
                                                onChange={(e) => setSupplySupplier(e.target.value)}
                                                className="input-glow"
                                                placeholder="ชื่อซัพพลายเออร์"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm text-gray-400 mb-2">เลขที่ใบส่ง</label>
                                            <input
                                                type="text"
                                                value={supplyInvoiceNo}
                                                onChange={(e) => setSupplyInvoiceNo(e.target.value)}
                                                className="input-glow"
                                                placeholder="Invoice No."
                                            />
                                        </div>
                                        <div className="flex items-end gap-2">
                                            <button type="submit" className="btn btn-success flex-1">
                                                <Save size={18} />
                                                บันทึก
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setShowSupplyForm(false)}
                                                className="btn btn-secondary"
                                            >
                                                ยกเลิก
                                            </button>
                                        </div>
                                    </div>
                                </form>
                            </div>
                        )}

                        {/* Meter Readings */}
                        <div className="grid md:grid-cols-2 gap-6 mb-6">
                            {/* Start Meters */}
                            <div className="glass-card p-6">
                                <h3 className="font-bold text-white mb-4">📟 มิเตอร์เริ่มต้น (4 หัวจ่าย)</h3>
                                <div className="space-y-3">
                                    {meters.map((m, i) => (
                                        <div key={i} className="flex items-center gap-2">
                                            <span className="text-cyan-400 w-16 text-sm">หัว {m.nozzle}</span>
                                            <input
                                                id={`meter-start-${m.nozzle}`}
                                                type="number"
                                                value={m.start}
                                                onChange={(e) => {
                                                    const newMeters = [...meters];
                                                    newMeters[i].start = parseFloat(e.target.value) || 0;
                                                    setMeters(newMeters);
                                                }}
                                                onKeyDown={(e) => handleInputKeyDown(e, `meter-start-${m.nozzle}`)}
                                                className="input-glow text-center font-mono flex-1"
                                            />
                                            <label className={`cursor-pointer p-2 rounded-lg transition-all ${m.startPhoto ? 'bg-green-600 text-white' : 'bg-white/10 text-gray-400 hover:bg-white/20'
                                                }`}>
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    capture="environment"
                                                    className="hidden"
                                                    onChange={(e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file) handleMeterPhotoUpload(m.nozzle, 'start', file);
                                                    }}
                                                />
                                                {uploadingPhoto === `${m.nozzle}-start` ? (
                                                    <span className="animate-spin">⏳</span>
                                                ) : m.startPhoto ? (
                                                    <CheckCircle size={18} />
                                                ) : (
                                                    <Camera size={18} />
                                                )}
                                            </label>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex gap-2 mt-4">
                                    <button
                                        onClick={copyFromPreviousShift}
                                        className="btn btn-info flex-1"
                                        title="คัดลอกมิเตอร์สิ้นสุดของกะก่อนหน้า"
                                    >
                                        📋 ดึงจากกะก่อน
                                    </button>
                                    <button onClick={() => saveMeters('start')} className="btn btn-success flex-1">
                                        <Save size={18} />
                                        บันทึก
                                    </button>
                                </div>
                            </div>

                            {/* End Meters */}
                            <div className="glass-card p-6">
                                <h3 className="font-bold text-white mb-4">📟 มิเตอร์สิ้นสุด (4 หัวจ่าย)</h3>
                                <div className="space-y-3">
                                    {meters.map((m, i) => (
                                        <div key={i} className="flex items-center gap-2">
                                            <span className="text-cyan-400 w-16 text-sm">หัว {m.nozzle}</span>
                                            <input
                                                id={`meter-end-${m.nozzle}`}
                                                type="number"
                                                value={m.end}
                                                onChange={(e) => {
                                                    const newMeters = [...meters];
                                                    newMeters[i].end = parseFloat(e.target.value) || 0;
                                                    setMeters(newMeters);
                                                }}
                                                onKeyDown={(e) => handleInputKeyDown(e, `meter-end-${m.nozzle}`)}
                                                className="input-glow text-center font-mono flex-1"
                                            />
                                            <label className={`cursor-pointer p-2 rounded-lg transition-all ${m.endPhoto ? 'bg-green-600 text-white' : 'bg-white/10 text-gray-400 hover:bg-white/20'
                                                }`}>
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    capture="environment"
                                                    className="hidden"
                                                    onChange={(e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file) handleMeterPhotoUpload(m.nozzle, 'end', file);
                                                    }}
                                                />
                                                {uploadingPhoto === `${m.nozzle}-end` ? (
                                                    <span className="animate-spin">⏳</span>
                                                ) : m.endPhoto ? (
                                                    <CheckCircle size={18} />
                                                ) : (
                                                    <Camera size={18} />
                                                )}
                                            </label>
                                        </div>
                                    ))}
                                </div>
                                <button onClick={() => saveMeters('end')} className="btn btn-success w-full mt-4">
                                    <Save size={18} />
                                    บันทึกมิเตอร์สิ้นสุด
                                </button>
                            </div>
                        </div>

                        {/* Meter Verification */}
                        <div className="glass-card p-6 mb-6">
                            <h2 className="text-lg font-bold text-white mb-4">📊 ตรวจสอบยอดมิเตอร์</h2>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="text-center p-4 bg-cyan-900/20 rounded-xl">
                                    <p className="text-sm text-gray-400">ยอดรวมมิเตอร์</p>
                                    <p className="text-2xl font-bold text-cyan-400">{formatNumber(meterTotal)}</p>
                                    <p className="text-sm text-gray-400">ลิตร</p>
                                    <p className="text-lg font-bold text-yellow-400 mt-2">{formatCurrency(meterTotal * gasPrice)}</p>
                                    <p className="text-xs text-gray-500">({gasPrice} บาท/ลิตร)</p>
                                </div>
                                <div className="text-center p-4 bg-green-900/20 rounded-xl">
                                    <p className="text-sm text-gray-400">ยอดขายจริง</p>
                                    <p className="text-2xl font-bold text-green-400">{formatNumber(transactionsTotal)}</p>
                                    <p className="text-sm text-gray-400">ลิตร</p>
                                    <p className="text-lg font-bold text-yellow-400 mt-2">{formatCurrency(transactions.reduce((s, t) => s + Number(t.amount), 0))}</p>
                                    <p className="text-xs text-gray-500">จากรายการ</p>
                                </div>
                                <div className={`text-center p-4 rounded-xl ${Math.abs(meterDiff) < 1 ? 'bg-green-900/20' : 'bg-red-900/20'}`}>
                                    <p className="text-sm text-gray-400">ผลต่าง</p>
                                    <p className={`text-2xl font-bold ${Math.abs(meterDiff) < 1 ? 'text-green-400' : 'text-red-400'}`}>
                                        {meterDiff > 0 ? '+' : ''}{formatNumber(meterDiff)}
                                    </p>
                                    <p className="text-sm text-gray-400">ลิตร</p>
                                    <p className={`text-lg font-bold mt-2 ${Math.abs(meterDiff) < 1 ? 'text-green-400' : 'text-red-400'}`}>
                                        {meterDiff > 0 ? '+' : ''}{formatCurrency(meterDiff * gasPrice)}
                                    </p>
                                    {Math.abs(meterDiff) >= 1 ? (
                                        <p className="text-xs text-red-400 flex items-center justify-center gap-1 mt-1">
                                            <AlertTriangle size={12} />
                                            ยอดไม่ตรงกัน
                                        </p>
                                    ) : (
                                        <p className="text-xs text-green-400 flex items-center justify-center gap-1 mt-1">
                                            <CheckCircle size={12} />
                                            ตรงกัน
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Product Inventory Section (only for stations with hasProducts) */}
                        {hasProducts && (
                            <div className="glass-card p-6 mb-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                        <Package className="text-blue-400" size={20} />
                                        📦 สินค้าคงเหลือ (น้ำดื่ม ฯลฯ)
                                    </h2>
                                    <button
                                        onClick={() => setShowAddProductForm(!showAddProductForm)}
                                        className="btn btn-primary btn-sm"
                                    >
                                        <Plus size={16} />
                                        เพิ่มสินค้า
                                    </button>
                                </div>

                                {/* Add Product Form */}
                                {showAddProductForm && (
                                    <div className="p-4 bg-blue-900/20 rounded-lg mb-4">
                                        <div className="flex items-center gap-4">
                                            <select
                                                value={selectedProductId}
                                                onChange={(e) => setSelectedProductId(e.target.value)}
                                                className="input-glow flex-1"
                                            >
                                                <option value="">เลือกสินค้า...</option>
                                                {allProducts
                                                    .filter(p => !productInventory.find(pi => pi.productId === p.id))
                                                    .map(p => (
                                                        <option key={p.id} value={p.id}>
                                                            {p.name} - {formatCurrency(p.salePrice)} บาท/{p.unit}
                                                        </option>
                                                    ))
                                                }
                                            </select>
                                            <button
                                                onClick={handleAddProductToStation}
                                                className="btn btn-success"
                                                disabled={!selectedProductId}
                                            >
                                                เพิ่ม
                                            </button>
                                            <button
                                                onClick={() => setShowAddProductForm(false)}
                                                className="btn btn-secondary"
                                            >
                                                ยกเลิก
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Product Inventory Table */}
                                {productInventory.length === 0 ? (
                                    <p className="text-center text-gray-400 py-6">ยังไม่มีสินค้าในสต็อก</p>
                                ) : (
                                    <div className="space-y-3">
                                        {productInventory.map((item) => (
                                            <div
                                                key={item.id}
                                                className={`p-4 rounded-xl ${item.alertLevel && item.quantity <= item.alertLevel ? 'bg-red-900/20 border border-red-500/50' : 'bg-white/5'}`}
                                            >
                                                <div className="flex items-center justify-between mb-3">
                                                    <div>
                                                        <h3 className="font-bold text-white">{item.product.name}</h3>
                                                        <p className="text-sm text-gray-400">
                                                            ราคา: {formatCurrency(item.product.salePrice)} บาท/{item.product.unit}
                                                        </p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className={`text-2xl font-bold font-mono ${item.alertLevel && item.quantity <= item.alertLevel ? 'text-red-400' : 'text-blue-400'}`}>
                                                            {item.quantity}
                                                        </p>
                                                        <p className="text-sm text-gray-400">{item.product.unit}</p>
                                                    </div>
                                                </div>
                                                <div className="flex flex-wrap gap-4 items-center">
                                                    {/* Sell */}
                                                    <div className="flex items-center gap-2 flex-1">
                                                        <input
                                                            type="number"
                                                            value={sellQuantity[item.productId] || ''}
                                                            onChange={(e) => setSellQuantity(prev => ({ ...prev, [item.productId]: parseInt(e.target.value) || 0 }))}
                                                            placeholder="จำนวน"
                                                            className="input-glow w-20 text-center"
                                                            min="0"
                                                        />
                                                        <button
                                                            onClick={() => handleSellProduct(item.productId)}
                                                            className="btn btn-success btn-sm"
                                                            disabled={!sellQuantity[item.productId]}
                                                        >
                                                            ขาย
                                                        </button>
                                                    </div>
                                                    {/* Receive */}
                                                    <div className="flex items-center gap-2 flex-1">
                                                        <input
                                                            type="number"
                                                            value={receiveQuantity[item.productId] || ''}
                                                            onChange={(e) => setReceiveQuantity(prev => ({ ...prev, [item.productId]: parseInt(e.target.value) || 0 }))}
                                                            placeholder="จำนวน"
                                                            className="input-glow w-20 text-center"
                                                            min="0"
                                                        />
                                                        <button
                                                            onClick={() => handleReceiveProduct(item.productId)}
                                                            className="btn btn-primary btn-sm"
                                                            disabled={!receiveQuantity[item.productId]}
                                                        >
                                                            รับเข้า
                                                        </button>
                                                    </div>
                                                </div>
                                                {item.alertLevel && item.quantity <= item.alertLevel && (
                                                    <p className="text-xs text-red-400 mt-2 flex items-center gap-1">
                                                        <AlertTriangle size={12} />
                                                        สินค้าใกล้หมด! (ต่ำกว่า {item.alertLevel} {item.product.unit})
                                                    </p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Transaction Form */}
                        <div className="glass-card p-6 mb-6">
                            <h2 className="text-lg font-bold text-white mb-4">📝 บันทึกการขายแก๊ส</h2>

                            {/* Payment Type Buttons */}
                            <div className="mb-4">
                                <label className="block text-sm text-gray-400 mb-2">ประเภทการชำระ</label>
                                <div className="flex flex-wrap gap-2">
                                    {GAS_PAYMENT_TYPES.map(pt => (
                                        <button
                                            key={pt.value}
                                            onClick={() => setPaymentType(pt.value)}
                                            className={`payment-type-btn ${pt.value.toLowerCase().replace('_', '')} ${paymentType === pt.value ? 'active' : ''}`}
                                        >
                                            {pt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <form onSubmit={handleSubmitTransaction} className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-2">หัวจ่าย</label>
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

                                    <div>
                                        <label className="block text-sm text-gray-400 mb-2">ทะเบียนรถ</label>
                                        <div className="relative" ref={dropdownRef}>
                                            <input
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
                                                placeholder="พิมพ์ทะเบียน..."
                                                className="input-glow"
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
                                                        searchResults.map((truck) => (
                                                            <button
                                                                key={truck.id}
                                                                type="button"
                                                                onClick={() => selectTruck(truck)}
                                                                className="w-full px-4 py-3 text-left hover:bg-cyan-500/30 border-b border-white/20 last:border-b-0 transition-colors bg-slate-900/50"
                                                            >
                                                                <p className="font-mono text-cyan-300 font-bold text-base">{truck.licensePlate}</p>
                                                                <p className="text-sm text-yellow-300 font-medium">{truck.ownerName}</p>
                                                            </button>
                                                        ))
                                                    ) : !searchLoading && licensePlate.length >= 2 ? (
                                                        <div className="p-3">
                                                            <p className="text-yellow-400 text-sm mb-2">⚠️ ไม่พบทะเบียน "{licensePlate}"</p>
                                                            <p className="text-gray-400 text-xs">กรุณาตรวจสอบทะเบียนอีกครั้ง หรือเพิ่มทะเบียนใหม่ที่หน้า "รถ"</p>
                                                        </div>
                                                    ) : null}
                                                </div>
                                            )}
                                        </div>
                                        {ownerName && (
                                            <p className="text-xs text-cyan-400 mt-1">
                                                <User size={12} className="inline mr-1" />
                                                {ownerName}
                                            </p>
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-sm text-gray-400 mb-2">จำนวน (ลิตร)</label>
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

                                    <div>
                                        <label className="block text-sm text-gray-400 mb-2">รวมเป็นเงิน</label>
                                        <div className="input-glow text-xl font-mono text-center bg-cyan-900/30 text-cyan-400">
                                            {formatCurrency(calculateAmount())} บาท
                                        </div>
                                    </div>
                                </div>

                                {/* Staff Selector */}
                                {(() => {
                                    const stationStaff = STATION_STAFF[`station-${id}` as keyof typeof STATION_STAFF];
                                    if (stationStaff && stationStaff.staff.length > 0) {
                                        return (
                                            <div className="bg-cyan-900/20 rounded-xl p-3 border border-cyan-500/30">
                                                <label className="block text-sm text-cyan-400 mb-2 font-medium">
                                                    👷 พนักงานที่เติม
                                                </label>
                                                <div className="flex flex-wrap gap-2">
                                                    {stationStaff.staff.map((name) => (
                                                        <button
                                                            key={name}
                                                            type="button"
                                                            onClick={() => setStaffName(staffName === name ? '' : name)}
                                                            className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${staffName === name
                                                                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg'
                                                                : 'bg-white/10 text-gray-300 hover:bg-white/20'
                                                                }`}
                                                        >
                                                            {name}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    }
                                    return null;
                                })()}

                                <button type="submit" className="btn btn-success w-full">
                                    <Save size={20} />
                                    บันทึกการขาย
                                </button>
                            </form>
                        </div>

                        {/* Transactions List */}
                        <div className="glass-card p-6">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                                <h2 className="text-lg font-bold text-white">📋 รายการขายวันนี้</h2>
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        onClick={() => setActiveFilter('all')}
                                        className={`badge ${activeFilter === 'all' ? 'badge-purple' : 'badge-gray'}`}
                                    >
                                        ทั้งหมด
                                    </button>
                                    {GAS_PAYMENT_TYPES.map(pt => (
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
                                            <th>ทะเบียน</th>
                                            <th>เจ้าของ</th>
                                            <th>หัวจ่าย</th>
                                            <th>ประเภท</th>
                                            <th>ลิตร</th>
                                            <th>ราคา/ลิตร</th>
                                            <th>รวมเงิน</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredTransactions.length === 0 ? (
                                            <tr>
                                                <td colSpan={9} className="text-center py-8 text-gray-400">
                                                    ไม่มีรายการ
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredTransactions.map((t, i) => {
                                                const paymentInfo = GAS_PAYMENT_TYPES.find(pt => pt.value === t.paymentType);
                                                return (
                                                    <tr key={t.id}>
                                                        <td>{i + 1}</td>
                                                        <td>{new Date(t.date).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</td>
                                                        <td className="font-mono text-cyan-400">{t.licensePlate || '-'}</td>
                                                        <td>{t.ownerName || '-'}</td>
                                                        <td className="text-center">{t.nozzleNumber}</td>
                                                        <td>
                                                            <span className={`badge ${paymentInfo?.color.replace('bg-', 'badge-').replace('-600', '')}`}>
                                                                {paymentInfo?.label}
                                                            </span>
                                                        </td>
                                                        <td className="font-mono text-right">{formatNumber(Number(t.liters))}</td>
                                                        <td className="font-mono text-right">{Number(t.pricePerLiter).toFixed(2)}</td>
                                                        <td className="font-mono text-right text-green-400">{formatCurrency(Number(t.amount))}</td>
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
                            <div className="bg-white/5 rounded-xl p-4">
                                <h3 className="font-bold text-cyan-400 mb-3">📟 มิเตอร์หัวจ่าย</h3>
                                <div className="grid grid-cols-4 gap-2 text-sm">
                                    <div className="font-bold text-gray-400">หัว</div>
                                    <div className="font-bold text-gray-400 text-right">เริ่มต้น</div>
                                    <div className="font-bold text-gray-400 text-right">สิ้นสุด</div>
                                    <div className="font-bold text-gray-400 text-right">ขาย</div>
                                    {meters.map(m => (
                                        <>
                                            <div key={`label-${m.nozzle}`} className="text-cyan-400">หัว {m.nozzle}</div>
                                            <div key={`start-${m.nozzle}`} className="font-mono text-right">{formatNumber(m.start)}</div>
                                            <div key={`end-${m.nozzle}`} className="font-mono text-right">{formatNumber(m.end)}</div>
                                            <div key={`diff-${m.nozzle}`} className="font-mono text-right text-green-400">{formatNumber(m.end - m.start)}</div>
                                        </>
                                    ))}
                                    <div className="font-bold text-white border-t border-white/10 pt-2">รวม</div>
                                    <div className="font-mono text-right border-t border-white/10 pt-2">{formatNumber(meters.reduce((s, m) => s + m.start, 0))}</div>
                                    <div className="font-mono text-right border-t border-white/10 pt-2">{formatNumber(meters.reduce((s, m) => s + m.end, 0))}</div>
                                    <div className="font-mono text-right border-t border-white/10 pt-2 text-green-400 font-bold">{formatNumber(transactionsTotal)}</div>
                                </div>
                            </div>

                            {/* Gauge Summary */}
                            <div className="bg-white/5 rounded-xl p-4">
                                <h3 className="font-bold text-yellow-400 mb-3">📊 เกจถังแก๊ส</h3>
                                <div className="grid grid-cols-4 gap-4">
                                    {gaugeReadings.map(g => (
                                        <div key={g.tankNumber} className="text-center">
                                            <div className="text-sm text-gray-400">ถัง {g.tankNumber}</div>
                                            <div className="text-xl font-bold font-mono text-yellow-400">
                                                {g.endPercentage !== null ? `${g.endPercentage}%` : '-'}
                                            </div>
                                        </div>
                                    ))}
                                    <div className="text-center">
                                        <div className="text-sm text-gray-400">รวม ×98</div>
                                        <div className="text-xl font-bold font-mono text-yellow-400">
                                            {formatNumber(gaugeReadings.reduce((s, g) => s + (g.endPercentage || 0), 0) * TANK_CAPACITY_LITERS)} ลิตร
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Transaction Summary */}
                            <div className="bg-white/5 rounded-xl p-4">
                                <h3 className="font-bold text-green-400 mb-3">💰 สรุปรายได้</h3>
                                <div className="space-y-2">
                                    {(() => {
                                        const cashTotal = transactions.filter(t => t.paymentType === 'CASH').reduce((s, t) => s + Number(t.amount), 0);
                                        const creditTotal = transactions.filter(t => t.paymentType === 'CREDIT').reduce((s, t) => s + Number(t.amount), 0);
                                        const transferTotal = transactions.filter(t => t.paymentType === 'TRANSFER').reduce((s, t) => s + Number(t.amount), 0);
                                        const cardTotal = transactions.filter(t => t.paymentType === 'CREDIT_CARD').reduce((s, t) => s + Number(t.amount), 0);
                                        const total = transactions.reduce((s, t) => s + Number(t.amount), 0);
                                        return (
                                            <>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-400">💵 เงินสด:</span>
                                                    <span className="font-mono text-green-400">{formatCurrency(cashTotal)} บาท</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-400">💳 เงินเชื่อ:</span>
                                                    <span className="font-mono text-orange-400">{formatCurrency(creditTotal)} บาท</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-400">📲 โอนเงิน:</span>
                                                    <span className="font-mono text-blue-400">{formatCurrency(transferTotal)} บาท</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-400">💳 บัตรเครดิต:</span>
                                                    <span className="font-mono text-purple-400">{formatCurrency(cardTotal)} บาท</span>
                                                </div>
                                                <div className="flex justify-between border-t border-white/10 pt-2 mt-2">
                                                    <span className="font-bold text-white">รวมทั้งหมด:</span>
                                                    <span className="font-mono font-bold text-green-400 text-lg">{formatCurrency(total)} บาท</span>
                                                </div>
                                            </>
                                        );
                                    })()}
                                </div>
                            </div>

                            {/* Transaction Count */}
                            <div className="bg-white/5 rounded-xl p-4">
                                <h3 className="font-bold text-purple-400 mb-3">📈 สถิติ</h3>
                                <div className="grid grid-cols-3 gap-4 text-center">
                                    <div>
                                        <div className="text-2xl font-bold text-white">{transactions.length}</div>
                                        <div className="text-sm text-gray-400">รายการ</div>
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold text-cyan-400">{formatNumber(transactionsTotal)}</div>
                                        <div className="text-sm text-gray-400">ลิตร</div>
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold text-green-400">{formatNumber(currentStock)}</div>
                                        <div className="text-sm text-gray-400">สต็อกคงเหลือ</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Revenue Summary Modal */}
            {showRevenueSummary && (
                <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
                    <div className="bg-[#0f0f1a] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-white/10">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-6 border-b border-white/10">
                            <div>
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    💰 สรุปยอดขาย
                                </h2>
                                <p className="text-gray-400 text-sm mt-1">
                                    {new Date(selectedDate).toLocaleDateString('th-TH', {
                                        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                                    })} | กะที่ {currentShift || '-'}
                                </p>
                            </div>
                            <button
                                onClick={() => setShowRevenueSummary(false)}
                                className="p-2 rounded-lg hover:bg-white/10 text-gray-400"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6 space-y-4">
                            {(() => {
                                const revenue = calculateRevenue();
                                return (
                                    <>
                                        {/* From Transactions */}
                                        <div className="bg-white/5 rounded-xl p-4">
                                            <h3 className="font-bold text-cyan-400 mb-3">📊 จากรายการขาย ({revenue.transactionCount} รายการ)</h3>
                                            <div className="space-y-2 text-sm">
                                                <div className="flex justify-between">
                                                    <span className="text-gray-400">💵 เงินสด:</span>
                                                    <span className="font-mono text-green-400 font-bold">{formatCurrency(revenue.cashTotal)} บาท</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-400">💳 เงินเชื่อ:</span>
                                                    <span className="font-mono text-orange-400 font-bold">{formatCurrency(revenue.creditTotal)} บาท</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-400">📲 โอนเงิน:</span>
                                                    <span className="font-mono text-blue-400 font-bold">{formatCurrency(revenue.transferTotal)} บาท</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-400">💳 บัตรเครดิต:</span>
                                                    <span className="font-mono text-purple-400 font-bold">{formatCurrency(revenue.cardTotal)} บาท</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-400">🚛 รถกล่อง:</span>
                                                    <span className="font-mono text-pink-400 font-bold">{formatCurrency(revenue.boxTruckTotal)} บาท</span>
                                                </div>
                                                <div className="border-t border-white/20 pt-2 mt-2 flex justify-between">
                                                    <span className="font-bold text-white">รวมทั้งหมด:</span>
                                                    <span className="font-mono text-yellow-400 font-bold text-lg">{formatCurrency(revenue.grandTotal)} บาท</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-400">ลิตรรวม:</span>
                                                    <span className="font-mono text-cyan-400">{formatNumber(revenue.totalLiters)} ลิตร</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* From Meters */}
                                        <div className="bg-white/5 rounded-xl p-4">
                                            <h3 className="font-bold text-green-400 mb-3">📟 จากมิเตอร์</h3>
                                            <div className="space-y-2 text-sm">
                                                <div className="flex justify-between">
                                                    <span className="text-gray-400">ลิตรจากมิเตอร์:</span>
                                                    <span className="font-mono text-green-400 font-bold">{formatNumber(revenue.meterTotal)} ลิตร</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-400">ยอด × ราคา ({gasPrice} บาท):</span>
                                                    <span className="font-mono text-green-400 font-bold">{formatCurrency(revenue.meterRevenue)} บาท</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Difference */}
                                        <div className={`rounded-xl p-4 ${Math.abs(revenue.difference) < 10 ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
                                            <h3 className={`font-bold mb-2 ${Math.abs(revenue.difference) < 10 ? 'text-green-400' : 'text-red-400'}`}>
                                                📈 เปรียบเทียบ
                                            </h3>
                                            <div className="flex justify-between items-center">
                                                <span className="text-gray-400">ผลต่าง (มิเตอร์ - ขาย):</span>
                                                <span className={`font-mono font-bold text-xl ${Math.abs(revenue.difference) < 10 ? 'text-green-400' : 'text-red-400'}`}>
                                                    {revenue.difference > 0 ? '+' : ''}{formatCurrency(revenue.difference)} บาท
                                                </span>
                                            </div>
                                            {Math.abs(revenue.difference) >= 10 && (
                                                <p className="text-xs text-red-400 mt-2">
                                                    ⚠️ ผลต่างมากกว่า 10 บาท - ตรวจสอบข้อมูล
                                                </p>
                                            )}
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            )}
        </Sidebar>
    );
}
