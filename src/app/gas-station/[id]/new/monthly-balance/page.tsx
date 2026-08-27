import { redirect } from 'next/navigation';
import { getActiveGasOverviewRedirect } from '@/lib/stations/legacy-route-retirement';

export default async function LegacyGasMonthlyBalancePage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const canonicalRedirect = getActiveGasOverviewRedirect(id);

    redirect(canonicalRedirect || `/gas/${id}`);
}
