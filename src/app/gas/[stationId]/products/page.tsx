import { redirect } from 'next/navigation';
import LegacyGasProductsPage from './LegacyGasProductsPage';

export default async function GasProductsRetirementPage({ params }: { params: Promise<{ stationId: string }> }) {
    const { stationId } = await params;
    if (stationId === '5') redirect('/stations/station-5/inventory');
    if (stationId === '6') redirect('/stations/station-6');
    return <LegacyGasProductsPage />;
}
