import { redirect } from 'next/navigation';
import LegacyGasStationHomePage from './LegacyGasStationHomePage';
import { getActiveGasOverviewRedirect } from '@/lib/stations/legacy-route-retirement';

export default async function GasStationHomePage({
    params,
}: {
    params: Promise<{ stationId: string }>;
}) {
    const { stationId } = await params;
    const canonicalRedirect = getActiveGasOverviewRedirect(stationId);

    if (canonicalRedirect) {
        redirect(canonicalRedirect);
    }

    return <LegacyGasStationHomePage />;
}
