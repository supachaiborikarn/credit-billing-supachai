import LegacySimpleStationCloseShiftPage from './LegacySimpleStationCloseShiftPage';
import { getRetiredSimpleStationRedirect } from '@/lib/stations/legacy-route-retirement';
import { redirect } from 'next/navigation';

export default async function SimpleStationCloseShiftPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const retiredRedirect = getRetiredSimpleStationRedirect(id);

    if (retiredRedirect) {
        redirect(retiredRedirect);
    }

    return <LegacySimpleStationCloseShiftPage params={Promise.resolve({ id })} />;
}
