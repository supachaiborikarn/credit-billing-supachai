import { redirect } from 'next/navigation';
import { getActiveGasOverviewRedirect } from '@/lib/stations/legacy-route-retirement';

export default async function LegacyGasStationPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    redirect(getActiveGasOverviewRedirect(id) || `/gas/${id}`);
}
