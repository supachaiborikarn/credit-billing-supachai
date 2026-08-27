'use client';

import * as React from 'react';
import Link from 'next/link';
import { Check, Search, Truck, UserRound, Users } from 'lucide-react';
import { Button, EmptyState, Input, LoadingState, Notice, Section } from '@/components/ui';
import type {
    SaleFlowCustomerSelection,
    TruckSelectionMode,
} from '@/lib/sales/sale-flow';
import type { SaleFlowFieldErrors } from '@/lib/sales/sale-validation';
import { cn } from '@/lib/utils';

interface CustomerOption {
    id: string;
    name: string;
    code: string | null;
    balance?: number;
    trucks: Array<{ id: string; licensePlate: string }>;
}

export interface CustomerTruckStepProps {
    value: SaleFlowCustomerSelection;
    onChange: (value: SaleFlowCustomerSelection) => void;
    truckSelection: TruckSelectionMode;
    userRole: 'ADMIN' | 'STAFF';
    required?: boolean;
    errors?: SaleFlowFieldErrors;
    disabled?: boolean;
}

function normalizeSearch(value: string) {
    return value.trim().toLocaleLowerCase('th-TH');
}

export function CustomerTruckStep({
    value,
    onChange,
    truckSelection,
    userRole,
    required = true,
    errors,
    disabled = false,
}: CustomerTruckStepProps) {
    const [owners, setOwners] = React.useState<CustomerOption[]>([]);
    const [query, setQuery] = React.useState('');
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    const loadOwners = React.useCallback(async (signal?: AbortSignal) => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/owners', { cache: 'no-store', signal });
            const payload = await response.json().catch(() => []);
            if (!response.ok) {
                throw new Error(payload?.error || 'โหลดรายชื่อลูกค้าไม่สำเร็จ');
            }
            setOwners(Array.isArray(payload) ? payload : payload.owners || []);
        } catch (loadError) {
            if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
            setError(loadError instanceof Error ? loadError.message : 'โหลดรายชื่อลูกค้าไม่สำเร็จ');
        } finally {
            if (!signal?.aborted) setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        const controller = new AbortController();
        void loadOwners(controller.signal);
        return () => controller.abort();
    }, [loadOwners]);

    const selectedOwner = React.useMemo(
        () => owners.find((owner) => owner.id === value.ownerId) || null,
        [owners, value.ownerId]
    );

    const filteredOwners = React.useMemo(() => {
        const normalized = normalizeSearch(query);
        if (!normalized) return owners.slice(0, 8);

        return owners
            .filter((owner) => {
                const ownerText = `${owner.name} ${owner.code || ''}`.toLocaleLowerCase('th-TH');
                return ownerText.includes(normalized)
                    || owner.trucks.some((truck) => truck.licensePlate.toLocaleLowerCase('th-TH').includes(normalized));
            })
            .slice(0, 8);
    }, [owners, query]);

    const selectOwner = (owner: CustomerOption) => {
        const normalized = normalizeSearch(query);
        const matchingTruck = normalized
            ? owner.trucks.find((truck) => truck.licensePlate.toLocaleLowerCase('th-TH').includes(normalized))
            : undefined;
        const autoTruck = matchingTruck || (owner.trucks.length === 1 ? owner.trucks[0] : undefined);

        onChange({
            ownerId: owner.id,
            ownerName: owner.name,
            ownerCode: owner.code,
            truckId: autoTruck?.id || null,
            licensePlate: autoTruck?.licensePlate || '',
        });
        setQuery('');
    };

    const selectTruck = (truck: { id: string; licensePlate: string }) => {
        onChange({
            ...value,
            truckId: truck.id,
            licensePlate: truck.licensePlate,
        });
    };

    const clearSelection = () => {
        onChange({
            ownerId: null,
            ownerName: '',
            ownerCode: null,
            truckId: null,
            licensePlate: '',
        });
        setQuery('');
    };

    return (
        <Section
            title={required ? 'ลูกค้าและรถ' : 'ลูกค้าและรถ (ถ้ามี)'}
            description={required ? 'เลือกลูกค้าและทะเบียนให้ตรงกับบิลก่อนบันทึก' : 'ใช้เพื่อผูกประวัติการซื้อกับลูกค้า'}
            action={userRole === 'ADMIN' ? (
                <Link href="/owners" className="rounded-sm text-xs font-bold text-[var(--ui-primary-text)] hover:underline focus-visible:outline-none focus-visible:shadow-[var(--ui-shadow-focus)]">
                    จัดการลูกค้า
                </Link>
            ) : undefined}
        >
            {error && owners.length === 0 ? (
                <Notice
                    tone="danger"
                    title="โหลดข้อมูลลูกค้าไม่สำเร็จ"
                    action={<Button variant="outline" size="sm" onClick={() => void loadOwners()}>ลองใหม่</Button>}
                >
                    {error}
                </Notice>
            ) : selectedOwner ? (
                <div className="space-y-4">
                    <div className="flex items-start gap-3 rounded-[var(--ui-radius-md)] border border-[var(--ui-border)] bg-[var(--ui-surface-subtle)] p-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--ui-radius-md)] bg-[var(--ui-surface)]">
                            <UserRound className="h-5 w-5 text-[var(--ui-text-muted)]" aria-hidden="true" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="font-bold">{selectedOwner.name}</div>
                            <div className="mt-0.5 text-xs text-[var(--ui-text-muted)]">
                                {selectedOwner.code || 'ไม่มีรหัส'} · {selectedOwner.trucks.length} คัน
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={clearSelection}
                            disabled={disabled}
                            className="shrink-0 rounded-[var(--ui-radius-sm)] px-2 py-1 text-xs font-semibold text-[var(--ui-primary-text)] hover:bg-[var(--ui-primary-50)] focus-visible:outline-none focus-visible:shadow-[var(--ui-shadow-focus)] disabled:opacity-50"
                        >
                            เปลี่ยน
                        </button>
                    </div>

                    <div>
                        <div className="mb-2 text-sm font-semibold">ทะเบียนรถ</div>
                        {selectedOwner.trucks.length > 0 && (
                            <div className="grid gap-2 sm:grid-cols-2">
                                {selectedOwner.trucks.map((truck) => {
                                    const selected = value.truckId === truck.id;
                                    return (
                                        <button
                                            key={truck.id}
                                            type="button"
                                            onClick={() => selectTruck(truck)}
                                            disabled={disabled}
                                            aria-pressed={selected}
                                            className={cn(
                                                'flex min-h-[var(--ui-touch-target)] items-center gap-3 rounded-[var(--ui-radius-md)] border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:shadow-[var(--ui-shadow-focus)] disabled:opacity-50',
                                                selected
                                                    ? 'border-[var(--ui-primary-500)] bg-[var(--ui-primary-50)] text-[var(--ui-primary-700)]'
                                                    : 'border-[var(--ui-border)] hover:bg-[var(--ui-surface-subtle)]'
                                            )}
                                        >
                                            <Truck className="h-4 w-4 shrink-0" aria-hidden="true" />
                                            <span className="min-w-0 flex-1 truncate font-semibold">{truck.licensePlate}</span>
                                            {selected && <Check className="h-4 w-4 shrink-0" aria-hidden="true" />}
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {truckSelection === 'ALLOW_NEW_PLATE_FOR_OWNER' && (
                            <div className={selectedOwner.trucks.length > 0 ? 'mt-3' : undefined}>
                                <Input
                                    label="หรือกรอกทะเบียนใหม่ของลูกค้ารายนี้"
                                    value={value.truckId ? '' : value.licensePlate}
                                    error={!value.truckId ? errors?.licensePlate || errors?.truck : undefined}
                                    onChange={(event) => onChange({
                                        ...value,
                                        truckId: null,
                                        licensePlate: event.target.value.toUpperCase(),
                                    })}
                                    disabled={disabled}
                                    placeholder="เช่น 1กข 1234"
                                    autoComplete="off"
                                />
                            </div>
                        )}

                        {truckSelection === 'EXISTING_ONLY' && (errors?.truck || errors?.licensePlate) && (
                            <div className="mt-3">
                                <Notice tone="danger">{errors.truck || errors.licensePlate}</Notice>
                            </div>
                        )}

                        {truckSelection === 'EXISTING_ONLY' && selectedOwner.trucks.length === 0 && (
                            <Notice tone="warning" title="ลูกค้ารายนี้ยังไม่มีรถในระบบ">
                                {userRole === 'ADMIN'
                                    ? 'เพิ่มรถในข้อมูลลูกค้าก่อนบันทึกรายการเงินเชื่อของปั๊มแก๊ส'
                                    : 'ติดต่อผู้ดูแลเพื่อเพิ่มทะเบียนรถก่อนบันทึกรายการเงินเชื่อ'}
                            </Notice>
                        )}
                    </div>
                </div>
            ) : (
                <div className="space-y-3">
                    <Input
                        label="ค้นหาลูกค้าหรือทะเบียนรถ"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="พิมพ์ชื่อลูกค้า รหัส หรือทะเบียน"
                        disabled={disabled}
                        leftIcon={<Search className="h-4 w-4" aria-hidden="true" />}
                        error={errors?.owner}
                    />

                    {loading && owners.length === 0 ? (
                        <LoadingState label="กำลังโหลดรายชื่อลูกค้า" className="space-y-2">
                            {[0, 1, 2].map((item) => (
                                <div key={item} className="h-12 animate-pulse rounded-[var(--ui-radius-md)] bg-[var(--ui-surface-subtle)]" />
                            ))}
                        </LoadingState>
                    ) : filteredOwners.length > 0 ? (
                        <div className="divide-y divide-[var(--ui-border)] overflow-hidden rounded-[var(--ui-radius-md)] border border-[var(--ui-border)]">
                            {filteredOwners.map((owner) => (
                                <button
                                    key={owner.id}
                                    type="button"
                                    onClick={() => selectOwner(owner)}
                                    disabled={disabled}
                                    className="flex min-h-[var(--ui-touch-target)] w-full items-center gap-3 bg-[var(--ui-surface)] px-3 py-2 text-left transition-colors hover:bg-[var(--ui-surface-subtle)] focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_3px_var(--ui-focus-ring)] disabled:opacity-50"
                                >
                                    <Users className="h-4 w-4 shrink-0 text-[var(--ui-text-muted)]" aria-hidden="true" />
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-semibold">{owner.name}</span>
                                        <span className="block truncate text-xs text-[var(--ui-text-muted)]">
                                            {owner.code || 'ไม่มีรหัส'}
                                            {owner.trucks.length > 0 ? ` · ${owner.trucks.map((truck) => truck.licensePlate).join(', ')}` : ' · ยังไม่มีรถ'}
                                        </span>
                                    </span>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <EmptyState
                            compact
                            icon={Users}
                            title="ไม่พบลูกค้าหรือทะเบียน"
                            description={userRole === 'ADMIN'
                                ? 'ตรวจคำค้น หรือไปจัดการข้อมูลลูกค้าเพื่อเพิ่มรายการใหม่'
                                : 'ตรวจคำค้นอีกครั้ง หรือติดต่อผู้ดูแลหากยังไม่มีข้อมูลลูกค้า'}
                            action={userRole === 'ADMIN' ? (
                                <Link href="/owners" className="rounded-sm text-sm font-bold text-[var(--ui-primary-text)] hover:underline focus-visible:outline-none focus-visible:shadow-[var(--ui-shadow-focus)]">
                                    ไปหน้าจัดการลูกค้า
                                </Link>
                            ) : undefined}
                        />
                    )}
                </div>
            )}
        </Section>
    );
}
