import SimpleStationSellPage from '@/app/simple-station/[id]/new/sell/page';
import { getActiveFullSellRedirect } from '@/lib/stations/legacy-route-retirement';
import { redirect } from 'next/navigation';

export default async function StationNewSellPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const canonicalRedirect = getActiveFullSellRedirect(id);

    if (canonicalRedirect) {
        redirect(canonicalRedirect);
    }

    return <SimpleStationSellPage params={Promise.resolve({ id })} />;
}
