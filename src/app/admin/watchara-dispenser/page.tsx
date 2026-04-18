'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import {
    Activity,
    AlertTriangle,
    CheckCircle2,
    Database,
    Fuel,
    PlayCircle,
    RefreshCw,
    Server,
    ShieldAlert,
    Wrench,
} from 'lucide-react';

interface WatcharaDispenserStatus {
    sourceCode: string;
    sourceName: string;
    env: {
        hasExternalDatabaseUrl: boolean;
    };
    schema: {
        ready: boolean;
        error: string | null;
    };
    mapping: {
        localStationId: string;
        externalStationRef: string;
        fuelFamily: string;
        rollupMode: string;
        shiftKey: string;
    };
    source: {
        id: string;
        isEnabled: boolean;
        station: { id: string; name: string };
        lastSyncAttemptAt: string | null;
        lastSyncedAt: string | null;
        lastSeenSourceAt: string | null;
        lastError: string | null;
    } | null;
    localLanding: {
        transactionCount: number;
        latestSoldAt: string | null;
        latestBusinessDate: string | null;
        latestSyncedAt: string | null;
        recent7DayCount: number;
    };
    liveProbe: {
        attempted: boolean;
        latestTransactionAt: string | null;
        error: string | null;
    };
    stale: {
        isStale: boolean;
        staleHours: number | null;
        thresholdHours: number;
    };
}

interface SyncResponse {
    success: boolean;
    result: {
        sourceCode: string;
        startDate: string;
        endDate: string;
        dayCount: number;
        dryRun: boolean;
        rowsFetched: number;
        created: number;
        updated: number;
        latestSourceTransactionAt: string | null;
        stale: {
            isStale: boolean;
            staleHours: number | null;
            thresholdHours: number;
        };
    };
}

type LoadingAction = 'refresh' | 'probe' | 'bootstrap' | 'dryRun' | 'sync' | null;

function formatDateTime(value: string | null) {
    if (!value) return '-';

    return new Date(value).toLocaleString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function getTodayDateInputValue() {
    return new Date().toISOString().split('T')[0];
}

export default function WatcharaDispenserAdminPage() {
    const [status, setStatus] = useState<WatcharaDispenserStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadingAction, setLoadingAction] = useState<LoadingAction>(null);
    const [error, setError] = useState<string | null>(null);
    const [syncResult, setSyncResult] = useState<SyncResponse['result'] | null>(null);
    const [startDate, setStartDate] = useState(getTodayDateInputValue());
    const [endDate, setEndDate] = useState(getTodayDateInputValue());

    const fetchStatus = async (probe: boolean = false) => {
        setLoadingAction(probe ? 'probe' : 'refresh');
        setError(null);

        try {
            const suffix = probe ? '?probe=1' : '';
            const res = await fetch(`/api/admin/watchara-dispenser/status${suffix}`);
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'โหลดสถานะไม่สำเร็จ');
            }

            setStatus(data);
        } catch (fetchError) {
            console.error('Watchara status fetch error:', fetchError);
            setError(fetchError instanceof Error ? fetchError.message : 'โหลดสถานะไม่สำเร็จ');
        } finally {
            setLoading(false);
            setLoadingAction(null);
        }
    };

    useEffect(() => {
        fetchStatus(false);
    }, []);

    const handleBootstrap = async () => {
        setLoadingAction('bootstrap');
        setError(null);

        try {
            const res = await fetch('/api/admin/watchara-dispenser/bootstrap', {
                method: 'POST',
            });
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Bootstrap ไม่สำเร็จ');
            }

            await fetchStatus(false);
            alert('สร้าง source registry ฝั่ง local เรียบร้อย');
        } catch (bootstrapError) {
            console.error('Watchara bootstrap error:', bootstrapError);
            setError(bootstrapError instanceof Error ? bootstrapError.message : 'Bootstrap ไม่สำเร็จ');
        } finally {
            setLoadingAction(null);
        }
    };

    const handleSync = async (dryRun: boolean) => {
        setLoadingAction(dryRun ? 'dryRun' : 'sync');
        setError(null);

        try {
            if (!dryRun) {
                const confirmed = confirm('ยืนยัน import จริง? ขั้นตอนนี้จะเขียนข้อมูล external rows ลง local landing tables');
                if (!confirmed) {
                    setLoadingAction(null);
                    return;
                }
            }

            const res = await fetch('/api/admin/watchara-dispenser/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    startDate,
                    endDate,
                    dryRun,
                }),
            });
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Sync ไม่สำเร็จ');
            }

            setSyncResult(data.result);
            await fetchStatus(false);
        } catch (syncError) {
            console.error('Watchara sync error:', syncError);
            setError(syncError instanceof Error ? syncError.message : 'Sync ไม่สำเร็จ');
        } finally {
            setLoadingAction(null);
        }
    };

    const cards = status ? [
        {
            label: 'External ENV',
            value: status.env.hasExternalDatabaseUrl ? 'พร้อม' : 'ยังไม่มี',
            tone: status.env.hasExternalDatabaseUrl ? 'emerald' : 'amber',
            icon: Server,
        },
        {
            label: 'Local Schema',
            value: status.schema.ready ? 'พร้อม' : 'ยังไม่พร้อม',
            tone: status.schema.ready ? 'emerald' : 'red',
            icon: Database,
        },
        {
            label: 'Source Registry',
            value: status.source ? 'พร้อม' : 'ยังไม่มี',
            tone: status.source ? 'emerald' : 'amber',
            icon: Wrench,
        },
        {
            label: 'Imported Rows',
            value: String(status.localLanding.transactionCount),
            tone: 'blue',
            icon: Fuel,
        },
    ] : [];

    return (
        <Sidebar>
            <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6">
                <div className="max-w-7xl mx-auto space-y-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-start gap-3">
                            <div className="p-3 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg shadow-amber-500/20">
                                <Fuel className="text-white" size={28} />
                            </div>
                            <div>
                                <h1 className="text-2xl md:text-3xl font-bold text-white">
                                    Watchara Shared Dispenser
                                </h1>
                                <p className="text-sm text-slate-300 mt-1">
                                    พร้อมสำหรับ bootstrap, probe, และ dry-run sync โดยยังไม่กระทบรายงานหลัก
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-3">
                            <button
                                onClick={() => fetchStatus(false)}
                                disabled={loadingAction !== null}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white disabled:opacity-50 transition-colors"
                            >
                                <RefreshCw size={18} className={loadingAction === 'refresh' ? 'animate-spin' : ''} />
                                รีเฟรช
                            </button>

                            <button
                                onClick={() => fetchStatus(true)}
                                disabled={loadingAction !== null || !status?.env.hasExternalDatabaseUrl}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 disabled:opacity-50 transition-colors"
                            >
                                <Activity size={18} className={loadingAction === 'probe' ? 'animate-pulse' : ''} />
                                Probe External
                            </button>

                            <button
                                onClick={handleBootstrap}
                                disabled={loadingAction !== null}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 disabled:opacity-50 transition-colors"
                            >
                                <Wrench size={18} className={loadingAction === 'bootstrap' ? 'animate-spin' : ''} />
                                Bootstrap Source
                            </button>
                        </div>
                    </div>

                    {error && (
                        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-100">
                            <div className="flex items-start gap-3">
                                <ShieldAlert className="mt-0.5 text-red-300" size={20} />
                                <div>
                                    <p className="font-semibold">มีข้อผิดพลาด</p>
                                    <p className="text-sm text-red-200/90 mt-1">{error}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {!loading && status && !status.env.hasExternalDatabaseUrl && (
                        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-50">
                            <div className="flex items-start gap-3">
                                <AlertTriangle className="mt-0.5 text-amber-300" size={20} />
                                <div>
                                    <p className="font-semibold">ยังขาด WATCHARA_DISPENSER_DATABASE_URL</p>
                                    <p className="text-sm text-amber-100/90 mt-1">
                                        ตอนนี้ local landing พร้อมแล้ว แต่ยัง probe/sync external source จริงไม่ได้จนกว่าจะใส่ env ตัวนี้
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {!loading && status && status.stale.isStale && (
                        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-50">
                            <div className="flex items-start gap-3">
                                <AlertTriangle className="mt-0.5 text-red-300" size={20} />
                                <div>
                                    <p className="font-semibold">External source stale</p>
                                    <p className="text-sm text-red-100/90 mt-1">
                                        แหล่งข้อมูลภายนอกไม่อัปเดตมาประมาณ {status.stale.staleHours ?? '-'} ชั่วโมง
                                        เกิน threshold {status.stale.thresholdHours} ชั่วโมง
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {loading ? (
                        <div className="flex justify-center items-center h-64">
                            <div className="h-10 w-10 rounded-full border-4 border-slate-700 border-t-amber-400 animate-spin" />
                        </div>
                    ) : status ? (
                        <>
                            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                                {cards.map((card) => {
                                    const toneClass = card.tone === 'emerald'
                                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
                                        : card.tone === 'amber'
                                            ? 'border-amber-500/30 bg-amber-500/10 text-amber-100'
                                            : card.tone === 'red'
                                                ? 'border-red-500/30 bg-red-500/10 text-red-100'
                                                : 'border-cyan-500/30 bg-cyan-500/10 text-cyan-100';

                                    return (
                                        <div key={card.label} className={`rounded-2xl border p-4 ${toneClass}`}>
                                            <div className="flex items-center gap-2 text-sm opacity-90">
                                                <card.icon size={18} />
                                                <span>{card.label}</span>
                                            </div>
                                            <p className="mt-3 text-2xl font-bold">{card.value}</p>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="grid xl:grid-cols-2 gap-6">
                                <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-5 space-y-4">
                                    <h2 className="text-lg font-semibold text-white">สถานะระบบ</h2>

                                    <div className="grid md:grid-cols-2 gap-4 text-sm">
                                        <div className="rounded-2xl bg-black/20 p-4">
                                            <p className="text-slate-400">Source Code</p>
                                            <p className="text-white font-medium mt-1">{status.sourceCode}</p>
                                        </div>
                                        <div className="rounded-2xl bg-black/20 p-4">
                                            <p className="text-slate-400">Local Station</p>
                                            <p className="text-white font-medium mt-1">
                                                {status.source?.station.name || status.mapping.localStationId}
                                            </p>
                                        </div>
                                        <div className="rounded-2xl bg-black/20 p-4">
                                            <p className="text-slate-400">External Ref</p>
                                            <p className="text-white font-medium mt-1">{status.mapping.externalStationRef}</p>
                                        </div>
                                        <div className="rounded-2xl bg-black/20 p-4">
                                            <p className="text-slate-400">Fuel Family</p>
                                            <p className="text-white font-medium mt-1">{status.mapping.fuelFamily}</p>
                                        </div>
                                    </div>

                                    <div className="space-y-3 text-sm">
                                        <div className="flex items-center justify-between rounded-xl bg-black/20 px-4 py-3">
                                            <span className="text-slate-400">Schema Ready</span>
                                            <span className={status.schema.ready ? 'text-emerald-300' : 'text-red-300'}>
                                                {status.schema.ready ? 'พร้อม' : 'ยังไม่พร้อม'}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between rounded-xl bg-black/20 px-4 py-3">
                                            <span className="text-slate-400">Last Sync Attempt</span>
                                            <span className="text-white">{formatDateTime(status.source?.lastSyncAttemptAt || null)}</span>
                                        </div>
                                        <div className="flex items-center justify-between rounded-xl bg-black/20 px-4 py-3">
                                            <span className="text-slate-400">Last Synced</span>
                                            <span className="text-white">{formatDateTime(status.source?.lastSyncedAt || null)}</span>
                                        </div>
                                        <div className="flex items-center justify-between rounded-xl bg-black/20 px-4 py-3">
                                            <span className="text-slate-400">Last Seen Source Tx</span>
                                            <span className="text-white">{formatDateTime(status.source?.lastSeenSourceAt || status.liveProbe.latestTransactionAt)}</span>
                                        </div>
                                    </div>

                                    {status.schema.error && (
                                        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
                                            {status.schema.error}
                                        </div>
                                    )}

                                    {status.source?.lastError && (
                                        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
                                            <p className="font-medium mb-1">Last Error</p>
                                            <p>{status.source.lastError}</p>
                                        </div>
                                    )}
                                </div>

                                <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-5 space-y-4">
                                    <h2 className="text-lg font-semibold text-white">Dry Run / Sync</h2>

                                    <div className="grid md:grid-cols-2 gap-4">
                                        <label className="block">
                                            <span className="text-sm text-slate-300">Start Date</span>
                                            <input
                                                type="date"
                                                value={startDate}
                                                onChange={(event) => setStartDate(event.target.value)}
                                                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white"
                                            />
                                        </label>

                                        <label className="block">
                                            <span className="text-sm text-slate-300">End Date</span>
                                            <input
                                                type="date"
                                                value={endDate}
                                                onChange={(event) => setEndDate(event.target.value)}
                                                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white"
                                            />
                                        </label>
                                    </div>

                                    <div className="flex flex-wrap gap-3">
                                        <button
                                            onClick={() => handleSync(true)}
                                            disabled={loadingAction !== null || !status.env.hasExternalDatabaseUrl}
                                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 text-blue-100 disabled:opacity-50"
                                        >
                                            <PlayCircle size={18} className={loadingAction === 'dryRun' ? 'animate-pulse' : ''} />
                                            Dry Run
                                        </button>

                                        <button
                                            onClick={() => handleSync(false)}
                                            disabled={loadingAction !== null || !status.env.hasExternalDatabaseUrl}
                                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-100 disabled:opacity-50"
                                        >
                                            <CheckCircle2 size={18} className={loadingAction === 'sync' ? 'animate-pulse' : ''} />
                                            Import จริง
                                        </button>
                                    </div>

                                    <div className="grid md:grid-cols-2 gap-4 text-sm">
                                        <div className="rounded-2xl bg-black/20 p-4">
                                            <p className="text-slate-400">Local Imported Rows</p>
                                            <p className="text-white text-xl font-semibold mt-2">{status.localLanding.transactionCount}</p>
                                            <p className="text-xs text-slate-500 mt-2">
                                                7 วันล่าสุด: {status.localLanding.recent7DayCount}
                                            </p>
                                        </div>
                                        <div className="rounded-2xl bg-black/20 p-4">
                                            <p className="text-slate-400">Live Probe</p>
                                            <p className="text-white text-sm font-medium mt-2">
                                                {status.liveProbe.attempted
                                                    ? formatDateTime(status.liveProbe.latestTransactionAt)
                                                    : 'ยังไม่ได้ probe'}
                                            </p>
                                            {status.liveProbe.error && (
                                                <p className="text-xs text-red-300 mt-2">{status.liveProbe.error}</p>
                                            )}
                                        </div>
                                    </div>

                                    {syncResult && (
                                        <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4 text-sm text-cyan-50">
                                            <p className="font-semibold mb-3">ผลล่าสุด</p>
                                            <div className="grid md:grid-cols-2 gap-3">
                                                <div>
                                                    <p className="text-cyan-100/70">ช่วงวันที่</p>
                                                    <p>{syncResult.startDate} ถึง {syncResult.endDate}</p>
                                                </div>
                                                <div>
                                                    <p className="text-cyan-100/70">Rows fetched</p>
                                                    <p>{syncResult.rowsFetched}</p>
                                                </div>
                                                <div>
                                                    <p className="text-cyan-100/70">Create / Update</p>
                                                    <p>{syncResult.created} / {syncResult.updated}</p>
                                                </div>
                                                <div>
                                                    <p className="text-cyan-100/70">Latest source tx</p>
                                                    <p>{formatDateTime(syncResult.latestSourceTransactionAt)}</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    ) : null}
                </div>
            </div>
        </Sidebar>
    );
}
