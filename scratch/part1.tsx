'use client';

import { useState, useEffect, use, useRef } from 'react';
import Sidebar from '@/components/Sidebar';
import Breadcrumb from '@/components/Breadcrumb';
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
    Clock,
    DollarSign,
    Banknote,
    Receipt,
    LogOut
} from 'lucide-react';
import { GAS_PAYMENT_TYPES, STATIONS, DEFAULT_GAS_PRICE, STATION_STAFF, GAS_TANK_CAPACITY_LITERS, KG_TO_LITERS_CONVERSION, DEFAULT_STOCK_ALERT, NOZZLE_COUNT, TANK_COUNT } from '@/constants';
import type { ShiftDataResponse, Shift, GaugeReading as GaugeReadingType } from '@/types/gas-station';

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

    // Gas supply form - input in KG, convert using KG_TO_LITERS_CONVERSION to liters
    const [showSupplyForm, setShowSupplyForm] = useState(false);
    const [supplyKg, setSupplyKg] = useState('');
    const [supplySupplier, setSupplySupplier] = useState('');
    const [supplyInvoiceNo, setSupplyInvoiceNo] = useState('');

    // Stock calculation
    const [currentStock, setCurrentStock] = useState(0);
    const [stockAlert, setStockAlert] = useState(DEFAULT_STOCK_ALERT);

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
    const [shiftData, setShiftData] = useState<ShiftDataResponse | null>(null);
    const [showOpenShiftModal, setShowOpenShiftModal] = useState(false);
    const [showCloseShiftModal, setShowCloseShiftModal] = useState(false);
    const [shiftMeterInputs, setShiftMeterInputs] = useState<Record<number, number>>({});
    const [previousShiftMeters, setPreviousShiftMeters] = useState<Record<number, number> | null>(null);
    const [hasCarryOver, setHasCarryOver] = useState(false); // Track if data was carried over

    // Daily summary modal
    const [showDailySummary, setShowDailySummary] = useState(false);

    // Revenue summary modal
    const [showRevenueSummary, setShowRevenueSummary] = useState(false);

    // Save all loading state
    const [savingAll, setSavingAll] = useState(false);

    // Daily cash total (instead of per-transaction)
    const [dailyCashTotal, setDailyCashTotal] = useState<string>('');
    const [otherExpenses, setOtherExpenses] = useState<string>('');
    const [expenseNotes, setExpenseNotes] = useState<string>('');

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

    // Copy meters from previous shift (copy end readings to current start readings)
    const copyFromPreviousShift = async () => {
        const prevMeters = await fetchPreviousShift();
        if (prevMeters) {
            // Copy to meters state (start values)
            setMeters(prev => prev.map(m => ({
                ...m,
                start: prevMeters[m.nozzle] ?? m.start
            })));
            setHasCarryOver(true); // Mark as carried over
            alert('📋 คัดลอกมิเตอร์สิ้นสุดจากกะก่อน → มิเตอร์เริ่มต้นวันนี้');
        } else {
            alert('⚠️ ไม่พบข้อมูลกะก่อนหน้า (อาจยังไม่ได้บันทึก)');
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
            const res = await fetch(`/api/gas-station/${id}/daily?date=${selectedDate}&shift=${currentShift || 0}`);
            if (res.ok) {
                const data = await res.json();
                setDailyRecord(data.dailyRecord);
                setTransactions(data.transactions || []);
                setGasSupplies(data.gasSupplies || []);
                setCurrentStock(data.currentStock || 0);
                if (data.dailyRecord) {
                    setGasPrice(data.dailyRecord.gasPrice || DEFAULT_GAS_PRICE);

                    // Use shift-specific meters if a shift is selected and has data
                    // Otherwise fall back to dailyRecord.meters (legacy/all-day view)
                    const metersSource = (currentShift && currentShift > 0 && data.currentShift?.meters?.length > 0)
                        ? data.currentShift.meters
                        : data.dailyRecord.meters;

                    if (metersSource && metersSource.length > 0) {
                        setMeters(metersSource.map((m: MeterReading) => ({
                            nozzle: m.nozzleNumber,
                            start: Number(m.startReading),
                            end: Number(m.endReading) || 0,
                        })));
                    } else {
                        // Reset meters when no data exists
                        setMeters([
                            { nozzle: 1, start: 0, end: 0 },
                            { nozzle: 2, start: 0, end: 0 },
                            { nozzle: 3, start: 0, end: 0 },
                            { nozzle: 4, start: 0, end: 0 },
                        ]);
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
            const res = await fetch(`/api/gas-station/${id}/gauge?date=${selectedDate}&shift=${currentShift || 0}`);
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
                    shiftNumber: currentShift || 0,
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
                            shiftNumber: currentShift || 0,
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
                                shiftNumber: currentShift || 0,
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
                                shiftNumber: currentShift || 0,
                            }),
                        });
                        savedCount++;
                    } catch { errorCount++; }
                }
            }

            // Clear gauge inputs and refresh all data
            setNewGaugeValues({});
            fetchDailyData();
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
    // allDayMeter parameter allows using all-day meter total instead of current shift only
    const calculateRevenue = (allDayMeter?: number) => {
        const cashTotal = transactions.filter(t => t.paymentType === 'CASH').reduce((s, t) => s + Number(t.amount), 0);
        const creditTotal = transactions.filter(t => t.paymentType === 'CREDIT').reduce((s, t) => s + Number(t.amount), 0);
        const cardTotal = transactions.filter(t => t.paymentType === 'CREDIT_CARD').reduce((s, t) => s + Number(t.amount), 0);
        const transferTotal = transactions.filter(t => t.paymentType === 'TRANSFER').reduce((s, t) => s + Number(t.amount), 0);
        const boxTruckTotal = transactions.filter(t => t.paymentType === 'BOX_TRUCK').reduce((s, t) => s + Number(t.amount), 0);

        const totalLiters = transactions.reduce((s, t) => s + Number(t.liters), 0);
        const grandTotal = cashTotal + creditTotal + cardTotal + transferTotal + boxTruckTotal;

        // Use allDayMeter if provided, otherwise calculate from current shift meters
        const meterTotal = allDayMeter ?? meters.reduce((s, m) => s + (m.end - m.start), 0);
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
        // Get the shift ID for the currently selected shift
        const selectedShiftData = shiftData?.shifts?.find(s => s.shiftNumber === currentShift);
        const shiftId = selectedShiftData?.id || null;

        try {
            const res = await fetch(`/api/gas-station/${id}/meters`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: selectedDate,
                    type,
                    shiftId, // Include shiftId for shift-based storage
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
            } else {
                const err = await res.json();
                alert(err.error || 'ไม่สามารถบันทึกมิเตอร์ได้');
            }
        } catch (error) {
            console.error('Error saving meters:', error);
            alert('เกิดข้อผิดพลาดในการบันทึกมิเตอร์');
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
            const litersFromKg = parseFloat(supplyKg) * KG_TO_LITERS_CONVERSION;

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

    // Calculate meter total from current shift selection
    const currentShiftMeterTotal = meters.reduce((sum, m) => sum + (m.end - m.start), 0);

    // Calculate ALL-DAY meter total from all shifts (for verification section)
    // This ensures verification shows correct data even when viewing a shift without meters
    const allDayMeterTotal = (() => {
        if (!shiftData?.shifts || shiftData.shifts.length === 0) {
            return currentShiftMeterTotal;
        }

        let total = 0;
        for (const shift of shiftData.shifts) {
            if (shift.meters && shift.meters.length > 0) {
                for (const m of shift.meters) {
                    const start = Number(m.startReading) || 0;
                    const end = Number(m.endReading) || 0;
                    total += (end - start);
                }
            }
        }
        return total > 0 ? total : currentShiftMeterTotal;
    })();

    // Use meterTotal for display in current shift view
    const meterTotal = currentShiftMeterTotal;
    // Use allDayMeterTotal for verification (comparing with transactions)
    const transactionsTotal = transactions.reduce((sum, t) => sum + Number(t.liters), 0);
    const meterDiff = transactionsTotal - allDayMeterTotal;

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
