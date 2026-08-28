import { redirect } from 'next/navigation';
import LegacyGasSummaryPage from './LegacyGasSummaryPage';
import { getActiveGasOverviewRedirect } from '@/lib/stations/legacy-route-retirement';

export default async function GasSummaryPage({
    params,
}: {
    params: Promise<{ stationId: string }>;
}) {
    const { stationId } = await params;
    const canonicalRedirect = getActiveGasOverviewRedirect(stationId);

    if (canonicalRedirect) redirect(canonicalRedirect);
    return <LegacyGasSummaryPage />;
}
