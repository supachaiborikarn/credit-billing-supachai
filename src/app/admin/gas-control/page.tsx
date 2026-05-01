import { redirect } from 'next/navigation';

export default function LegacyGasControlPage() {
    redirect('/admin/gas');
}
