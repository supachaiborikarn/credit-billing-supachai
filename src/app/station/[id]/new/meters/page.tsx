import { getActiveFullOperationsRedirect } from '@/lib/stations/legacy-route-retirement';
import { redirect } from 'next/navigation';

export default async function StationNewMetersRedirect({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const canonicalRedirect = getActiveFullOperationsRedirect(id);

    if (canonicalRedirect) {
        redirect(canonicalRedirect);
    }

    redirect(`/station/${id}/new/shift-end`);
}
