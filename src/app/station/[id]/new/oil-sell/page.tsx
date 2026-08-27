import { redirect } from 'next/navigation';
import { getActiveFullSellRedirect } from '@/lib/stations/legacy-route-retirement';

export default async function StationNewOilSellRedirect({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const canonicalRedirect = getActiveFullSellRedirect(id);

    if (canonicalRedirect) {
        redirect(canonicalRedirect);
    }

    redirect(`/station/${id}/new/home`);
}
