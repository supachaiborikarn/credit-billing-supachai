'use client';

import * as React from 'react';
import { Pencil, Plus, Save, Trash2, Truck, UserRound, X } from 'lucide-react';
import { OwnerGroupLabels, type OwnerGroupValue } from '@/constants/owner-groups';
import { useToast } from '@/components/Toast';
import { Button, Input, Notice, Section } from '@/components/ui';
import type { Customer360Payload } from '@/types/customer';

const groupOptions = Object.entries(OwnerGroupLabels) as Array<[OwnerGroupValue, string]>;

export function CustomerMasterDataPanel({ data, onChanged }: { data: Customer360Payload; onChanged: () => Promise<void> | void }) {
    const { showToast } = useToast();
    const customer = data.customer;
    const [editing, setEditing] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const [deactivating, setDeactivating] = React.useState(false);
    const [confirmDeactivate, setConfirmDeactivate] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [name, setName] = React.useState(customer.name);
    const [phone, setPhone] = React.useState(customer.phone || '');
    const [venderCode, setVenderCode] = React.useState(customer.venderCode || '');
    const [groupType, setGroupType] = React.useState<OwnerGroupValue>(customer.groupType as OwnerGroupValue);
    const [creditLimit, setCreditLimit] = React.useState(String(data.credit.creditLimit));
    const [newTruckPlate, setNewTruckPlate] = React.useState('');
    const [addingTruck, setAddingTruck] = React.useState(false);
    const [editingTruckId, setEditingTruckId] = React.useState<string | null>(null);
    const [editingTruckPlate, setEditingTruckPlate] = React.useState('');

    React.useEffect(() => {
        setName(customer.name);
        setPhone(customer.phone || '');
        setVenderCode(customer.venderCode || '');
        setGroupType(customer.groupType as OwnerGroupValue);
        setCreditLimit(String(data.credit.creditLimit));
    }, [customer, data.credit.creditLimit]);

    if (!data.permissions.canEditCustomer) return null;

    const saveCustomer = async (event: React.FormEvent) => {
        event.preventDefault();
        const parsedCreditLimit = Number(creditLimit);
        if (!name.trim()) {
            setError('กรุณากรอกชื่อลูกค้า');
            return;
        }
        if (!Number.isFinite(parsedCreditLimit) || parsedCreditLimit < 0) {
            setError('วงเงินต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป');
            return;
        }

        setSaving(true);
        setError(null);
        try {
            const response = await fetch(`/api/owners/${customer.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: name.trim(),
                    phone: phone.trim(),
                    venderCode: venderCode.trim(),
                    groupType,
                    creditLimit: parsedCreditLimit,
                }),
            });
            const payload = await response.json().catch(() => null);
            if (!response.ok) throw new Error(payload?.error || 'บันทึกข้อมูลลูกค้าไม่สำเร็จ');
            showToast('success', 'บันทึกข้อมูลลูกค้าแล้ว');
            setEditing(false);
            await onChanged();
        } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : 'บันทึกข้อมูลลูกค้าไม่สำเร็จ');
        } finally {
            setSaving(false);
        }
    };

    const addTruck = async (event: React.FormEvent) => {
        event.preventDefault();
        const plate = newTruckPlate.trim();
        if (!plate) return;
        setAddingTruck(true);
        setError(null);
        try {
            const response = await fetch('/api/trucks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ licensePlate: plate, ownerId: customer.id }),
            });
            const payload = await response.json().catch(() => null);
            if (!response.ok) throw new Error(payload?.error || 'เพิ่มรถไม่สำเร็จ');
            setNewTruckPlate('');
            showToast('success', `เพิ่มรถ ${payload.licensePlate || plate.toUpperCase()} แล้ว`);
            await onChanged();
        } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : 'เพิ่มรถไม่สำเร็จ');
        } finally {
            setAddingTruck(false);
        }
    };

    const saveTruck = async (truckId: string) => {
        const plate = editingTruckPlate.trim();
        if (!plate) return;
        setError(null);
        try {
            const response = await fetch(`/api/trucks/${truckId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ licensePlate: plate, ownerId: customer.id }),
            });
            const payload = await response.json().catch(() => null);
            if (!response.ok) throw new Error(payload?.error || 'แก้ทะเบียนรถไม่สำเร็จ');
            showToast('success', `อัปเดตรถ ${payload.licensePlate || plate.toUpperCase()} แล้ว`);
            setEditingTruckId(null);
            setEditingTruckPlate('');
            await onChanged();
        } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : 'แก้ทะเบียนรถไม่สำเร็จ');
        }
    };

    const deactivateCustomer = async () => {
        setDeactivating(true);
        setError(null);
        try {
            const response = await fetch(`/api/owners/${customer.id}`, { method: 'DELETE' });
            const payload = await response.json().catch(() => null);
            if (!response.ok) throw new Error(payload?.error || 'ปิดใช้งานลูกค้าไม่สำเร็จ');
            showToast('success', payload?.message || 'ปิดใช้งานลูกค้าแล้ว');
            setConfirmDeactivate(false);
            await onChanged();
        } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : 'ปิดใช้งานลูกค้าไม่สำเร็จ');
        } finally {
            setDeactivating(false);
        }
    };

    return (
        <Section
            title="ข้อมูลหลักลูกค้า (แอดมิน)"
            description="แทนหน้า Owners เดิม: แก้ข้อมูลลูกค้า วงเงิน และเพิ่ม/แก้ทะเบียนรถ โดยไม่เปลี่ยนประวัติรายการขาย"
            action={editing
                ? <Button variant="outline" size="sm" onClick={() => setEditing(false)} disabled={saving}><X className="h-4 w-4" aria-hidden="true" />ยกเลิกแก้ไข</Button>
                : <Button variant="outline" size="sm" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" aria-hidden="true" />แก้ข้อมูล</Button>}
        >
            <div className="space-y-4">
                {error && <Notice tone="danger" title="ดำเนินการไม่สำเร็จ">{error}</Notice>}
                {editing ? (
                    <form className="space-y-3" onSubmit={saveCustomer}>
                        <div className="grid gap-3 md:grid-cols-2">
                            <label className="text-sm font-semibold">ชื่อลูกค้า<Input className="mt-1" value={name} onChange={(event) => setName(event.target.value)} required /></label>
                            <label className="text-sm font-semibold">โทรศัพท์<Input className="mt-1" value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" /></label>
                            <label className="text-sm font-semibold">กลุ่มลูกค้า
                                <select value={groupType} onChange={(event) => setGroupType(event.target.value as OwnerGroupValue)} className="mt-1 min-h-[var(--ui-control-height-md)] w-full rounded-[var(--ui-radius-md)] border border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 text-sm focus-visible:outline-none focus-visible:shadow-[var(--ui-shadow-focus)]">
                                    {groupOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                                </select>
                            </label>
                            <label className="text-sm font-semibold">Vendor code<Input className="mt-1" value={venderCode} onChange={(event) => setVenderCode(event.target.value)} /></label>
                            <label className="text-sm font-semibold">วงเงินเครดิต (บาท)<Input className="mt-1" value={creditLimit} onChange={(event) => setCreditLimit(event.target.value)} inputMode="decimal" /></label>
                        </div>
                        <div className="flex justify-end"><Button type="submit" disabled={saving}><Save className="h-4 w-4" aria-hidden="true" />{saving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}</Button></div>
                    </form>
                ) : (
                    <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                        <div><div className="text-xs text-[var(--ui-text-muted)]">กลุ่ม</div><div className="mt-1 font-semibold">{OwnerGroupLabels[customer.groupType as OwnerGroupValue] || customer.groupType}</div></div>
                        <div><div className="text-xs text-[var(--ui-text-muted)]">Vendor code</div><div className="mt-1 font-semibold">{customer.venderCode || '-'}</div></div>
                        <div><div className="text-xs text-[var(--ui-text-muted)]">วงเงินเครดิต</div><div className="mt-1 font-semibold">฿{data.credit.creditLimit.toLocaleString('th-TH')}</div></div>
                        <div><div className="text-xs text-[var(--ui-text-muted)]">สถานะ</div><div className="mt-1 font-semibold">{customer.status}</div></div>
                    </div>
                )}

                <div className="rounded-[var(--ui-radius-md)] border border-[var(--ui-border)] p-3">
                    <div className="flex items-center gap-2"><Truck className="h-4 w-4 text-[var(--ui-text-muted)]" aria-hidden="true" /><h3 className="text-sm font-bold">ทะเบียนรถของลูกค้า</h3></div>
                    <form className="mt-3 flex flex-col gap-2 sm:flex-row" onSubmit={addTruck}>
                        <Input value={newTruckPlate} onChange={(event) => setNewTruckPlate(event.target.value)} placeholder="ทะเบียนรถใหม่" aria-label="ทะเบียนรถใหม่" />
                        <Button type="submit" disabled={addingTruck || !newTruckPlate.trim()}><Plus className="h-4 w-4" aria-hidden="true" />{addingTruck ? 'กำลังเพิ่ม...' : 'เพิ่มรถ'}</Button>
                    </form>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {data.trucks.map((truck) => (
                            <div key={truck.id} className="rounded-[var(--ui-radius-md)] bg-[var(--ui-surface-subtle)] p-3">
                                {editingTruckId === truck.id ? (
                                    <div className="space-y-2">
                                        <Input value={editingTruckPlate} onChange={(event) => setEditingTruckPlate(event.target.value)} aria-label={`แก้ทะเบียน ${truck.licensePlate}`} />
                                        <div className="flex gap-2">
                                            <Button size="sm" onClick={() => void saveTruck(truck.id)} disabled={!editingTruckPlate.trim()}><Save className="h-4 w-4" aria-hidden="true" />บันทึก</Button>
                                            <Button size="sm" variant="outline" onClick={() => { setEditingTruckId(null); setEditingTruckPlate(''); }}><X className="h-4 w-4" aria-hidden="true" />ยกเลิก</Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-between gap-2">
                                        <div><div className="font-semibold">{truck.licensePlate}</div><div className="text-xs text-[var(--ui-text-muted)]">{truck.transactionCount} รายการขาย</div></div>
                                        <Button size="sm" variant="outline" onClick={() => { setEditingTruckId(truck.id); setEditingTruckPlate(truck.licensePlate); }}><Pencil className="h-4 w-4" aria-hidden="true" />แก้</Button>
                                    </div>
                                )}
                            </div>
                        ))}
                        {data.trucks.length === 0 && <div className="text-sm text-[var(--ui-text-muted)]">ยังไม่มีทะเบียนรถ</div>}
                    </div>
                    <p className="mt-2 text-xs text-[var(--ui-text-muted)]">การย้ายรถไปลูกค้าคนอื่นยังอยู่หน้า Trucks เดิมจน S103 ย้ายเครื่องมือดังกล่าวเข้าหน้าใหม่</p>
                </div>

                {customer.status === 'ACTIVE' && (
                    <div className="rounded-[var(--ui-radius-md)] border border-[var(--ui-danger)]/40 bg-[var(--ui-danger-soft)] p-3">
                        <div className="flex items-start gap-2"><UserRound className="mt-0.5 h-4 w-4 text-[var(--ui-danger-text)]" aria-hidden="true" /><div className="flex-1"><div className="text-sm font-bold text-[var(--ui-danger-text)]">ปิดใช้งานลูกค้า</div><p className="mt-1 text-xs text-[var(--ui-text-muted)]">เป็น soft delete ประวัติธุรกรรมและเอกสารเดิมยังอยู่ครบ</p></div></div>
                        {confirmDeactivate ? (
                            <div className="mt-3 flex flex-wrap justify-end gap-2">
                                <Button variant="outline" size="sm" onClick={() => setConfirmDeactivate(false)} disabled={deactivating}>ยกเลิก</Button>
                                <Button variant="destructive" size="sm" onClick={() => void deactivateCustomer()} disabled={deactivating}><Trash2 className="h-4 w-4" aria-hidden="true" />{deactivating ? 'กำลังปิด...' : 'ยืนยันปิดใช้งาน'}</Button>
                            </div>
                        ) : <div className="mt-3 text-right"><Button variant="destructive" size="sm" onClick={() => setConfirmDeactivate(true)}><Trash2 className="h-4 w-4" aria-hidden="true" />ปิดใช้งานลูกค้า</Button></div>}
                    </div>
                )}
            </div>
        </Section>
    );
}
