import { redirect } from 'next/navigation';

export default async function LegacyGasMonthlyBalancePage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    redirect(`/gas/${id}`);
}
