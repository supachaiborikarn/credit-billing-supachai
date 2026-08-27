import LegacyGasSellPage from './LegacyGasSellPage';
import { getActiveGasSellRedirect } from '@/lib/stations/legacy-route-retirement';
import { redirect } from 'next/navigation';

export default async function GasSellPage({
    params,
}: {
    params: Promise<{ stationId: string }>;
}) {
    const { stationId } = await params;
    const retiredRedirect = getActiveGasSellRedirect(stationId);

    if (retiredRedirect) {
        redirect(retiredRedirect);
    }

    return <LegacyGasSellPage />;
}
