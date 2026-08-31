import { redirect } from 'next/navigation';

export default function LegacyAdminOwnersPage() {
    redirect('/customers');
}
