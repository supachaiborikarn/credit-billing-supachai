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

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const sessionCookie = request.cookies.get('session');

    // Check if route is protected
    const isProtectedRoute = protectedRoutes.some(route =>
        pathname === route || pathname.startsWith(route + '/')
    );

    // If protected route and no session, redirect to login
    if (isProtectedRoute && !sessionCookie) {
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('redirect', pathname);
        return NextResponse.redirect(loginUrl);
    }

    // Force gas-station users to use new v2 UI
    // Redirect /gas-station/[id] to /gas-station/[id]/new/home
    const gasStationMatch = pathname.match(/^\/gas-station\/(\d+)$/);
    if (gasStationMatch) {
        const stationId = gasStationMatch[1];
        return NextResponse.redirect(new URL(`/gas-station/${stationId}/new/home`, request.url));
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
