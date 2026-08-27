import { CanonicalStationWorkspace } from '@/components/stations/CanonicalStationWorkspace';

export default async function StationSalesPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return <CanonicalStationWorkspace stationId={id} mode="SALES" />;
}
