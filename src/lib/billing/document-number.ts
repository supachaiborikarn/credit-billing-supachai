function getBangkokDateParts(date: Date) {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Bangkok',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(date);
    const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return {
        year: value.year,
        month: value.month,
        day: value.day,
    };
}

export function buildInvoiceNumberPrefix(date: Date = new Date()) {
    const { year, month, day } = getBangkokDateParts(date);
    return `INV-${year}${month}${day}-`;
}

export function buildBillingCollectionNumberPrefix(date: Date = new Date()) {
    const { year, month } = getBangkokDateParts(date);
    return `BC-${year}-${month}`;
}
