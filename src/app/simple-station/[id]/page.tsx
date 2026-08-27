import LegacySimpleStationPage from './LegacySimpleStationPage';
import { getRetiredSimpleStationRedirect } from '@/lib/stations/legacy-route-retirement';
import { redirect } from 'next/navigation';

export default async function SimpleStationPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const retiredRedirect = getRetiredSimpleStationRedirect(id);

    if (retiredRedirect) {
        redirect(retiredRedirect);
    }

    return <LegacySimpleStationPage id={id} />;
}
