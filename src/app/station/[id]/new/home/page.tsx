import { redirect } from 'next/navigation';

export default async function StationNewHomeRedirect({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    redirect(`/simple-station/${id}/new/home`);
}
