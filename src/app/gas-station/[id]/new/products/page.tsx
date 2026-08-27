import { redirect } from 'next/navigation';
import { resolveStationDefinition } from '@/lib/stations/station-context';

export default async function LegacyGasProductsPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const station = resolveStationDefinition(id);

    if (station?.type === 'GAS' && station.operationalStatus === 'ACTIVE') {
        if (station.hasProducts) {
            redirect(`/gas/${station.number}/products`);
        }
        redirect(`/stations/${station.id}`);
    }

    redirect(`/gas/${id}`);
}
