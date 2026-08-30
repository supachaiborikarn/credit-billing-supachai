'use client';

import * as React from 'react';
import { Plus, UserPlus, X } from 'lucide-react';
import { OwnerGroupLabels, type OwnerGroupValue } from '@/constants/owner-groups';
import { useToast } from '@/components/Toast';
import { Button, Input, Notice, Section } from '@/components/ui';

const groupOptions = Object.entries(OwnerGroupLabels) as Array<[OwnerGroupValue, string]>;

export function CustomerCreatePanel({ onCreated }: { onCreated: (customerId: string) => void }) {
    const { showToast } = useToast();
    const [open, setOpen] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [name, setName] = React.useState('');
    const [phone, setPhone] = React.useState('');
    const [venderCode, setVenderCode] = React.useState('');
    const [groupType, setGroupType] = React.useState<OwnerGroupValue>('GENERAL_CREDIT');

    const reset = () => {
        setName('');
        setPhone('');
        setVenderCode('');
        setGroupType('GENERAL_CREDIT');
        setError(null);
    };

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        const trimmedName = name.trim();
        if (!trimmedName) {
            setError('กรุณากรอกชื่อลูกค้า');
            return;
        }

        setSaving(true);
        setError(null);
        try {
            const response = await fetch('/api/owners', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: trimmedName,
                    phone: phone.trim() || undefined,
                    venderCode: venderCode.trim() || undefined,
                    groupType,
                }),
            });
            const payload = await response.json().catch(() => null);
            if (!response.ok) throw new Error(payload?.error || 'เพิ่มลูกค้าไม่สำเร็จ');
            showToast('success', `เพิ่มลูกค้า ${payload.name || trimmedName} แล้ว`);
            reset();
            setOpen(false);
            onCreated(payload.id);
        } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : 'เพิ่มลูกค้าไม่สำเร็จ');
        } finally {
            setSaving(false);
        }
    };

    if (!open) {
        return (
            <div className="flex justify-end">
                <Button onClick={() => setOpen(true)}>
                    <UserPlus className="h-4 w-4" aria-hidden="true" /> เพิ่มลูกค้า
                </Button>
            </div>
        );
    }

    return (
        <Section
            title="เพิ่มลูกค้า"
            description="สร้างข้อมูลหลักก่อน แล้วค่อยเพิ่มรถหรือปรับวงเงินใน Customer 360"
            action={<Button variant="outline" size="sm" onClick={() => { reset(); setOpen(false); }} disabled={saving}><X className="h-4 w-4" aria-hidden="true" />ปิด</Button>}
        >
            <form className="space-y-3" onSubmit={submit}>
                {error && <Notice tone="danger" title="บันทึกไม่สำเร็จ">{error}</Notice>}
                <div className="grid gap-3 md:grid-cols-2">
                    <label className="text-sm font-semibold">ชื่อลูกค้า
                        <Input className="mt-1" value={name} onChange={(event) => setName(event.target.value)} autoComplete="off" required />
                    </label>
                    <label className="text-sm font-semibold">โทรศัพท์
                        <Input className="mt-1" value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" autoComplete="tel" />
                    </label>
                    <label className="text-sm font-semibold">กลุ่มลูกค้า
                        <select value={groupType} onChange={(event) => setGroupType(event.target.value as OwnerGroupValue)} className="mt-1 min-h-[var(--ui-control-height-md)] w-full rounded-[var(--ui-radius-md)] border border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 text-sm focus-visible:outline-none focus-visible:shadow-[var(--ui-shadow-focus)]">
                            {groupOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                    </label>
                    <label className="text-sm font-semibold">Vendor code
                        <Input className="mt-1" value={venderCode} onChange={(event) => setVenderCode(event.target.value)} autoComplete="off" />
                    </label>
                </div>
                <div className="flex justify-end">
                    <Button type="submit" disabled={saving || !name.trim()}>
                        <Plus className="h-4 w-4" aria-hidden="true" /> {saving ? 'กำลังบันทึก...' : 'บันทึกลูกค้า'}
                    </Button>
                </div>
            </form>
        </Section>
    );
}
