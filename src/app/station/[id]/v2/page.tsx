import { redirect } from 'next/navigation';

export default async function TankStationV2Redirect({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    redirect(`/station/${id}`);
}
