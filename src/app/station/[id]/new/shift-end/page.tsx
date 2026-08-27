import SimpleStationShiftEndPage from '@/app/simple-station/[id]/new/shift-end/page';
import { getActiveFullOperationsRedirect } from '@/lib/stations/legacy-route-retirement';
import { redirect } from 'next/navigation';

export default async function StationNewShiftEndPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const canonicalRedirect = getActiveFullOperationsRedirect(id);

    if (canonicalRedirect) {
        redirect(canonicalRedirect);
    }

    return <SimpleStationShiftEndPage params={Promise.resolve({ id })} />;
}
