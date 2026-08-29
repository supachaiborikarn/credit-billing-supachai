import { redirect } from 'next/navigation';
import LegacyGasMetersPage from './LegacyGasMetersPage';
import { getActiveGasOperationsRedirect } from '@/lib/stations/legacy-route-retirement';

export default async function GasMetersRetirementPage({ params }: { params: Promise<{ stationId: string }> }) {
    const { stationId } = await params;
    const target = getActiveGasOperationsRedirect(stationId);
    if (target) redirect(target);
    return <LegacyGasMetersPage />;
}
