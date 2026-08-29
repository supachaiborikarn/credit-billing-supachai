import { redirect } from 'next/navigation';
import LegacySimpleStationSummaryPage from './LegacySimpleStationSummaryPage';
import { getRetiredSimpleSummaryRedirect } from '@/lib/stations/legacy-route-retirement';

export default async function SimpleStationSummaryRetirementPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const target = getRetiredSimpleSummaryRedirect(id);
    if (target) redirect(target);
    return <LegacySimpleStationSummaryPage params={Promise.resolve({ id })} />;
}
