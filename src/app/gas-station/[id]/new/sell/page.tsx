import { redirect } from 'next/navigation';
import { getActiveGasSellRedirect } from '@/lib/stations/legacy-route-retirement';

export default async function LegacyGasSellPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const canonicalRedirect = getActiveGasSellRedirect(id);

    if (canonicalRedirect) {
        redirect(canonicalRedirect);
    }

    redirect(`/gas/${id}/sell`);
}
