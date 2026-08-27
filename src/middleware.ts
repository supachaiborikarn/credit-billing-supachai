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
];

function getCurrentGasRedirectPath(pathname: string) {
    const match = pathname.match(/^\/gas\/(5|6)\/shift\/(?:open|close)(?:\/|$)/);
    if (!match) return null;
    return `/stations/station-${match[1]}/operations`;
}

function getGasV2RedirectPath(pathname: string) {
    const match = pathname.match(/^\/gas-station\/(\d+)(?:\/new(?:\/([^/]+))?)?/);
    if (!match) return null;

    const stationId = match[1];
    const legacyPage = match[2] || '';

    if (legacyPage === 'sell' && (stationId === '5' || stationId === '6')) return `/stations/station-${stationId}/sales`;
    if (legacyPage === 'sell') return `/gas/${stationId}/sell`;
    if (legacyPage === 'supplies') return `/gas/${stationId}/supplies`;
    if (legacyPage === 'meters') return `/gas/${stationId}/meters`;
    if (legacyPage === 'summary' || legacyPage === 'shift-summary') return `/gas/${stationId}/summary`;

    return `/gas/${stationId}`;
}

function getTankLoyRedirectPath(pathname: string) {
    if (pathname === '/simple-station/1') return '/station/1/v2';
    const simpleNewMatch = pathname.match(/^\/simple-station\/1\/new(?:\/([^/]+))?/);
    if (simpleNewMatch) {
        const page = simpleNewMatch[1] || 'home';
        if (page === 'receipt') return '/station/1/new/receipt';
        return '/station/1/v2';
    }

    const stationNewMatch = pathname.match(/^\/station\/1\/new(?:\/([^/]+))?/);
    if (stationNewMatch) {
        const page = stationNewMatch[1] || 'home';
        if (page === 'receipt') return null;
        if (page === 'home') return '/stations/station-1';
        if (page === 'sell' || page === 'oil-sell') return '/stations/station-1/sales';
        if (page === 'open-shift' || page === 'close-shift' || page === 'shift-end' || page === 'meters') return '/stations/station-1/operations';
        return '/station/1/v2';
    }

    return null;
}

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const sessionCookie = request.cookies.get('session');
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
        const redirectPath = currentGasRedirectPath || gasV2RedirectPath || tankLoyRedirectPath || pathname;
        loginUrl.searchParams.set('redirect', `${redirectPath}${request.nextUrl.search}`);
        return NextResponse.redirect(loginUrl);
    }

    if (currentGasRedirectPath) {
        const redirectUrl = new URL(currentGasRedirectPath, request.url);
        redirectUrl.search = request.nextUrl.search;
        return NextResponse.redirect(redirectUrl);
    }

    if (gasV2RedirectPath) {
        return NextResponse.redirect(new URL(gasV2RedirectPath, request.url));
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
