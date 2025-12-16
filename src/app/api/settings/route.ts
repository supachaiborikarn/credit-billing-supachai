import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET all settings
export async function GET() {
    try {
        const settings = await prisma.setting.findMany();

        // Convert to key-value object
        const settingsObj: Record<string, string> = {};
        settings.forEach((s: { key: string; value: string }) => {
            settingsObj[s.key] = s.value;
        });

        // Return with defaults if not set
        return NextResponse.json({
            // Diesel prices
            defaultRetailPrice: settingsObj['defaultRetailPrice'] || '31.34',
            defaultWholesalePrice: settingsObj['defaultWholesalePrice'] || '30.50',
            pricePowerDiesel: settingsObj['pricePowerDiesel'] || '37.50',

            // Benzin & Gasohol prices
            priceBenzin95: settingsObj['priceBenzin95'] || '42.16',
            priceGasohol95: settingsObj['priceGasohol95'] || '34.88',
            priceGasohol91: settingsObj['priceGasohol91'] || '34.38',
            priceGasoholE20: settingsObj['priceGasoholE20'] || '32.84',

            // Gas prices
            defaultGasPrice: settingsObj['defaultGasPrice'] || '15.50',

            // Gas station settings
            kgToLitersRate: settingsObj['kgToLitersRate'] || '1.85',
            tankCapacityPerPercent: settingsObj['tankCapacityPerPercent'] || '98',
            gasStockAlertLevel: settingsObj['gasStockAlertLevel'] || '1000',

            // Billing settings
            billingDueDays: settingsObj['billingDueDays'] || '15,30',
        });
    } catch (error) {
        console.error('Settings GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
    }
}

// POST update settings
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const updates: { key: string; value: string }[] = [];

        // Collect all settings to update
        const allowedKeys = [
            'defaultRetailPrice',
            'defaultWholesalePrice',
            'pricePowerDiesel',
            'priceBenzin95',
            'priceGasohol95',
            'priceGasohol91',
            'priceGasoholE20',
            'defaultGasPrice',
            'kgToLitersRate',
            'tankCapacityPerPercent',
            'gasStockAlertLevel',
            'billingDueDays',
        ];

        for (const key of allowedKeys) {
            if (body[key] !== undefined) {
                updates.push({ key, value: String(body[key]) });
            }
        }

        // Upsert each setting
        for (const { key, value } of updates) {
            await prisma.setting.upsert({
                where: { key },
                create: { key, value },
                update: { value },
            });
        }

        return NextResponse.json({ success: true, updated: updates.length });
    } catch (error) {
        console.error('Settings POST error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: 'Failed to save settings', details: errorMessage }, { status: 500 });
    }
}
