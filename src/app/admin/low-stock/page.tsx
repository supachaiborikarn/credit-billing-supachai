import { redirect } from 'next/navigation';

export default function RetiredAdminLowStockPage() {
    redirect('/stations/station-5/inventory');
}
