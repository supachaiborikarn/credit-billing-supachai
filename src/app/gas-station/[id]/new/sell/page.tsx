import { redirect } from 'next/navigation';

export default async function LegacyGasSellPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    redirect(`/gas/${id}/sell`);
}
