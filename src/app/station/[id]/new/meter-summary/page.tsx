import { redirect } from 'next/navigation';
import { getActiveFullMeterSummaryRedirect } from '@/lib/stations/legacy-route-retirement';

export default async function FullMeterSummaryRedirect({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const target = getActiveFullMeterSummaryRedirect(id);
    if (target) redirect(target);

    redirect(`/station/${id}/v2`);
}
