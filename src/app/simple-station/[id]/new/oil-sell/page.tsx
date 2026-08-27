import LegacySimpleStationOilSellPage from './LegacySimpleStationOilSellPage';
import { getRetiredSimpleStationRedirect } from '@/lib/stations/legacy-route-retirement';
import { redirect } from 'next/navigation';

export default async function OilSellPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const retiredRedirect = getRetiredSimpleStationRedirect(id);

    if (retiredRedirect) {
        redirect(retiredRedirect);
    }

    return <LegacySimpleStationOilSellPage params={Promise.resolve({ id })} />;
}
