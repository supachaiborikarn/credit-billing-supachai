import LegacyGasShiftOpenPage from './LegacyGasShiftOpenPage';
import { getActiveGasOperationsRedirect } from '@/lib/stations/legacy-route-retirement';
import { redirect } from 'next/navigation';

export default async function GasShiftOpenPage({ params }: { params: Promise<{ stationId: string }> }) {
    const { stationId } = await params;
    const canonicalRedirect = getActiveGasOperationsRedirect(stationId);

    if (canonicalRedirect) {
        redirect(canonicalRedirect);
    }

    return <LegacyGasShiftOpenPage />;
}
