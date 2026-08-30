'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FilePlus2, Plus, ReceiptText, Trash2 } from 'lucide-react';
import { useToast } from '@/components/Toast';
import { Button, Dialog, Input, Notice } from '@/components/ui';
import type { BillingWorkspaceItem, BillingWorkspacePayload } from '@/types/billing';

interface OwnerOption {
    id: string;
    name: string;
    code: string | null;
}

interface CollectionItemDraft {
    sourceDescription: string;
    sourceStation: string;
    sourceInvoiceNo: string;
    amount: string;
}

function bangkokDateInput(offsetDays = 0) {
    const date = new Date(Date.now() + offsetDays * 86400000);
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Bangkok',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(date);
    const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${value.year}-${value.month}-${value.day}`;
}

function readError(payload: unknown, fallback: string) {
    if (payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string') {
        return payload.error;
    }
    return fallback;
}

export function BillingWorkspaceAdminActions({
    data,
    onSuccess,
}: {
    data: BillingWorkspacePayload;
    onSuccess: () => void | Promise<void>;
}) {
    const { showToast } = useToast();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [invoiceOpen, setInvoiceOpen] = React.useState(false);
    const [collectionOpen, setCollectionOpen] = React.useState(false);
    const [submitting, setSubmitting] = React.useState(false);
    const [invoiceOwnerIds, setInvoiceOwnerIds] = React.useState<string[]>([]);
    const [startDate, setStartDate] = React.useState('');
    const [endDate, setEndDate] = React.useState('');
    const [owners, setOwners] = React.useState<OwnerOption[]>([]);
    const [ownersLoading, setOwnersLoading] = React.useState(false);
    const [collectionOwnerId, setCollectionOwnerId] = React.useState('');
    const [periodStart, setPeriodStart] = React.useState('');
    const [periodEnd, setPeriodEnd] = React.useState('');
    const [periodLabel, setPeriodLabel] = React.useState('');
    const [dueDate, setDueDate] = React.useState('');
    const [notes, setNotes] = React.useState('');
    const [collectionItems, setCollectionItems] = React.useState<CollectionItemDraft[]>([
        { sourceDescription: '', sourceStation: '', sourceInvoiceNo: '', amount: '' },
    ]);
    const [error, setError] = React.useState<string | null>(null);

    const waitingItems = React.useMemo(
        () => data.items.filter((item): item is BillingWorkspaceItem & { kind: 'UNBILLED' } => item.kind === 'UNBILLED'),
        [data.items]
    );
    const canManage = data.user.role === 'ADMIN';

    React.useEffect(() => {
        const ownerId = searchParams.get('createInvoice');
        if (!canManage || !ownerId || !waitingItems.some((item) => item.owner.id === ownerId)) return;
        setInvoiceOwnerIds([ownerId]);
        setStartDate(bangkokDateInput(-30));
        setEndDate(bangkokDateInput());
        setError(null);
        setInvoiceOpen(true);
        router.replace('/billing', { scroll: false });
    }, [canManage, router, searchParams, waitingItems]);

    const openInvoice = (ownerId?: string) => {
        setInvoiceOwnerIds(ownerId ? [ownerId] : []);
        setStartDate(bangkokDateInput(-30));
        setEndDate(bangkokDateInput());
        setError(null);
        setInvoiceOpen(true);
    };

    const loadOwners = React.useCallback(async () => {
        setOwnersLoading(true);
        try {
            const response = await fetch('/api/owners?status=ACTIVE', { cache: 'no-store' });
            const payload = await response.json().catch(() => null);
            if (!response.ok) throw new Error(readError(payload, 'โหลดรายชื่อลูกค้าไม่สำเร็จ'));
            const list = Array.isArray(payload) ? payload : [];
            setOwners(list.map((owner) => ({ id: owner.id, name: owner.name, code: owner.code || null })));
        } catch (loadError) {
            const message = loadError instanceof Error ? loadError.message : 'โหลดรายชื่อลูกค้าไม่สำเร็จ';
            setError(message);
            showToast('error', message);
        } finally {
            setOwnersLoading(false);
        }
    }, [showToast]);

    const openCollection = () => {
        setCollectionOwnerId('');
        setPeriodStart(bangkokDateInput(-15));
        setPeriodEnd(bangkokDateInput());
        setPeriodLabel('');
        setDueDate('');
        setNotes('');
        setCollectionItems([{ sourceDescription: '', sourceStation: '', sourceInvoiceNo: '', amount: '' }]);
        setError(null);
        setCollectionOpen(true);
        if (owners.length === 0) void loadOwners();
    };

    const toggleInvoiceOwner = (ownerId: string) => {
        setInvoiceOwnerIds((current) => current.includes(ownerId)
            ? current.filter((id) => id !== ownerId)
            : [...current, ownerId]);
    };

    const submitInvoices = async () => {
        if (invoiceOwnerIds.length === 0) {
            setError('กรุณาเลือกลูกค้าอย่างน้อย 1 ราย');
            return;
        }
        if (startDate && endDate && startDate > endDate) {
            setError('วันที่เริ่มต้องไม่เกินวันที่สิ้นสุด');
            return;
        }

        setSubmitting(true);
        setError(null);
        try {
            const response = await fetch('/api/invoices', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ownerIds: invoiceOwnerIds,
                    startDate: startDate || undefined,
                    endDate: endDate || undefined,
                    combineOwners: false,
                }),
            });
            const payload = await response.json().catch(() => null);
            if (!response.ok) throw new Error(readError(payload, 'สร้าง Invoice ไม่สำเร็จ'));
            const count = payload && typeof payload === 'object' && 'count' in payload && typeof payload.count === 'number'
                ? payload.count
                : 1;
            showToast('success', `สร้าง Invoice เรียบร้อย ${count} ใบ`);
            setInvoiceOpen(false);
            await onSuccess();
        } catch (submitError) {
            const message = submitError instanceof Error ? submitError.message : 'สร้าง Invoice ไม่สำเร็จ';
            setError(message);
            showToast('error', message);
        } finally {
            setSubmitting(false);
        }
    };

    const updateCollectionItem = (index: number, key: keyof CollectionItemDraft, value: string) => {
        setCollectionItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item));
    };

    const submitCollection = async () => {
        const validItems = collectionItems
            .map((item) => ({ ...item, amountNumber: Number.parseFloat(item.amount) }))
            .filter((item) => item.sourceDescription.trim() && Number.isFinite(item.amountNumber) && item.amountNumber > 0);

        if (!collectionOwnerId || !periodStart || !periodEnd) {
            setError('กรุณาเลือกลูกค้าและกำหนดช่วงเวลา');
            return;
        }
        if (periodStart > periodEnd) {
            setError('วันที่เริ่มต้องไม่เกินวันที่สิ้นสุด');
            return;
        }
        if (validItems.length === 0) {
            setError('กรุณาเพิ่มรายการบิลที่มีรายละเอียดและยอดมากกว่า 0 อย่างน้อย 1 รายการ');
            return;
        }

        setSubmitting(true);
        setError(null);
        try {
            const response = await fetch('/api/billing-collections', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ownerId: collectionOwnerId,
                    periodStart,
                    periodEnd,
                    periodLabel: periodLabel.trim() || undefined,
                    dueDate: dueDate || undefined,
                    notes: notes.trim() || undefined,
                    items: validItems.map((item) => ({
                        sourceDescription: item.sourceDescription.trim(),
                        sourceStation: item.sourceStation.trim() || undefined,
                        sourceInvoiceNo: item.sourceInvoiceNo.trim() || undefined,
                        amount: item.amountNumber,
                    })),
                }),
            });
            const payload = await response.json().catch(() => null);
            if (!response.ok) throw new Error(readError(payload, 'สร้างใบวางบิลรวมไม่สำเร็จ'));
            const number = payload && typeof payload === 'object' && 'collectionNo' in payload ? String(payload.collectionNo) : '';
            showToast('success', number ? `สร้าง ${number} เรียบร้อย` : 'สร้างใบวางบิลรวมเรียบร้อย');
            setCollectionOpen(false);
            await onSuccess();
        } catch (submitError) {
            const message = submitError instanceof Error ? submitError.message : 'สร้างใบวางบิลรวมไม่สำเร็จ';
            setError(message);
            showToast('error', message);
        } finally {
            setSubmitting(false);
        }
    };

    if (!canManage) return null;

    return (
        <>
            <div className="flex flex-wrap gap-2">
                <Button onClick={() => openInvoice()} disabled={waitingItems.length === 0}>
                    <FilePlus2 className="h-4 w-4" aria-hidden="true" />
                    สร้าง Invoice
                </Button>
                <Button variant="outline" onClick={openCollection}>
                    <ReceiptText className="h-4 w-4" aria-hidden="true" />
                    สร้างใบวางบิลรวม
                </Button>
            </div>

            <Dialog
                open={invoiceOpen}
                onOpenChange={(next) => !submitting && setInvoiceOpen(next)}
                title="สร้าง Invoice จากรายการรอวางบิล"
                description="แต่ละลูกค้าจะถูกสร้างเป็น Invoice แยกใบเพื่อรักษา ownerId ให้ถูกต้อง"
                size="lg"
                footer={(
                    <>
                        <Button variant="outline" disabled={submitting} onClick={() => setInvoiceOpen(false)}>ยกเลิก</Button>
                        <Button loading={submitting} onClick={() => void submitInvoices()}>
                            สร้าง {invoiceOwnerIds.length || 0} ใบ
                        </Button>
                    </>
                )}
            >
                <div className="space-y-4">
                    {error && <Notice tone="danger">{error}</Notice>}
                    <div className="grid gap-3 sm:grid-cols-2">
                        <Input label="ตั้งแต่วันที่" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
                        <Input label="ถึงวันที่" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
                    </div>
                    <Notice tone="info" title="ไม่รวมหลายเจ้าของเป็น Invoice เดียว">
                        โมเดล Invoice มี ownerId เพียง 1 ค่า จึงสร้างแยกใบต่อเจ้าของเพื่อไม่ให้หนี้และ Customer 360 ผูกผิดคน
                    </Notice>
                    <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                        {waitingItems.map((item) => (
                            <label key={item.owner.id} className="flex cursor-pointer items-center gap-3 rounded-[var(--ui-radius-md)] border border-[var(--ui-border)] p-3">
                                <input
                                    type="checkbox"
                                    checked={invoiceOwnerIds.includes(item.owner.id)}
                                    onChange={() => toggleInvoiceOwner(item.owner.id)}
                                    className="h-4 w-4"
                                />
                                <div className="min-w-0 flex-1">
                                    <div className="font-semibold">{item.owner.name}</div>
                                    <div className="text-xs text-[var(--ui-text-muted)]">{item.sourceItemCount} รายการ · ฿{item.totalAmount.toLocaleString('th-TH', { maximumFractionDigits: 2 })}</div>
                                </div>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={(event) => {
                                        event.preventDefault();
                                        setInvoiceOwnerIds([item.owner.id]);
                                    }}
                                >
                                    เลือกรายเดียว
                                </Button>
                            </label>
                        ))}
                    </div>
                </div>
            </Dialog>

            <Dialog
                open={collectionOpen}
                onOpenChange={(next) => !submitting && setCollectionOpen(next)}
                title="สร้างใบวางบิลรวม"
                description="สร้างเอกสารจากรายการ manual เดิม โดยเก็บ ownerId และ ownerName snapshot"
                size="lg"
                footer={(
                    <>
                        <Button variant="outline" disabled={submitting} onClick={() => setCollectionOpen(false)}>ยกเลิก</Button>
                        <Button loading={submitting} onClick={() => void submitCollection()}>สร้างใบวางบิลรวม</Button>
                    </>
                )}
            >
                <div className="space-y-4">
                    {error && <Notice tone="danger">{error}</Notice>}
                    <div>
                        <label className="mb-1.5 block text-sm font-semibold">ลูกค้า *</label>
                        <select
                            value={collectionOwnerId}
                            onChange={(event) => setCollectionOwnerId(event.target.value)}
                            disabled={ownersLoading}
                            className="h-[var(--ui-control-md)] w-full rounded-[var(--ui-radius-md)] border border-[var(--ui-border-strong)] bg-[var(--ui-surface)] px-3 text-sm"
                        >
                            <option value="">{ownersLoading ? 'กำลังโหลดลูกค้า…' : 'เลือกลูกค้า'}</option>
                            {owners.map((owner) => (
                                <option key={owner.id} value={owner.id}>{owner.code ? `[${owner.code}] ` : ''}{owner.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <Input label="ตั้งแต่วันที่ *" type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} />
                        <Input label="ถึงวันที่ *" type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} />
                        <Input label="ป้ายกำกับช่วง" value={periodLabel} onChange={(event) => setPeriodLabel(event.target.value)} placeholder="1-15 มี.ค. 2569" />
                        <Input label="วันครบกำหนด" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
                    </div>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                            <div className="text-sm font-semibold">รายการบิล *</div>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setCollectionItems((current) => [...current, { sourceDescription: '', sourceStation: '', sourceInvoiceNo: '', amount: '' }])}
                            >
                                <Plus className="h-4 w-4" /> เพิ่มรายการ
                            </Button>
                        </div>
                        {collectionItems.map((item, index) => (
                            <div key={index} className="space-y-2 rounded-[var(--ui-radius-md)] border border-[var(--ui-border)] p-3">
                                <div className="grid gap-2 sm:grid-cols-2">
                                    <Input label={`รายละเอียด #${index + 1}`} value={item.sourceDescription} onChange={(event) => updateCollectionItem(index, 'sourceDescription', event.target.value)} />
                                    <Input label="สถานี" value={item.sourceStation} onChange={(event) => updateCollectionItem(index, 'sourceStation', event.target.value)} />
                                    <Input label="เลขที่บิล" value={item.sourceInvoiceNo} onChange={(event) => updateCollectionItem(index, 'sourceInvoiceNo', event.target.value)} />
                                    <Input label="ยอดเงิน" type="number" min="0" step="0.01" inputMode="decimal" value={item.amount} onChange={(event) => updateCollectionItem(index, 'amount', event.target.value)} />
                                </div>
                                {collectionItems.length > 1 && (
                                    <div className="flex justify-end">
                                        <Button type="button" variant="ghost" size="sm" onClick={() => setCollectionItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}>
                                            <Trash2 className="h-4 w-4" /> ลบรายการ
                                        </Button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                    <div className="rounded-[var(--ui-radius-md)] bg-[var(--ui-surface-subtle)] p-3 text-right text-sm">
                        ยอดรวม <span className="ml-2 text-lg font-bold tabular-nums">฿{collectionItems.reduce((sum, item) => sum + (Number.parseFloat(item.amount) || 0), 0).toLocaleString('th-TH', { maximumFractionDigits: 2 })}</span>
                    </div>
                    <Input label="หมายเหตุ" value={notes} onChange={(event) => setNotes(event.target.value)} />
                </div>
            </Dialog>
        </>
    );
}
