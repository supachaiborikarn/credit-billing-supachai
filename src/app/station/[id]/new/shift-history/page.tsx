import { redirect } from 'next/navigation';
import { getActiveFullHistoryRedirect } from '@/lib/stations/legacy-route-retirement';

export default async function FullShiftHistoryRedirect({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const target = getActiveFullHistoryRedirect(id);
    if (target) redirect(target);

    redirect(`/station/${id}/v2`);
}
