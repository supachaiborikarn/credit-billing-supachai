import LegacySimpleStationSellPage from './LegacySimpleStationSellPage';
import { getRetiredSimpleStationRedirect } from '@/lib/stations/legacy-route-retirement';
import { redirect } from 'next/navigation';

export default async function SimpleStationSellPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const retiredRedirect = getRetiredSimpleStationRedirect(id);

    if (retiredRedirect) {
        redirect(retiredRedirect);
    }

    return <LegacySimpleStationSellPage params={Promise.resolve({ id })} />;
}
