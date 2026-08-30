'use client';

import * as React from 'react';
import { ArrowRightLeft, Merge, RefreshCw, ShieldCheck } from 'lucide-react';
import { useToast } from '@/components/Toast';
import { Button, Notice, Section } from '@/components/ui';

interface OwnerOption {
    id: string;
    name: string;
    code: string | null;
    status: string;
}

interface TruckOption {
    id: string;
    licensePlate: string;
    deletedAt?: string | null;
    owner: { id: string; name: string; code: string | null };
}

export function CustomerAdminTools({ onChanged }: { onChanged: () => Promise<void> | void }) {
    const { showToast } = useToast();
    const [owners, setOwners] = React.useState<OwnerOption[]>([]);
    const [trucks, setTrucks] = React.useState<TruckOption[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [selectedTruckId, setSelectedTruckId] = React.useState('');
    const [targetOwnerId, setTargetOwnerId] = React.useState('');
    const [sourceOwnerId, setSourceOwnerId] = React.useState('');
    const [mergeTargetOwnerId, setMergeTargetOwnerId] = React.useState('');
    const [moving, setMoving] = React.useState(false);
    const [merging, setMerging] = React.useState(false);
    const [confirmMerge, setConfirmMerge] = React.useState(false);

    const load = React.useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [ownersResponse, trucksResponse] = await Promise.all([
                fetch('/api/owners?status=ALL', { cache: 'no-store' }),
                fetch('/api/trucks', { cache: 'no-store' }),
            ]);
            const [ownersPayload, trucksPayload] = await Promise.all([
                ownersResponse.json().catch(() => null),
                trucksResponse.json().catch(() => null),
            ]);
            if (!ownersResponse.ok) throw new Error(ownersPayload?.error || 'โหลดรายชื่อลูกค้าไม่สำเร็จ');
            if (!trucksResponse.ok) throw new Error(trucksPayload?.error || 'โหลดทะเบียนรถไม่สำเร็จ');
            setOwners((ownersPayload || []).map((owner: OwnerOption) => ({
                id: owner.id, name: owner.name, code: owner.code || null, status: owner.status,
            })));
            setTrucks((trucksPayload || []).filter((truck: TruckOption) => !truck.deletedAt));
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : 'โหลดเครื่องมือข้อมูลหลักไม่สำเร็จ');
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => { void load(); }, [load]);

    const selectedTruck = trucks.find((truck) => truck.id === selectedTruckId) || null;
    const sourceOwner = owners.find((owner) => owner.id === sourceOwnerId) || null;
    const mergeTargetOwner = owners.find((owner) => owner.id === mergeTargetOwnerId) || null;

    const moveTruck = async () => {
        if (!selectedTruck || !targetOwnerId || selectedTruck.owner.id === targetOwnerId) return;
        setMoving(true);
        setError(null);
        try {
            const response = await fetch(`/api/trucks/${selectedTruck.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ licensePlate: selectedTruck.licensePlate, ownerId: targetOwnerId }),
            });
            const payload = await response.json().catch(() => null);
            if (!response.ok) throw new Error(payload?.error || 'ย้ายรถไม่สำเร็จ');
            showToast('success', `ย้าย ${selectedTruck.licensePlate} ไป ${payload.owner?.name || 'ลูกค้าใหม่'} แล้ว`);
            setSelectedTruckId('');
            setTargetOwnerId('');
            await load();
            await onChanged();
        } catch (moveError) {
            setError(moveError instanceof Error ? moveError.message : 'ย้ายรถไม่สำเร็จ');
        } finally {
            setMoving(false);
        }
    };

    const mergeOwners = async () => {
        if (!sourceOwner || !mergeTargetOwner || sourceOwner.id === mergeTargetOwner.id) return;
        setMerging(true);
        setError(null);
        try {
            const response = await fetch('/api/admin/owners/merge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sourceOwnerId: sourceOwner.id, targetOwnerId: mergeTargetOwner.id }),
            });
            const payload = await response.json().catch(() => null);
            if (!response.ok) throw new Error(payload?.error || 'รวมลูกค้าไม่สำเร็จ');
            showToast('success', payload?.message || 'รวมลูกค้าแล้ว');
            setSourceOwnerId('');
            setMergeTargetOwnerId('');
            setConfirmMerge(false);
            await load();
            await onChanged();
        } catch (mergeError) {
            setError(mergeError instanceof Error ? mergeError.message : 'รวมลูกค้าไม่สำเร็จ');
        } finally {
            setMerging(false);
        }
    };

    return (
        <Section
            title="เครื่องมือข้อมูลหลัก (แอดมิน)"
            description="ย้ายรถข้ามลูกค้าและรวมข้อมูลลูกค้าซ้ำ โดยรักษา relation ของรายการขายและเอกสารการเงิน"
            action={<Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />รีเฟรช</Button>}
        >
            <div className="space-y-4">
                {error && <Notice tone="danger" title="ดำเนินการไม่สำเร็จ">{error}</Notice>}
                <Notice tone="warning" title="งานแอดมินที่มีผลกับข้อมูลอ้างอิง">
                    การย้ายรถจะเปลี่ยนเจ้าของของทะเบียนนั้น ส่วน merge จะลบ owner ต้นทางหลังย้ายรถ รายการขาย Invoice และ BillingCollection ไป owner เป้าหมายใน transaction เดียว
                </Notice>

                <div className="grid gap-4 xl:grid-cols-2">
                    <div className="rounded-[var(--ui-radius-md)] border border-[var(--ui-border)] p-4">
                        <div className="flex items-center gap-2"><ArrowRightLeft className="h-4 w-4 text-[var(--ui-primary-text)]" aria-hidden="true" /><h3 className="font-bold">ย้ายรถไปลูกค้าคนอื่น</h3></div>
                        <div className="mt-3 space-y-3">
                            <label className="block text-sm font-semibold">ทะเบียนรถ
                                <select value={selectedTruckId} onChange={(event) => { setSelectedTruckId(event.target.value); setTargetOwnerId(''); }} className="mt-1 min-h-11 w-full rounded-[var(--ui-radius-md)] border border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 text-sm">
                                    <option value="">เลือกทะเบียน</option>
                                    {trucks.map((truck) => <option key={truck.id} value={truck.id}>{truck.licensePlate} · {truck.owner.name}</option>)}
                                </select>
                            </label>
                            <label className="block text-sm font-semibold">ย้ายไปลูกค้า
                                <select value={targetOwnerId} onChange={(event) => setTargetOwnerId(event.target.value)} disabled={!selectedTruck} className="mt-1 min-h-11 w-full rounded-[var(--ui-radius-md)] border border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 text-sm disabled:opacity-60">
                                    <option value="">เลือกเจ้าของใหม่</option>
                                    {owners.filter((owner) => owner.id !== selectedTruck?.owner.id).map((owner) => <option key={owner.id} value={owner.id}>{owner.name}{owner.code ? ` · ${owner.code}` : ''}{owner.status !== 'ACTIVE' ? ` · ${owner.status}` : ''}</option>)}
                                </select>
                            </label>
                            <Button className="w-full" onClick={() => void moveTruck()} disabled={moving || !selectedTruck || !targetOwnerId}>
                                <ArrowRightLeft className="h-4 w-4" aria-hidden="true" />{moving ? 'กำลังย้าย...' : 'ย้ายรถ'}
                            </Button>
                        </div>
                    </div>

                    <div className="rounded-[var(--ui-radius-md)] border border-[var(--ui-border)] p-4">
                        <div className="flex items-center gap-2"><Merge className="h-4 w-4 text-[var(--ui-warning-text)]" aria-hidden="true" /><h3 className="font-bold">รวมลูกค้าซ้ำ</h3></div>
                        <div className="mt-3 space-y-3">
                            <label className="block text-sm font-semibold">ลูกค้าที่จะถูกลบหลังย้ายข้อมูล
                                <select value={sourceOwnerId} onChange={(event) => { setSourceOwnerId(event.target.value); setConfirmMerge(false); }} className="mt-1 min-h-11 w-full rounded-[var(--ui-radius-md)] border border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 text-sm">
                                    <option value="">เลือกต้นทาง</option>
                                    {owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.name}{owner.code ? ` · ${owner.code}` : ''}</option>)}
                                </select>
                            </label>
                            <label className="block text-sm font-semibold">ลูกค้าที่จะเก็บไว้
                                <select value={mergeTargetOwnerId} onChange={(event) => { setMergeTargetOwnerId(event.target.value); setConfirmMerge(false); }} className="mt-1 min-h-11 w-full rounded-[var(--ui-radius-md)] border border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 text-sm">
                                    <option value="">เลือกเป้าหมาย</option>
                                    {owners.filter((owner) => owner.id !== sourceOwnerId).map((owner) => <option key={owner.id} value={owner.id}>{owner.name}{owner.code ? ` · ${owner.code}` : ''}</option>)}
                                </select>
                            </label>
                            {sourceOwner && mergeTargetOwner && !confirmMerge && (
                                <Button variant="warning" className="w-full" onClick={() => setConfirmMerge(true)}><ShieldCheck className="h-4 w-4" aria-hidden="true" />ตรวจและยืนยัน merge</Button>
                            )}
                            {confirmMerge && sourceOwner && mergeTargetOwner && (
                                <div className="rounded-[var(--ui-radius-md)] bg-[var(--ui-warning-soft)] p-3 text-sm">
                                    <strong>ยืนยัน:</strong> ลบ “{sourceOwner.name}” หลังย้ายข้อมูลทั้งหมดไป “{mergeTargetOwner.name}”
                                    <div className="mt-3 flex gap-2">
                                        <Button variant="outline" className="flex-1" onClick={() => setConfirmMerge(false)} disabled={merging}>ยกเลิก</Button>
                                        <Button variant="destructive" className="flex-1" onClick={() => void mergeOwners()} disabled={merging}><Merge className="h-4 w-4" aria-hidden="true" />{merging ? 'กำลังรวม...' : 'ยืนยัน merge'}</Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </Section>
    );
}
