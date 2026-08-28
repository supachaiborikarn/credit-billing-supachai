import LegacySimpleStationShiftHistoryPage from './LegacySimpleStationShiftHistoryPage';
import { getRetiredSimpleStationHistoryRedirect } from '@/lib/stations/legacy-route-retirement';
import { redirect } from 'next/navigation';

export default async function ShiftHistoryPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const retiredRedirect = getRetiredSimpleStationHistoryRedirect(id);

    if (retiredRedirect) {
        redirect(retiredRedirect);
    }

    return <LegacySimpleStationShiftHistoryPage params={Promise.resolve({ id })} />;
}
