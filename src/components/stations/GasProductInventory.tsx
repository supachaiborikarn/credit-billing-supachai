'use client';

import * as React from 'react';
import { AlertTriangle, Check, ChevronDown, ChevronUp, History, Loader2, PackagePlus, Pencil, Plus, ShoppingBag, X } from 'lucide-react';
import { EmptyState, Notice, Section } from '@/components/ui';
import { formatCurrency } from '@/lib/gas';
import type { StationContextPayload } from '@/types/station';

interface InventoryItem {
    id: string;
    productId: string;
    product: { id: string; name: string; unit: string; salePrice: number; costPrice: number | null };
    quantity: number;
    alertLevel: number | null;
}

interface HistoryItem {
    id: string;
    type: 'IN' | 'OUT';
    product: { name: string };
    quantity: number;
    amount?: number;
    createdAt: string;
}

const CONTROL = 'min-h-11 w-full rounded-[var(--ui-radius-md)] border border-[var(--ui-border-strong)] bg-[var(--ui-surface)] px-3 py-2 text-[var(--ui-text)] outline-none focus-visible:shadow-[var(--ui-shadow-focus)] disabled:cursor-not-allowed disabled:opacity-60';

export function GasProductInventory({ context, writeBlocked }: { context: StationContextPayload; writeBlocked: boolean }) {
    const stationNumber = context.station.number;
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [inventory, setInventory] = React.useState<InventoryItem[]>([]);
    const [message, setMessage] = React.useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
    const [showAdd, setShowAdd] = React.useState(false);
    const [newProduct, setNewProduct] = React.useState({ name: '', unit: 'ขวด', salePrice: '', quantity: '', alertLevel: '' });
    const [receivingId, setReceivingId] = React.useState<string | null>(null);
    const [receiveQty, setReceiveQty] = React.useState('');
    const [editingId, setEditingId] = React.useState<string | null>(null);
    const [editPrice, setEditPrice] = React.useState('');
    const [editAlertLevel, setEditAlertLevel] = React.useState('');
    const [showHistory, setShowHistory] = React.useState(false);
    const [historyLoading, setHistoryLoading] = React.useState(false);
    const [history, setHistory] = React.useState<HistoryItem[]>([]);

    const loadInventory = React.useCallback(async () => {
        setLoading(true);
        try {
            const response = await fetch(`/api/gas-station/${stationNumber}/products`, { cache: 'no-store' });
            const payload = await response.json().catch(() => null);
            if (!response.ok || !Array.isArray(payload)) throw new Error(payload?.error || 'โหลดสต็อกสินค้าไม่สำเร็จ');
            setInventory(payload);
            setMessage((current) => current?.tone === 'danger' ? null : current);
        } catch (error) {
            setMessage({ tone: 'danger', text: error instanceof Error ? error.message : 'โหลดสต็อกสินค้าไม่สำเร็จ' });
        } finally {
            setLoading(false);
        }
    }, [stationNumber]);

    React.useEffect(() => { void loadInventory(); }, [loadInventory]);

    const loadHistory = React.useCallback(async () => {
        setHistoryLoading(true);
        try {
            const response = await fetch(`/api/gas-station/${stationNumber}/products/history`, { cache: 'no-store' });
            const payload = await response.json().catch(() => null);
            if (!response.ok) throw new Error(payload?.error || 'โหลดประวัติสินค้าไม่สำเร็จ');
            setHistory(Array.isArray(payload) ? payload : payload?.history || []);
        } catch (error) {
            setMessage({ tone: 'danger', text: error instanceof Error ? error.message : 'โหลดประวัติสินค้าไม่สำเร็จ' });
        } finally {
            setHistoryLoading(false);
        }
    }, [stationNumber]);

    const postAction = async (body: Record<string, unknown>) => {
        const response = await fetch(`/api/gas-station/${stationNumber}/products`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || 'ทำรายการสินค้าไม่สำเร็จ');
        return payload;
    };

    const createProduct = async () => {
        const price = Number(newProduct.salePrice);
        const quantity = newProduct.quantity === '' ? 0 : Number(newProduct.quantity);
        const alertLevel = newProduct.alertLevel === '' ? null : Number(newProduct.alertLevel);
        if (!newProduct.name.trim() || !newProduct.unit.trim() || !Number.isFinite(price) || price <= 0) {
            setMessage({ tone: 'danger', text: 'กรุณากรอกชื่อสินค้า หน่วย และราคาขายมากกว่า 0' });
            return;
        }
        if (!Number.isInteger(quantity) || quantity < 0 || (alertLevel !== null && (!Number.isInteger(alertLevel) || alertLevel < 0))) {
            setMessage({ tone: 'danger', text: 'จำนวนเริ่มต้นและระดับเตือนต้องเป็นจำนวนเต็มไม่ติดลบ' });
            return;
        }
        setSaving(true); setMessage(null);
        try {
            await postAction({ action: 'create', name: newProduct.name.trim(), unit: newProduct.unit.trim(), salePrice: price, quantity, alertLevel });
            setNewProduct({ name: '', unit: 'ขวด', salePrice: '', quantity: '', alertLevel: '' });
            setShowAdd(false);
            setMessage({ tone: 'success', text: 'เพิ่มสินค้าเรียบร้อย' });
            await loadInventory();
        } catch (error) {
            setMessage({ tone: 'danger', text: error instanceof Error ? error.message : 'เพิ่มสินค้าไม่สำเร็จ' });
        } finally { setSaving(false); }
    };

    const receive = async (item: InventoryItem) => {
        const quantity = Number(receiveQty);
        if (!Number.isInteger(quantity) || quantity <= 0) {
            setMessage({ tone: 'danger', text: 'จำนวนรับเข้าต้องเป็นจำนวนเต็มมากกว่า 0' });
            return;
        }
        setSaving(true); setMessage(null);
        try {
            await postAction({ action: 'receive', productId: item.productId, quantity });
            setReceivingId(null); setReceiveQty('');
            setMessage({ tone: 'success', text: `รับ ${item.product.name} เข้า ${quantity} ${item.product.unit}` });
            await loadInventory();
            if (showHistory) await loadHistory();
        } catch (error) {
            setMessage({ tone: 'danger', text: error instanceof Error ? error.message : 'รับของเข้าไม่สำเร็จ' });
        } finally { setSaving(false); }
    };

    const update = async (item: InventoryItem) => {
        const salePrice = Number(editPrice);
        const alertLevel = editAlertLevel === '' ? null : Number(editAlertLevel);
        if (!Number.isFinite(salePrice) || salePrice <= 0 || (alertLevel !== null && (!Number.isInteger(alertLevel) || alertLevel < 0))) {
            setMessage({ tone: 'danger', text: 'ตรวจราคาขายและระดับเตือนอีกครั้ง' });
            return;
        }
        setSaving(true); setMessage(null);
        try {
            await postAction({ action: 'update', productId: item.productId, salePrice, alertLevel });
            setEditingId(null);
            setMessage({ tone: 'success', text: `อัปเดต ${item.product.name} แล้ว` });
            await loadInventory();
        } catch (error) {
            setMessage({ tone: 'danger', text: error instanceof Error ? error.message : 'อัปเดตสินค้าไม่สำเร็จ' });
        } finally { setSaving(false); }
    };

    if (!context.station.hasProducts) return null;
    const lowStockCount = inventory.filter((item) => item.alertLevel !== null && item.quantity <= item.alertLevel).length;

    return (
        <Section title="สินค้าและสต็อก" description="เพิ่มสินค้า รับของเข้า แก้ราคาขาย/ระดับเตือน และดูประวัติ IN/OUT ของ station-5">
            <div className="space-y-4">
                {writeBlocked && <Notice tone="warning" title="กำลังตรวจสถานะสถานี">บล็อกการแก้สต็อกไว้จน StationContext รีเฟรชสำเร็จ</Notice>}
                {message && <Notice tone={message.tone} title={message.tone === 'success' ? 'บันทึกแล้ว' : 'ทำรายการไม่สำเร็จ'}>{message.text}</Notice>}
                {lowStockCount > 0 && <Notice tone="warning" title={`สินค้าใกล้หมด ${lowStockCount} รายการ`}>ตรวจจำนวนคงเหลือและระดับเตือนก่อนรอบขายถัดไป</Notice>}

                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 font-bold"><ShoppingBag className="h-5 w-5" aria-hidden="true" /> สต็อกปัจจุบัน</div>
                    <button type="button" onClick={() => setShowAdd((value) => !value)} disabled={writeBlocked || saving} className="inline-flex min-h-11 items-center gap-2 rounded-[var(--ui-radius-md)] bg-[var(--ui-primary-700)] px-4 text-sm font-semibold text-white hover:bg-[var(--ui-primary-800)] disabled:opacity-60">
                        {showAdd ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />} {showAdd ? 'ยกเลิก' : 'เพิ่มสินค้า'}
                    </button>
                </div>

                {showAdd && <div className="grid gap-3 rounded-[var(--ui-radius-lg)] border border-[var(--ui-border)] p-4 sm:grid-cols-2">
                    <label className="text-sm font-semibold sm:col-span-2">ชื่อสินค้า<input className={`${CONTROL} mt-1`} value={newProduct.name} disabled={writeBlocked || saving} onChange={(e) => setNewProduct((v) => ({ ...v, name: e.target.value }))} /></label>
                    <label className="text-sm font-semibold">หน่วย<input className={`${CONTROL} mt-1`} value={newProduct.unit} disabled={writeBlocked || saving} onChange={(e) => setNewProduct((v) => ({ ...v, unit: e.target.value }))} /></label>
                    <label className="text-sm font-semibold">ราคาขาย<input inputMode="decimal" className={`${CONTROL} mt-1 text-right font-mono`} value={newProduct.salePrice} disabled={writeBlocked || saving} onChange={(e) => setNewProduct((v) => ({ ...v, salePrice: e.target.value }))} /></label>
                    <label className="text-sm font-semibold">จำนวนเริ่มต้น<input inputMode="numeric" className={`${CONTROL} mt-1 text-right font-mono`} value={newProduct.quantity} disabled={writeBlocked || saving} onChange={(e) => setNewProduct((v) => ({ ...v, quantity: e.target.value }))} /></label>
                    <label className="text-sm font-semibold">เตือนเมื่อเหลือ ≤<input inputMode="numeric" className={`${CONTROL} mt-1 text-right font-mono`} value={newProduct.alertLevel} disabled={writeBlocked || saving} onChange={(e) => setNewProduct((v) => ({ ...v, alertLevel: e.target.value }))} /></label>
                    <button type="button" onClick={() => void createProduct()} disabled={writeBlocked || saving} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--ui-radius-md)] bg-[var(--ui-primary-700)] px-4 font-semibold text-white disabled:opacity-60 sm:col-span-2">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} บันทึกสินค้า</button>
                </div>}

                {loading ? <div className="flex min-h-40 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin" /></div> : inventory.length === 0 ? <EmptyState title="ยังไม่มีสินค้า" description="เพิ่มสินค้าเพื่อเริ่มต้นสต็อก station-5" icon={ShoppingBag} /> : <div className="space-y-3">
                    {inventory.map((item) => {
                        const low = item.alertLevel !== null && item.quantity <= item.alertLevel;
                        return <div key={item.id} className="rounded-[var(--ui-radius-md)] border border-[var(--ui-border)] p-4">
                            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex items-center gap-2 font-semibold"><span className="truncate">{item.product.name}</span>{low && <span className="inline-flex items-center gap-1 rounded-full bg-[var(--ui-warning-bg)] px-2 py-0.5 text-xs text-[var(--ui-warning-text)]"><AlertTriangle className="h-3 w-3" />ใกล้หมด</span>}</div><div className="mt-1 text-sm text-[var(--ui-text-muted)]">฿{formatCurrency(item.product.salePrice)}/{item.product.unit}{item.alertLevel !== null ? ` · เตือน ≤ ${item.alertLevel}` : ''}</div></div><div className="text-right"><div className="font-mono text-2xl font-bold">{item.quantity}</div><div className="text-xs text-[var(--ui-text-muted)]">{item.product.unit} คงเหลือ</div></div></div>
                            {receivingId === item.id ? <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]"><input inputMode="numeric" autoFocus className={`${CONTROL} text-right font-mono`} value={receiveQty} disabled={saving} placeholder={`จำนวน (${item.product.unit})`} onChange={(e) => setReceiveQty(e.target.value)} /><button type="button" onClick={() => void receive(item)} disabled={saving} className="inline-flex min-h-11 items-center justify-center gap-1 rounded-[var(--ui-radius-md)] bg-[var(--ui-success-bg)] px-3 font-semibold text-[var(--ui-success-text)]"><Check className="h-4 w-4" />รับเข้า</button><button type="button" onClick={() => { setReceivingId(null); setReceiveQty(''); }} className="inline-flex min-h-11 items-center justify-center rounded-[var(--ui-radius-md)] border border-[var(--ui-border)] px-3"><X className="h-4 w-4" /></button></div>
                            : editingId === item.id ? <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]"><label className="text-xs font-semibold">ราคาขาย<input inputMode="decimal" className={`${CONTROL} mt-1 text-right font-mono`} value={editPrice} disabled={saving} onChange={(e) => setEditPrice(e.target.value)} /></label><label className="text-xs font-semibold">เตือน ≤<input inputMode="numeric" className={`${CONTROL} mt-1 text-right font-mono`} value={editAlertLevel} disabled={saving} onChange={(e) => setEditAlertLevel(e.target.value)} /></label><button type="button" onClick={() => void update(item)} disabled={saving} className="mt-5 inline-flex min-h-11 items-center justify-center rounded-[var(--ui-radius-md)] bg-[var(--ui-success-bg)] px-3 text-[var(--ui-success-text)]"><Check className="h-4 w-4" /></button><button type="button" onClick={() => setEditingId(null)} className="mt-5 inline-flex min-h-11 items-center justify-center rounded-[var(--ui-radius-md)] border border-[var(--ui-border)] px-3"><X className="h-4 w-4" /></button></div>
                            : <div className="mt-3 grid gap-2 sm:grid-cols-2"><button type="button" disabled={writeBlocked || saving} onClick={() => { setReceivingId(item.id); setEditingId(null); setReceiveQty(''); }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--ui-radius-md)] border border-[var(--ui-border)] px-3 text-sm font-semibold hover:bg-[var(--ui-surface-subtle)] disabled:opacity-60"><PackagePlus className="h-4 w-4" />รับของเข้า</button><button type="button" disabled={writeBlocked || saving} onClick={() => { setEditingId(item.id); setReceivingId(null); setEditPrice(String(item.product.salePrice)); setEditAlertLevel(item.alertLevel === null ? '' : String(item.alertLevel)); }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--ui-radius-md)] border border-[var(--ui-border)] px-3 text-sm font-semibold hover:bg-[var(--ui-surface-subtle)] disabled:opacity-60"><Pencil className="h-4 w-4" />แก้ราคา/เตือน</button></div>}
                        </div>;
                    })}
                </div>}

                <div className="rounded-[var(--ui-radius-lg)] border border-[var(--ui-border)]">
                    <button type="button" onClick={() => { const next = !showHistory; setShowHistory(next); if (next) void loadHistory(); }} className="flex min-h-11 w-full items-center justify-between gap-3 px-4 py-3 text-left font-semibold"><span className="flex items-center gap-2"><History className="h-4 w-4" />ประวัติรับเข้า/ขายล่าสุด</span>{showHistory ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</button>
                    {showHistory && <div className="border-t border-[var(--ui-border)] p-3">{historyLoading ? <div className="flex min-h-24 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div> : history.length === 0 ? <div className="py-6 text-center text-sm text-[var(--ui-text-muted)]">ยังไม่มีประวัติ</div> : <div className="max-h-96 space-y-2 overflow-y-auto">{history.map((row) => <div key={`${row.type}-${row.id}`} className="flex items-center justify-between gap-3 rounded-[var(--ui-radius-sm)] bg-[var(--ui-surface-subtle)] px-3 py-2 text-sm"><div className="min-w-0"><div className="truncate font-medium">{row.product.name}</div><div className="text-xs text-[var(--ui-text-muted)]">{new Date(row.createdAt).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div></div><div className="text-right font-mono"><div>{row.type === 'IN' ? '+' : '-'}{row.quantity}</div>{row.type === 'OUT' && row.amount !== undefined && <div className="text-xs text-[var(--ui-text-muted)]">฿{formatCurrency(row.amount)}</div>}</div></div>)}</div>}</div>}
                </div>
            </div>
        </Section>
    );
}
