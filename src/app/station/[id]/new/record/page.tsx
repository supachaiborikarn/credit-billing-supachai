import { redirect } from 'next/navigation';

export default async function StationNewRecordRedirect({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    redirect(`/station/${id}/new/sell`);
}
