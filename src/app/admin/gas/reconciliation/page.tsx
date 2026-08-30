import { redirect } from 'next/navigation';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function LegacyGasReconciliationRedirect({
    searchParams,
}: {
    searchParams: SearchParams;
}) {
    const incoming = await searchParams;
    const params = new URLSearchParams({ view: 'reconciliation' });

    for (const [key, value] of Object.entries(incoming)) {
        if (Array.isArray(value)) {
            value.forEach((item) => params.append(key, item));
        } else if (value !== undefined) {
            params.set(key, value);
        }
    }

    params.set('view', 'reconciliation');
    redirect(`/admin/gas/reports/shift?${params.toString()}`);
}
