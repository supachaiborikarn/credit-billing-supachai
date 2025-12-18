import { getStartOfDayBangkok, getEndOfDayBangkok, createTransactionDate, formatDateBangkok, getTodayBangkok } from '../src/lib/date-utils';

console.log('=== TESTING DATE-UTILS ===\n');

const testDate = '2025-12-18';

console.log('Test date:', testDate);
console.log('---------------------');

const startOfDay = getStartOfDayBangkok(testDate);
const endOfDay = getEndOfDayBangkok(testDate);

console.log('startOfDay (Bangkok midnight → UTC):', startOfDay.toISOString());
console.log('endOfDay (Bangkok 23:59:59 → UTC):', endOfDay.toISOString());

// Test transactions
const testTxnDates = [
    '2025-12-18T04:37:31.000Z',  // 11:37 Bangkok - should match
    '2025-12-18T04:12:47.000Z',  // 11:12 Bangkok - should match
    '2025-12-17T16:59:59.000Z',  // 23:59 Bangkok Dec 17 - should NOT match
    '2025-12-18T17:00:00.000Z',  // 00:00 Bangkok Dec 19 - should NOT match
];

console.log('\n=== TRANSACTION DATE TESTS ===');
for (const txnDateStr of testTxnDates) {
    const txnDate = new Date(txnDateStr);
    const inRange = txnDate >= startOfDay && txnDate <= endOfDay;
    const bangkokTime = new Date(txnDate.getTime() + 7 * 60 * 60 * 1000);
    console.log(`${txnDateStr} (${bangkokTime.toISOString().replace('Z', ' BKK')}) -> ${inRange ? '✓ IN RANGE' : '✗ OUT OF RANGE'}`);
}

console.log('\n=== CURRENT TIME ===');
console.log('Today Bangkok:', getTodayBangkok());
console.log('Current transaction date:', createTransactionDate(testDate).toISOString());
console.log('Format test:', formatDateBangkok(new Date()));
