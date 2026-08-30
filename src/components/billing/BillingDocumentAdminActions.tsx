'use client';

import * as React from 'react';
import { Download, Printer, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/Toast';
import { Button, ConfirmDialog } from '@/components/ui';
import type { BillingWorkspaceItem } from '@/types/billing';

export function BillingDocumentAdminActions({
    document,
    canManage,
}: {
    document: BillingWorkspaceItem;
    canManage: boolean;
}) {
    const router = useRouter();
    const { showToast } = useToast();
    const [deleteOpen, setDeleteOpen] = React.useState(false);

    const deleteInvoice = async () => {
        if (document.kind !== 'INVOICE' || !document.documentId) return;
        const response = await fetch(`/api/invoices/${document.documentId}`, { method: 'DELETE' });
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
            const message = payload?.error || 'ลบ Invoice ไม่สำเร็จ';
            showToast('error', message);
            throw new Error(message);
        }
        showToast('success', payload?.message || 'ลบ Invoice แล้ว');
        router.push('/billing');
        router.refresh();
    };

    if (document.kind !== 'INVOICE' || !document.documentId) return null;

    return (
        <>
            <div className="flex flex-wrap gap-2">
                <a href={`/api/invoices/${document.documentId}/export?format=excel`} target="_blank" rel="noreferrer">
                    <Button variant="outline" size="sm"><Download className="h-4 w-4" /> Excel</Button>
                </a>
                <a href={`/api/invoices/${document.documentId}/export?format=csv`} target="_blank" rel="noreferrer">
                    <Button variant="outline" size="sm"><Download className="h-4 w-4" /> CSV</Button>
                </a>
                <a href={`/invoices/${document.documentId}`}>
                    <Button variant="outline" size="sm"><Printer className="h-4 w-4" /> หน้าพิมพ์เดิม</Button>
                </a>
                {canManage && document.paidAmount <= 0 && (
                    <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
                        <Trash2 className="h-4 w-4" /> ลบ Invoice
                    </Button>
                )}
            </div>
            <ConfirmDialog
                open={deleteOpen}
                onOpenChange={setDeleteOpen}
                title="ลบ Invoice นี้?"
                description="ทำได้เฉพาะ Invoice ที่ยังไม่มี Payment รายการทั้งหมดจะกลับไปรอวางบิล"
                tone="danger"
                confirmLabel="ลบ Invoice"
                onConfirm={deleteInvoice}
            />
        </>
    );
}
