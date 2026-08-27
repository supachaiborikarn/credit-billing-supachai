import LegacyGasShiftClosePage from './LegacyGasShiftClosePage';
import { getActiveGasOperationsRedirect } from '@/lib/stations/legacy-route-retirement';
import { redirect } from 'next/navigation';

export default async function GasShiftClosePage({ params }: { params: Promise<{ stationId: string }> }) {
    const { stationId } = await params;
    const canonicalRedirect = getActiveGasOperationsRedirect(stationId);

    if (canonicalRedirect) {
        redirect(canonicalRedirect);
    }

    return <LegacyGasShiftClosePage />;
}
