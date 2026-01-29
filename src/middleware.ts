import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Routes that require authentication
const protectedRoutes = [
    '/dashboard',
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

// Routes that should redirect authenticated users
const authRoutes = ['/login'];

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const sessionCookie = request.cookies.get('session');

    // Check if route is protected
    const isProtectedRoute = protectedRoutes.some(route =>
        pathname === route || pathname.startsWith(route + '/')
    );

    // Check if route is auth route (login)
    const isAuthRoute = authRoutes.some(route => pathname === route);

    // If protected route and no session, redirect to login
    if (isProtectedRoute && !sessionCookie) {
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('redirect', pathname);
        return NextResponse.redirect(loginUrl);
    }

    // If auth route and has session, redirect to dashboard
    if (isAuthRoute && sessionCookie) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
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
