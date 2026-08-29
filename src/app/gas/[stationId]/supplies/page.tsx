import { redirect } from 'next/navigation';
import LegacyGasSuppliesPage from './LegacyGasSuppliesPage';

export default async function GasSuppliesRetirementPage({ params }: { params: Promise<{ stationId: string }> }) {
    const { stationId } = await params;
    if (stationId === '5' || stationId === '6') {
        redirect(`/stations/station-${stationId}/inventory`);
    }
    return <LegacyGasSuppliesPage />;
}
