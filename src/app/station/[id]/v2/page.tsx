import { redirect } from 'next/navigation';
import LegacyTankStationV2Page from './LegacyTankStationV2Page';
import { getActiveFullHistoryRedirect } from '@/lib/stations/legacy-route-retirement';

export default async function TankStationV2Retirement({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const target = getActiveFullHistoryRedirect(id);
    if (target) redirect(target);

    return <LegacyTankStationV2Page params={Promise.resolve({ id })} />;
}
