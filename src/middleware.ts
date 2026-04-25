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

function getGasV2RedirectPath(pathname: string) {
    const match = pathname.match(/^\/gas-station\/(\d+)(?:\/new(?:\/([^/]+))?)?/);
    if (!match) return null;

    const stationId = match[1];
    const legacyPage = match[2] || '';

    if (legacyPage === 'sell') return `/gas/${stationId}/sell`;
    if (legacyPage === 'meters') return `/gas/${stationId}/meters`;
    if (legacyPage === 'summary' || legacyPage === 'shift-summary') return `/gas/${stationId}/summary`;

    return `/gas/${stationId}`;
}

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const sessionCookie = request.cookies.get('session');
    const gasV2RedirectPath = getGasV2RedirectPath(pathname);

    // Check if route is protected
    const isProtectedRoute = protectedRoutes.some(route =>
        pathname === route || pathname.startsWith(route + '/')
    );

    // If protected route and no session, redirect to login
    if (isProtectedRoute && !sessionCookie) {
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('redirect', gasV2RedirectPath || pathname);
        return NextResponse.redirect(loginUrl);
    }

    if (gasV2RedirectPath) {
        return NextResponse.redirect(new URL(gasV2RedirectPath, request.url));
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
