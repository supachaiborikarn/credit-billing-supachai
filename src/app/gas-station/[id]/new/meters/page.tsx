import { redirect } from 'next/navigation';

export default async function LegacyGasMetersPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    redirect(`/gas/${id}/meters`);
}
