import LegacySimpleStationMeterSummaryPage from './LegacySimpleStationMeterSummaryPage';
import { getRetiredSimpleMeterSummaryRedirect } from '@/lib/stations/legacy-route-retirement';
import { redirect } from 'next/navigation';

export default async function MeterSummaryPage({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ date?: string | string[] }>;
}) {
    const { id } = await params;
    const query = await searchParams;
    const selectedDate = typeof query.date === 'string' ? query.date : null;
    const retiredRedirect = getRetiredSimpleMeterSummaryRedirect(id, selectedDate);

    if (retiredRedirect) {
        redirect(retiredRedirect);
    }

    return <LegacySimpleStationMeterSummaryPage params={Promise.resolve({ id })} />;
}
