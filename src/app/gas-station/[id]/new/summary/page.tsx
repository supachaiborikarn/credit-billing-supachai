import { redirect } from 'next/navigation';

export default async function LegacyGasSummaryPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    redirect(`/gas/${id}/summary`);
}
