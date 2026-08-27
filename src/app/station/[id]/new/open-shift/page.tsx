import SimpleStationOpenShiftPage from '@/app/simple-station/[id]/new/open-shift/page';
import { getActiveFullOperationsRedirect } from '@/lib/stations/legacy-route-retirement';
import { redirect } from 'next/navigation';

export default async function StationNewOpenShiftPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const canonicalRedirect = getActiveFullOperationsRedirect(id);

    if (canonicalRedirect) {
        redirect(canonicalRedirect);
    }

    return <SimpleStationOpenShiftPage params={Promise.resolve({ id })} />;
}
