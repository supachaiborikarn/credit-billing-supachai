// Re-export typed constants with Thai labels and helper functions
export * from './payment-types';
export * from './user-roles';
export * from './owner-groups';
export * from './station-types';
export * from './status';
export * from './thresholds';

// Station types
export const STATIONS = [
    { id: 'station-1', name: 'แท๊งลอยวัชรเกียรติ', type: 'FULL' as const },
    { id: 'station-2', name: 'วัชรเกียรติออยล์', type: 'SIMPLE' as const },
    { id: 'station-3', name: 'พงษ์อนันต์ปิโตรเลียม', type: 'SIMPLE' as const },
    { id: 'station-4', name: 'ศุภชัยบริการ', type: 'SIMPLE' as const },
    { id: 'station-5', name: 'ปั๊มแก๊สพงษ์อนันต์', type: 'GAS' as const, hasProducts: true, aliases: ['d01b9c7b-fcf0-4185-a0b1-a5840391a61c'] },
    { id: 'station-6', name: 'ปั๊มแก๊สศุภชัย', type: 'GAS' as const, aliases: ['6950b69c-1841-4d22-a915-22141b94ca46'] },
] as const;

// Helper to find station index by id or alias
export const findStationIndex = (stationId: string): number => {
    const index = STATIONS.findIndex(s => {
        if (s.id === stationId) return true;
        if ('aliases' in s && s.aliases) {
            return (s.aliases as readonly string[]).includes(stationId);
        }
        return false;
    });
    return index >= 0 ? index + 1 : -1; // Return 1-based index
};

// Payment types
export const PAYMENT_TYPES = [
    { value: 'CREDIT', label: 'เงินเชื่อ', color: 'bg-purple-600' },
    { value: 'CASH', label: 'เงินสด', color: 'bg-green-600' },
    { value: 'TRANSFER', label: 'โอนเงิน', color: 'bg-blue-600' },
    { value: 'BOX_TRUCK', label: 'รถตู้ทึบ', color: 'bg-orange-600' },
    { value: 'OIL_TRUCK_SUPACHAI', label: 'รถน้ำมันศุภชัย', color: 'bg-red-600' },
    { value: 'CREDIT_CARD', label: 'บัตรเครดิต', color: 'bg-pink-600' },
] as const;

// Gas payment types (subset for gas stations)
export const GAS_PAYMENT_TYPES = [
    { value: 'CASH', label: 'เงินสด', color: 'bg-green-600' },
    { value: 'CREDIT', label: 'เงินเชื่อ', color: 'bg-purple-600' },
    { value: 'CREDIT_CARD', label: 'บัตรเครดิต', color: 'bg-pink-600' },
] as const;

// Product types
export const PRODUCT_TYPES = [
    'ดีเซล',
    'เบนซิน91',
    'เบนซิน95',
    'น้ำมันเครื่อง',
    'หัวเชื้อ',
    'LPG',
    'อื่นๆ',
] as const;

// Fuel types for billing (matching physical bill format)
export const FUEL_TYPES = [
    { value: 'DIESEL', label: 'น้ำมันดีเซล', defaultPrice: 30.50, color: 'bg-amber-500' },
    { value: 'GASOHOL_95', label: 'แก๊สโซฮอล์ 95', defaultPrice: 34.88, color: 'bg-green-500' },
    { value: 'GASOHOL_91', label: 'แก๊สโซฮอล์ 91', defaultPrice: 34.38, color: 'bg-blue-500' },
    { value: 'GASOHOL_E20', label: 'แก๊สโซฮอล์ E20', defaultPrice: 32.84, color: 'bg-teal-500' },
    { value: 'BENZIN_95', label: 'เบนซิน 95', defaultPrice: 42.16, color: 'bg-red-500' },
    { value: 'POWER_DIESEL', label: 'พาวเวอร์ดีเซล', defaultPrice: 37.50, color: 'bg-purple-500' },
    { value: 'LPG', label: 'แก๊ส LPG', defaultPrice: 15.50, color: 'bg-cyan-500' },
    // สินค้า (Products)
    { value: 'ENGINE_OIL', label: '🛢️ น้ำมันเครื่อง', defaultPrice: 0, color: 'bg-orange-500', isProduct: true },
    { value: 'COOLANT', label: '🧊 หัวเชื้อ/น้ำยาหล่อเย็น', defaultPrice: 0, color: 'bg-pink-500', isProduct: true },
    { value: 'OTHER_PRODUCT', label: '📦 สินค้าอื่นๆ', defaultPrice: 0, color: 'bg-gray-500', isProduct: true },
] as const;

// Owner groups
export const OWNER_GROUPS = [
    { value: 'SUGAR_FACTORY', label: 'โรงงานน้ำตาล' },
    { value: 'GENERAL_CREDIT', label: 'เงินเชื่อทั่วไป' },
    { value: 'BOX_TRUCK', label: 'รถตู้ทึบส่งโรงงาน' },
    { value: 'OIL_TRUCK', label: 'รถน้ำมันศุภชัย' },
] as const;

// Default prices
export const DEFAULT_RETAIL_PRICE = 31.34;
export const DEFAULT_WHOLESALE_PRICE = 30.5;
export const DEFAULT_GAS_PRICE = 16.09; // ราคาแก๊ส LPG ต่อลิตร

// Gas station constants (extracted from inline magic numbers)
export const GAS_TANK_CAPACITY_LITERS = 98; // Each LPG tank 100% = 98 liters
export const KG_TO_LITERS_CONVERSION = 1.85; // LPG: 1 kg = 1.85 liters
export const DEFAULT_STOCK_ALERT = 1000; // Alert when stock below 1000 liters
export const NOZZLE_COUNT = 4; // Number of fuel nozzles per station
export const TANK_COUNT = 3; // Number of LPG tanks per station

// Station staff configuration
export const STATION_STAFF = {
    'station-1': {
        name: 'แท๊งลอยวัชรเกียรติ',
        staff: ['วุฒิ', 'หญิง', 'ณัช'],
        allowConcurrentShifts: true, // พนักงานทำงานพร้อมกันได้
        maxShifts: 2,
    },
    'station-2': {
        name: 'วัชรเกียรติออยล์',
        staff: ['โส', 'แป้ง'],
        allowConcurrentShifts: false,
        maxShifts: 2, // กะเช้า, กะบ่าย
    },
    'station-3': {
        name: 'พงษ์อนันต์ปิโตรเลียม',
        staff: ['ติว', 'ดรีม', 'กาย'],
        allowConcurrentShifts: false,
        maxShifts: 2, // กะเช้า, กะบ่าย
    },
    'station-4': {
        name: 'ศุภชัยบริการ',
        staff: ['อ้อม', 'ใหม่', 'รงค์'],
        allowConcurrentShifts: false,
        maxShifts: 3, // กะเช้า, กะบ่าย, กะดึก
    },
    'station-5': {
        name: 'ปั๊มแก๊สพงษ์อนันต์',
        staff: ['กุ้ง', 'เล็ก'],
        allowConcurrentShifts: false,
        maxShifts: 2,
    },
    'station-6': {
        name: 'ปั๊มแก๊สศุภชัย',
        staff: ['เหน่ง', 'คนอง'],
        allowConcurrentShifts: false,
        maxShifts: 2,
    },
} as const;

// Get staff list by station ID
export const getStaffByStationId = (stationId: string): string[] => {
    const station = STATION_STAFF[stationId as keyof typeof STATION_STAFF];
    return station ? [...station.staff] : [];
};
