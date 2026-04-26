import { redirect } from 'next/navigation';

export default async function StationNewSummaryRedirect({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    redirect(`/simple-station/${id}/new/summary`);
}
