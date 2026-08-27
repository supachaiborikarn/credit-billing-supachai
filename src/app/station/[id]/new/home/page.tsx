import SimpleStationHomePage from '@/app/simple-station/[id]/new/home/page';
import { getActiveFullOverviewRedirect } from '@/lib/stations/legacy-route-retirement';
import { redirect } from 'next/navigation';

export default async function StationNewHomePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const canonicalRedirect = getActiveFullOverviewRedirect(id);

    if (canonicalRedirect) {
        redirect(canonicalRedirect);
    }

    return <SimpleStationHomePage params={Promise.resolve({ id })} />;
}
