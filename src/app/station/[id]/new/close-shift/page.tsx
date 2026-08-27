import SimpleStationCloseShiftPage from '@/app/simple-station/[id]/new/close-shift/page';
import { getActiveFullOperationsRedirect } from '@/lib/stations/legacy-route-retirement';
import { redirect } from 'next/navigation';

export default async function StationNewCloseShiftPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const canonicalRedirect = getActiveFullOperationsRedirect(id);

    if (canonicalRedirect) {
        redirect(canonicalRedirect);
    }

    return <SimpleStationCloseShiftPage params={Promise.resolve({ id })} />;
}
