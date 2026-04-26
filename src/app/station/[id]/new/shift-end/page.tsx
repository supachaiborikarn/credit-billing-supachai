import { redirect } from 'next/navigation';

export default async function StationNewShiftEndRedirect({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    redirect(`/simple-station/${id}/new/shift-end`);
}
