import { redirect } from 'next/navigation';

export default async function StationNewOilSellRedirect({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    redirect(`/station/${id}/new/home`);
}
