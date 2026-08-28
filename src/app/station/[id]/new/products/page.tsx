import { redirect } from 'next/navigation';
import { getActiveFullOverviewRedirect } from '@/lib/stations/legacy-route-retirement';

export default async function FullProductsCompatRedirect({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const target = getActiveFullOverviewRedirect(id);
    if (target) redirect(target);
    redirect(`/station/${id}/v2`);
}
