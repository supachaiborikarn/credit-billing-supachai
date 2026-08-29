import { redirect } from 'next/navigation';
import LegacyGasGaugePage from './LegacyGasGaugePage';
import { getActiveGasOperationsRedirect } from '@/lib/stations/legacy-route-retirement';

export default async function GasGaugeRetirementPage({ params }: { params: Promise<{ stationId: string }> }) {
    const { stationId } = await params;
    const target = getActiveGasOperationsRedirect(stationId);
    if (target) redirect(target);
    return <LegacyGasGaugePage />;
}
