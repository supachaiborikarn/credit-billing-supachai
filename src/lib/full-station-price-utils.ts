export interface FullStationDailyPriceRecord {
    retailPrice?: number | null;
    wholesalePrice?: number | null;
}

export interface FullStationDailyPriceForm {
    retailPrice: string;
    wholesalePrice: string;
}

export function createEmptyFullStationDailyPriceForm(): FullStationDailyPriceForm {
    return {
        retailPrice: '',
        wholesalePrice: '',
    };
}

export function buildFullStationDailyPriceForm(
    record?: FullStationDailyPriceRecord | null
): FullStationDailyPriceForm {
    return {
        retailPrice: record?.retailPrice ? Number(record.retailPrice).toString() : '',
        wholesalePrice: record?.wholesalePrice ? Number(record.wholesalePrice).toString() : '',
    };
}

export function parseFullStationDailyPriceForm(
    form: FullStationDailyPriceForm
): { retailPrice: number; wholesalePrice: number } {
    return {
        retailPrice: parseFloat(form.retailPrice) || 0,
        wholesalePrice: parseFloat(form.wholesalePrice) || 0,
    };
}

export function hasAnyFullStationDailyPrice(form: FullStationDailyPriceForm): boolean {
    const { retailPrice, wholesalePrice } = parseFullStationDailyPriceForm(form);
    return retailPrice > 0 || wholesalePrice > 0;
}

export function getFullStationPriceForPaymentType(
    paymentType: string,
    prices: { retailPrice: number; wholesalePrice: number }
): number {
    return paymentType === 'CASH' || paymentType === 'TRANSFER'
        ? prices.wholesalePrice
        : prices.retailPrice;
}
