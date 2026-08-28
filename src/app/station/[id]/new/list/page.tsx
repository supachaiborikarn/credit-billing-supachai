import { redirect } from 'next/navigation';

export default async function StationNewListRedirect({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    redirect(`/station/${id}/v2`);
}
