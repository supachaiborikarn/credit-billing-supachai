import LegacySimpleStationOpenShiftPage from './LegacySimpleStationOpenShiftPage';
import { getRetiredSimpleStationRedirect } from '@/lib/stations/legacy-route-retirement';
import { redirect } from 'next/navigation';

export default async function OpenShiftPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const retiredRedirect = getRetiredSimpleStationRedirect(id);

    if (retiredRedirect) {
        redirect(retiredRedirect);
    }

    return <LegacySimpleStationOpenShiftPage params={Promise.resolve({ id })} />;
}
