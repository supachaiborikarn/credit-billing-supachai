import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Routes that require authentication
const protectedRoutes = [
    '/dashboard',
    '/admin',
    '/station',
    '/simple-station',
    '/gas-station',
    '/gas',
    '/invoices',
    '/owners',
    '/trucks',
    '/reports',
    '/users',
    '/settings',
    '/today',
    '/sales',
    '/stations',
    '/customers',
    '/billing',
    '/billing-collections',
];

function getCurrentGasRedirectPath(pathname: string) {
    const station5ProductsMatch = pathname.match(/^\/gas\/5\/products(?:\/|$)/);
    if (station5ProductsMatch) return '/stations/station-5/inventory';

    const disabledProductsMatch = pathname.match(/^\/gas\/6\/products(?:\/|$)/);
    if (disabledProductsMatch) return '/stations/station-6';

    const overviewMatch = pathname.match(/^\/gas\/(5|6)(?:\/summary)?\/?$/);
    if (overviewMatch) return `/stations/station-${overviewMatch[1]}`;

    const recoveryMatch = pathname.match(/^\/gas\/(5|6)\/(?:meters|gauge)(?:\/|$)/);
    if (recoveryMatch) return `/stations/station-${recoveryMatch[1]}/operations`;

    const inventoryMatch = pathname.match(/^\/gas\/(5|6)\/supplies(?:\/|$)/);
    if (inventoryMatch) return `/stations/station-${inventoryMatch[1]}/inventory`;

    const shiftMatch = pathname.match(/^\/gas\/(5|6)\/shift\/(?:open|close)(?:\/|$)/);
    if (!shiftMatch) return null;
    return `/stations/station-${shiftMatch[1]}/operations`;
}

function getGasV2RedirectPath(pathname: string) {
    const match = pathname.match(/^\/gas-station\/(\d+)(?:\/new(?:\/([^/]+))?)?/);
    if (!match) return null;

    const stationId = match[1];
    const legacyPage = match[2] || '';

    if ((stationId === '5' || stationId === '6') && (legacyPage === '' || legacyPage === 'home')) return `/stations/station-${stationId}`;
    if (legacyPage === 'sell' && (stationId === '5' || stationId === '6')) return `/stations/station-${stationId}/sales`;
    if (legacyPage === 'sell') return `/gas/${stationId}/sell`;
    if (legacyPage === 'products' && stationId === '5') return '/stations/station-5/inventory';
    if (legacyPage === 'products' && stationId === '6') return '/stations/station-6';
    if (legacyPage === 'monthly-balance' && (stationId === '5' || stationId === '6')) return `/stations/station-${stationId}`;
    if (legacyPage === 'supplies' && (stationId === '5' || stationId === '6')) return `/stations/station-${stationId}/inventory`;
    if (legacyPage === 'supplies') return `/gas/${stationId}/supplies`;
    if ((legacyPage === 'meters' || legacyPage === 'gauge') && (stationId === '5' || stationId === '6')) return `/stations/station-${stationId}/operations`;
    if (legacyPage === 'meters') return `/gas/${stationId}/meters`;
    if (legacyPage === 'gauge') return `/gas/${stationId}/gauge`;
    if ((legacyPage === 'summary' || legacyPage === 'shift-summary') && (stationId === '5' || stationId === '6')) return `/stations/station-${stationId}`;
    if (legacyPage === 'summary' || legacyPage === 'shift-summary') return `/gas/${stationId}/summary`;

    return `/gas/${stationId}`;
}

function getTankLoyRedirectPath(pathname: string) {
    const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;

    if (normalized === '/station/1' || normalized === '/simple-station/1') {
        return '/stations/station-1';
    }
    if (normalized === '/station/1/v2' || normalized.startsWith('/station/1/v2/')) {
        return '/stations/station-1/history';
    }

    const mapLegacyPage = (page: string, receiptPassthrough: boolean) => {
        if (page === 'receipt') return receiptPassthrough ? null : '/station/1/new/receipt';
        if (page === 'sell' || page === 'oil-sell') return '/stations/station-1/sales';
        if (page === 'open-shift' || page === 'close-shift' || page === 'shift-end' || page === 'meters') {
            return '/stations/station-1/operations';
        }
        if (page === 'shift-history' || page === 'meter-summary' || page === 'summary' || page === 'list' || page === 'record') {
            return '/stations/station-1/history';
        }
        return '/stations/station-1';
    };

    const simpleNewMatch = normalized.match(/^\/simple-station\/1\/new(?:\/([^/]+))?/);
    if (simpleNewMatch) return mapLegacyPage(simpleNewMatch[1] || 'home', false);

    const stationNewMatch = normalized.match(/^\/station\/1\/new(?:\/([^/]+))?/);
    if (stationNewMatch) return mapLegacyPage(stationNewMatch[1] || 'home', true);

    return null;
}

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const sessionCookie = request.cookies.get('session');
    const canonicalLandingRedirectPath = pathname === '/dashboard' ? '/today' : null;
    const currentGasRedirectPath = getCurrentGasRedirectPath(pathname);
    const gasV2RedirectPath = getGasV2RedirectPath(pathname);
    const tankLoyRedirectPath = getTankLoyRedirectPath(pathname);

    // Check if route is protected
    const isProtectedRoute = protectedRoutes.some(route =>
        pathname === route || pathname.startsWith(route + '/')
    );

    // If protected route and no session, redirect to login
    if (isProtectedRoute && !sessionCookie) {
        const loginUrl = new URL('/login', request.url);
        const redirectPath = canonicalLandingRedirectPath || currentGasRedirectPath || gasV2RedirectPath || tankLoyRedirectPath || pathname;
        loginUrl.searchParams.set('redirect', `${redirectPath}${request.nextUrl.search}`);
        return NextResponse.redirect(loginUrl);
    }

    if (canonicalLandingRedirectPath) {
        const redirectUrl = new URL(canonicalLandingRedirectPath, request.url);
        redirectUrl.search = request.nextUrl.search;
        return NextResponse.redirect(redirectUrl);
    }

    if (currentGasRedirectPath) {
        const redirectUrl = new URL(currentGasRedirectPath, request.url);
        redirectUrl.search = request.nextUrl.search;
        return NextResponse.redirect(redirectUrl);
    }

    if (gasV2RedirectPath) {
        const redirectUrl = new URL(gasV2RedirectPath, request.url);
        redirectUrl.search = request.nextUrl.search;
        return NextResponse.redirect(redirectUrl);
    }

    if (tankLoyRedirectPath) {
        const redirectUrl = new URL(tankLoyRedirectPath, request.url);
        redirectUrl.search = request.nextUrl.search;
        return NextResponse.redirect(redirectUrl);
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - api (API routes)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public folder
         */
        '/((?!api|_next/static|_next/image|favicon.ico|.*\\..*|_next).*)',
    ],
};
