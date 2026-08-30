'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
    BarChart3,
    CalendarDays,
    FileClock,
    History,
    LogOut,
    MoreHorizontal,
    ReceiptText,
    Settings,
    ShieldCheck,
    Users,
    UserCog,
    WalletCards,
    X,
    Plug,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui';
import { findStationIndex } from '@/constants';
import { cn } from '@/lib/utils';

interface ShellUser {
    id: string;
    name: string;
    role: 'ADMIN' | 'STAFF';
    stationId?: string | null;
    stationName?: string | null;
    stationType?: 'FULL' | 'SIMPLE' | 'GAS' | null;
}

interface NavItem {
    label: string;
    href: string;
    icon: LucideIcon;
}

interface MoreItem extends NavItem {
    description?: string;
}

export interface RedesignAppShellProps {
    children: React.ReactNode;
    title: string;
    description?: string;
    contextLabel?: string;
    contextValue?: string;
    actions?: React.ReactNode;
}

const adminPrimaryNav: NavItem[] = [
    { label: 'Today', href: '/today', icon: CalendarDays },
    { label: 'Sales', href: '/sales', icon: ReceiptText },
    { label: 'Customers', href: '/customers', icon: Users },
    { label: 'Billing', href: '/billing', icon: WalletCards },
];

const adminMoreNav: MoreItem[] = [
    { label: 'Reports', href: '/reports', icon: BarChart3, description: 'รายงานและข้อมูลย้อนหลัง' },
    { label: 'Alerts & anomalies', href: '/admin/alerts', icon: ShieldCheck, description: 'รายการที่ต้องตรวจสอบ' },
    { label: 'Reconciliation', href: '/admin/gas/reports/shift?view=reconciliation', icon: FileClock, description: 'ตรวจและกระทบยอด' },
    { label: 'Users', href: '/users', icon: UserCog, description: 'ผู้ใช้และสิทธิ์' },
    { label: 'Settings', href: '/settings', icon: Settings, description: 'ตั้งค่าระบบ' },
    { label: 'Integrations', href: '/admin/watchara-dispenser', icon: Plug, description: 'ระบบเชื่อมต่อภายนอก' },
];

function isRouteActive(pathname: string, href: string) {
    const target = new URL(href, 'https://credit-billing-supachai.local');
    if (target.pathname === '/today') return pathname === '/today';
    return pathname === target.pathname || pathname.startsWith(`${target.pathname}/`);
}

function getStaffNav(user: ShellUser | null): NavItem[] {
    const stationNumber = user?.stationId ? findStationIndex(user.stationId) : -1;
    const isRetired = [2, 3, 4].includes(stationNumber);

    const items: NavItem[] = [
        { label: 'Today', href: '/today', icon: CalendarDays },
    ];

    const canonicalStationId = stationNumber > 0 ? `station-${stationNumber}` : null;

    if (!isRetired && canonicalStationId) {
        items.push({ label: 'Sales', href: `/stations/${canonicalStationId}/sales`, icon: ReceiptText });
    }

    items.push({ label: 'Customers', href: '/customers', icon: Users });

    if (canonicalStationId) {
        items.push({ label: 'History', href: `/stations/${canonicalStationId}/history`, icon: History });
    }

    return items;
}

export function RedesignAppShell({
    children,
    title,
    description,
    contextLabel,
    contextValue,
    actions,
}: RedesignAppShellProps) {
    const pathname = usePathname();
    const router = useRouter();
    const [user, setUser] = React.useState<ShellUser | null>(null);
    const [loadingUser, setLoadingUser] = React.useState(true);
    const [showMore, setShowMore] = React.useState(false);
    const morePanelRef = React.useRef<HTMLElement>(null);
    const morePreviousFocusRef = React.useRef<HTMLElement | null>(null);
    const moreTitleId = React.useId();
    const moreDescriptionId = React.useId();

    React.useEffect(() => {
        let cancelled = false;

        const loadUser = async () => {
            try {
                const response = await fetch('/api/auth/me');
                if (response.status === 401) {
                    router.replace('/login');
                    return;
                }
                if (!response.ok) return;

                const payload = (await response.json()) as { user?: ShellUser | null };
                if (!cancelled) setUser(payload.user ?? null);
            } catch (error) {
                console.error('Failed to load shell user:', error);
            } finally {
                if (!cancelled) setLoadingUser(false);
            }
        };

        void loadUser();
        return () => {
            cancelled = true;
        };
    }, [router]);

    React.useEffect(() => {
        setShowMore(false);
    }, [pathname]);

    React.useEffect(() => {
        if (!showMore) return;

        morePreviousFocusRef.current = document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const focusableSelector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
        const focusTimer = window.setTimeout(() => {
            const panel = morePanelRef.current;
            const first = panel?.querySelector<HTMLElement>(focusableSelector);
            (first || panel)?.focus();
        }, 0);

        const handleKeyDown = (event: KeyboardEvent) => {
            const panel = morePanelRef.current;
            if (!panel) return;

            if (event.key === 'Escape') {
                event.preventDefault();
                setShowMore(false);
                return;
            }
            if (event.key !== 'Tab') return;

            const focusable = Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector));
            if (focusable.length === 0) {
                event.preventDefault();
                panel.focus();
                return;
            }

            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            window.clearTimeout(focusTimer);
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = previousOverflow;
            morePreviousFocusRef.current?.focus();
        };
    }, [showMore]);

    const isAdmin = user?.role === 'ADMIN';
    const primaryNav = isAdmin ? adminPrimaryNav : getStaffNav(user);
    const stationNumber = user?.stationId ? findStationIndex(user.stationId) : -1;
    const isRetiredStation = [2, 3, 4].includes(stationNumber);
    const resolvedContextValue = contextValue || user?.stationName || undefined;
    const resolvedContextLabel = contextLabel || (user?.stationName ? 'สถานี' : undefined);

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/login';
    };

    return (
        <div
            className="min-h-screen bg-[var(--ui-bg)] text-[var(--ui-text)]"
            style={{ fontFamily: 'var(--ui-font-sans)' }}
        >
            <aside className="fixed inset-y-0 left-0 z-[var(--ui-z-nav)] hidden w-[var(--ui-sidebar-width)] border-r border-[var(--ui-border)] bg-[var(--ui-surface)] lg:flex lg:flex-col">
                <div className="flex h-16 items-center gap-3 border-b border-[var(--ui-border)] px-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-[var(--ui-radius-md)] bg-[var(--ui-primary-700)] text-sm font-extrabold text-white">
                        CB
                    </div>
                    <div className="min-w-0">
                        <div className="truncate text-sm font-bold">Credit Billing</div>
                        <div className="truncate text-xs text-[var(--ui-text-muted)]">Supachai Group</div>
                    </div>
                </div>

                <nav className="flex-1 space-y-1 p-3" aria-label="เมนูหลัก">
                    {primaryNav.map((item) => {
                        const Icon = item.icon;
                        const active = isRouteActive(pathname, item.href);
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                aria-current={active ? 'page' : undefined}
                                className={cn(
                                    'flex h-11 items-center gap-3 rounded-[var(--ui-radius-md)] px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:shadow-[var(--ui-shadow-focus)]',
                                    active
                                        ? 'bg-[var(--ui-primary-50)] text-[var(--ui-primary-700)]'
                                        : 'text-[var(--ui-text-secondary)] hover:bg-[var(--ui-surface-subtle)] hover:text-[var(--ui-text)]'
                                )}
                            >
                                <Icon className="h-5 w-5" aria-hidden="true" />
                                <span>{item.label}</span>
                            </Link>
                        );
                    })}

                    <button
                        type="button"
                        onClick={() => setShowMore(true)}
                        className="flex h-11 w-full items-center gap-3 rounded-[var(--ui-radius-md)] px-3 text-sm font-semibold text-[var(--ui-text-secondary)] transition-colors hover:bg-[var(--ui-surface-subtle)] hover:text-[var(--ui-text)] focus-visible:outline-none focus-visible:shadow-[var(--ui-shadow-focus)]"
                    >
                        <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
                        <span>More</span>
                    </button>
                </nav>

                <div className="border-t border-[var(--ui-border)] p-3">
                    <div className="rounded-[var(--ui-radius-md)] bg-[var(--ui-surface-subtle)] p-3">
                        <div className="truncate text-sm font-semibold">{loadingUser ? 'กำลังโหลด...' : user?.name || 'ผู้ใช้'}</div>
                        <div className="mt-0.5 truncate text-xs text-[var(--ui-text-muted)]">
                            {isAdmin ? 'ผู้ดูแลระบบ' : user?.stationName || 'พนักงาน'}
                        </div>
                        {isRetiredStation && (
                            <div className="mt-2 text-xs font-medium text-[var(--ui-warning-text)]">สาขานี้ย้ายไป POS แล้ว</div>
                        )}
                    </div>
                </div>
            </aside>

            <div className="lg:pl-[var(--ui-sidebar-width)]">
                <header className="sticky top-0 z-[var(--ui-z-sticky)] border-b border-[var(--ui-border)] bg-[var(--ui-surface)]/95 backdrop-blur">
                    <div className="mx-auto flex min-h-16 max-w-[var(--ui-page-max)] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <h1 className="truncate text-xl font-bold leading-tight sm:text-2xl">{title}</h1>
                                {resolvedContextLabel && resolvedContextValue && (
                                    <span className="inline-flex items-center gap-1 rounded-[var(--ui-radius-full)] border border-[var(--ui-border)] bg-[var(--ui-surface-subtle)] px-2.5 py-1 text-xs font-semibold text-[var(--ui-text-secondary)]">
                                        <span>{resolvedContextLabel}:</span>
                                        <span className="text-[var(--ui-text)]">{resolvedContextValue}</span>
                                    </span>
                                )}
                            </div>
                            {description && (
                                <p className="mt-1 line-clamp-1 text-sm text-[var(--ui-text-muted)]">{description}</p>
                            )}
                        </div>
                        {actions && <div className="shrink-0">{actions}</div>}
                    </div>
                </header>

                <main className="mx-auto max-w-[var(--ui-page-max)] px-4 py-5 pb-24 sm:px-6 lg:px-8 lg:pb-8">
                    {children}
                </main>
            </div>

            <nav
                className="fixed inset-x-0 bottom-0 z-[var(--ui-z-nav)] border-t border-[var(--ui-border)] bg-[var(--ui-surface)] lg:hidden"
                aria-label="เมนูมือถือ"
                style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            >
                <div className="mx-auto flex min-h-[var(--ui-bottom-nav-height)] max-w-xl items-stretch justify-around px-1">
                    {primaryNav.map((item) => {
                        const Icon = item.icon;
                        const active = isRouteActive(pathname, item.href);
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                aria-current={active ? 'page' : undefined}
                                className={cn(
                                    'flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-[var(--ui-radius-sm)] px-1 text-[11px] font-semibold focus-visible:outline-none focus-visible:shadow-[var(--ui-shadow-focus)]',
                                    active ? 'text-[var(--ui-primary-text)]' : 'text-[var(--ui-text-muted)]'
                                )}
                            >
                                <Icon className="h-5 w-5" aria-hidden="true" />
                                <span className="max-w-full truncate">{item.label}</span>
                            </Link>
                        );
                    })}
                    <button
                        type="button"
                        onClick={() => setShowMore(true)}
                        className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-[var(--ui-radius-sm)] px-1 text-[11px] font-semibold text-[var(--ui-text-muted)] focus-visible:outline-none focus-visible:shadow-[var(--ui-shadow-focus)]"
                    >
                        <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
                        <span>More</span>
                    </button>
                </div>
            </nav>

            {showMore && (
                <div className="fixed inset-0 z-[var(--ui-z-modal)] flex justify-end bg-[var(--ui-overlay)]" role="presentation">
                    <div
                        aria-hidden="true"
                        className="absolute inset-0 cursor-default"
                        onClick={() => setShowMore(false)}
                    />
                    <section
                        ref={morePanelRef}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby={moreTitleId}
                        aria-describedby={moreDescriptionId}
                        tabIndex={-1}
                        className="relative mt-auto max-h-[80vh] w-full overflow-y-auto rounded-t-[var(--ui-radius-lg)] bg-[var(--ui-surface)] p-4 shadow-[var(--ui-shadow-md)] focus:outline-none sm:ml-auto sm:mt-0 sm:h-full sm:max-h-none sm:max-w-sm sm:rounded-none sm:border-l sm:border-[var(--ui-border)] sm:p-5"
                    >
                        <div className="mb-4 flex items-center justify-between">
                            <div>
                                <h2 id={moreTitleId} className="font-bold">More</h2>
                                <p id={moreDescriptionId} className="text-sm text-[var(--ui-text-muted)]">เครื่องมือและการตั้งค่าเพิ่มเติม</p>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setShowMore(false)} aria-label="ปิด">
                                <X className="h-5 w-5" aria-hidden="true" />
                            </Button>
                        </div>

                        {isAdmin ? (
                            <div className="space-y-1">
                                {adminMoreNav.map((item) => {
                                    const Icon = item.icon;
                                    return (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            className="flex items-start gap-3 rounded-[var(--ui-radius-md)] p-3 hover:bg-[var(--ui-surface-subtle)] focus-visible:outline-none focus-visible:shadow-[var(--ui-shadow-focus)]"
                                        >
                                            <Icon className="mt-0.5 h-5 w-5 shrink-0 text-[var(--ui-text-muted)]" aria-hidden="true" />
                                            <span className="min-w-0">
                                                <span className="block text-sm font-semibold">{item.label}</span>
                                                {item.description && (
                                                    <span className="mt-0.5 block text-xs text-[var(--ui-text-muted)]">{item.description}</span>
                                                )}
                                            </span>
                                        </Link>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="rounded-[var(--ui-radius-md)] border border-[var(--ui-border)] bg-[var(--ui-surface-subtle)] p-3 text-sm">
                                <div className="font-semibold">{user?.stationName || 'ข้อมูลพนักงาน'}</div>
                                <div className="mt-1 text-[var(--ui-text-muted)]">
                                    {isRetiredStation ? 'สาขานี้ย้ายงานหน้าปั๊มไปใช้ POS แล้ว' : 'เครื่องมือเพิ่มเติมจะขึ้นตามสิทธิ์ของสถานี'}
                                </div>
                            </div>
                        )}

                        <div className="mt-5 border-t border-[var(--ui-border)] pt-4">
                            <Button variant="outline" className="w-full justify-start" onClick={handleLogout}>
                                <LogOut className="h-4 w-4" />
                                ออกจากระบบ
                            </Button>
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
}
