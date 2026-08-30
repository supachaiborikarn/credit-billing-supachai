import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '../src/middleware';

function request(path: string, authenticated = true) {
    return new NextRequest(`https://credit-billing-supachai.local${path}`, authenticated
        ? { headers: { cookie: 'session=test-session' } }
        : undefined);
}

describe('middleware legacy route retirement boundaries', () => {
    it('retires the exact legacy dashboard landing to Today and preserves query', () => {
        const response = middleware(request('/dashboard?from=old-home'));

        expect(response.status).toBe(307);
        expect(response.headers.get('location')).toBe(
            'https://credit-billing-supachai.local/today?from=old-home'
        );
    });

    it('normalizes unauthenticated legacy dashboard bookmark to Today before login', () => {
        const response = middleware(request('/dashboard?from=bookmark', false));
        const location = response.headers.get('location');

        expect(response.status).toBe(307);
        expect(location).not.toBeNull();
        const loginUrl = new URL(location!);
        expect(loginUrl.pathname).toBe('/login');
        expect(loginUrl.searchParams.get('redirect')).toBe('/today?from=bookmark');
    });

    it.each([
        '/today',
        '/sales',
        '/stations/station-1',
        '/customers',
        '/billing',
    ])('protects canonical application route %s before login', (path) => {
        const response = middleware(request(`${path}?from=uat`, false));
        const location = response.headers.get('location');

        expect(response.status).toBe(307);
        expect(location).not.toBeNull();
        const loginUrl = new URL(location!);
        expect(loginUrl.pathname).toBe('/login');
        expect(loginUrl.searchParams.get('redirect')).toBe(`${path}?from=uat`);
    });

    it('retires legacy Owners master-data page to canonical Customers and preserves query', () => {
        const response = middleware(request('/owners?from=s102'));
        expect(response.status).toBe(307);
        expect(response.headers.get('location')).toBe('https://credit-billing-supachai.local/customers?from=s102');
    });

    it('normalizes unauthenticated legacy Owners bookmark before login', () => {
        const response = middleware(request('/owners?from=s102-bookmark', false));
        const location = response.headers.get('location');
        expect(response.status).toBe(307);
        expect(location).not.toBeNull();
        const loginUrl = new URL(location!);
        expect(loginUrl.pathname).toBe('/login');
        expect(loginUrl.searchParams.get('redirect')).toBe('/customers?from=s102-bookmark');
    });

    it.each(['/trucks?from=s103', '/admin/owners?from=s103'])('retires remaining master-data UI %s to canonical Customers', (path) => {
        const response = middleware(request(path));
        expect(response.status).toBe(307);
        expect(response.headers.get('location')).toBe('https://credit-billing-supachai.local/customers?from=s103');
    });

    it('normalizes unauthenticated Trucks bookmark before login', () => {
        const response = middleware(request('/trucks?from=s103-bookmark', false));
        const location = response.headers.get('location');
        expect(response.status).toBe(307);
        expect(location).not.toBeNull();
        const loginUrl = new URL(location!);
        expect(loginUrl.pathname).toBe('/login');
        expect(loginUrl.searchParams.get('redirect')).toBe('/customers?from=s103-bookmark');
    });

    it.each([
        '/invoices?from=s104',
        '/admin/invoices?from=s104',
        '/billing-collections?from=s104',
    ])('retires Billing list UI %s to canonical Billing', (path) => {
        const response = middleware(request(path));
        expect(response.status).toBe(307);
        expect(response.headers.get('location')).toBe('https://credit-billing-supachai.local/billing?from=s104');
    });

    it('retires BillingCollection detail to canonical Billing detail and preserves query', () => {
        const response = middleware(request('/billing-collections/bc-123?from=s104-detail'));
        expect(response.status).toBe(307);
        expect(response.headers.get('location')).toBe(
            'https://credit-billing-supachai.local/billing/bc-123?kind=BILLING_COLLECTION&from=s104-detail'
        );
    });

    it('normalizes unauthenticated BillingCollection detail before login', () => {
        const response = middleware(request('/billing-collections/bc-123?from=s104-bookmark', false));
        const location = response.headers.get('location');
        expect(response.status).toBe(307);
        expect(location).not.toBeNull();
        const loginUrl = new URL(location!);
        expect(loginUrl.pathname).toBe('/login');
        expect(loginUrl.searchParams.get('redirect')).toBe('/billing/bc-123?kind=BILLING_COLLECTION&from=s104-bookmark');
    });

    it('keeps Invoice detail as print compatibility instead of redirecting it', () => {
        const response = middleware(request('/invoices/inv-print?from=s104-print'));
        expect(response.status).toBe(200);
        expect(response.headers.get('location')).toBeNull();
    });

    it.each([
        ['/admin/outstanding?from=s105', '/billing?from=s105'],
        ['/admin/credit-limit?from=s105', '/customers?from=s105'],
    ])('retires legacy credit admin view %s to canonical source-of-truth workspace', (path, target) => {
        const response = middleware(request(path));
        expect(response.status).toBe(307);
        expect(response.headers.get('location')).toBe(`https://credit-billing-supachai.local${target}`);
    });

    it.each([
        ['/admin/outstanding?from=s105-bookmark', '/billing?from=s105-bookmark'],
        ['/admin/credit-limit?from=s105-bookmark', '/customers?from=s105-bookmark'],
    ])('normalizes unauthenticated credit admin bookmark %s before login', (path, target) => {
        const response = middleware(request(path, false));
        const location = response.headers.get('location');
        expect(response.status).toBe(307);
        expect(location).not.toBeNull();
        const loginUrl = new URL(location!);
        expect(loginUrl.pathname).toBe('/login');
        expect(loginUrl.searchParams.get('redirect')).toBe(target);
    });

    it('retires legacy monthly Invoice generator into canonical Billing batch action', () => {
        const response = middleware(request('/admin/generate-invoices?from=s106'));
        expect(response.status).toBe(307);
        expect(response.headers.get('location')).toBe(
            'https://credit-billing-supachai.local/billing?batch=monthly&from=s106'
        );
    });

    it('normalizes unauthenticated monthly generator bookmark before login', () => {
        const response = middleware(request('/admin/generate-invoices?from=s106-bookmark', false));
        const location = response.headers.get('location');
        expect(response.status).toBe(307);
        expect(location).not.toBeNull();
        const loginUrl = new URL(location!);
        expect(loginUrl.pathname).toBe('/login');
        expect(loginUrl.searchParams.get('redirect')).toBe('/billing?batch=monthly&from=s106-bookmark');
    });

    it.each(['/admin/inventory?from=s107', '/admin/low-stock?from=s107'])('retires duplicate admin inventory view %s to canonical station-5 Inventory', (path) => {
        const response = middleware(request(path));
        expect(response.status).toBe(307);
        expect(response.headers.get('location')).toBe(
            'https://credit-billing-supachai.local/stations/station-5/inventory?from=s107'
        );
    });

    it.each(['/admin/inventory?from=s107-bookmark', '/admin/low-stock?from=s107-bookmark'])('normalizes unauthenticated inventory bookmark %s before login', (path) => {
        const response = middleware(request(path, false));
        const location = response.headers.get('location');
        expect(response.status).toBe(307);
        expect(location).not.toBeNull();
        const loginUrl = new URL(location!);
        expect(loginUrl.pathname).toBe('/login');
        expect(loginUrl.searchParams.get('redirect')).toBe('/stations/station-5/inventory?from=s107-bookmark');
    });

    it('retires legacy GAS history UI to the modern daily report and preserves legacy filters', () => {
        const response = middleware(request('/admin/gas-history?stationId=station-5&startDate=2026-08-01&endDate=2026-08-30&from=s109'));
        expect(response.status).toBe(307);
        expect(response.headers.get('location')).toBe(
            'https://credit-billing-supachai.local/admin/gas/reports/daily?stationId=station-5&startDate=2026-08-01&endDate=2026-08-30&from=s109'
        );
    });

    it('normalizes unauthenticated legacy GAS history bookmark before login', () => {
        const response = middleware(request('/admin/gas-history?stationId=station-6&startDate=2026-08-01&endDate=2026-08-30&from=s109-bookmark', false));
        const location = response.headers.get('location');
        expect(response.status).toBe(307);
        expect(location).not.toBeNull();
        const loginUrl = new URL(location!);
        expect(loginUrl.pathname).toBe('/login');
        expect(loginUrl.searchParams.get('redirect')).toBe(
            '/admin/gas/reports/daily?stationId=station-6&startDate=2026-08-01&endDate=2026-08-30&from=s109-bookmark'
        );
    });

    it('redirects direct station-6 product inventory URL because products are disabled there', () => {
        const response = middleware(request('/gas/6/products?from=bookmark'));

        expect(response.status).toBe(307);
        expect(response.headers.get('location')).toBe(
            'https://credit-billing-supachai.local/stations/station-6?from=bookmark'
        );
    });

    it('normalizes unauthenticated direct station-6 product inventory URL before login', () => {
        const response = middleware(request('/gas/6/products?from=bookmark', false));
        const location = response.headers.get('location');

        expect(response.status).toBe(307);
        expect(location).not.toBeNull();
        const loginUrl = new URL(location!);
        expect(loginUrl.pathname).toBe('/login');
        expect(loginUrl.searchParams.get('redirect')).toBe('/stations/station-6?from=bookmark');
    });

    it.each(['5', '6'])('redirects authenticated GAS %s landing to canonical overview and preserves query', (stationNumber) => {
        const response = middleware(request(`/gas/${stationNumber}?from=legacy&tab=now`));

        expect(response.status).toBe(307);
        expect(response.headers.get('location')).toBe(
            `https://credit-billing-supachai.local/stations/station-${stationNumber}?from=legacy&tab=now`
        );
    });

    it.each(['5', '6'])('normalizes unauthenticated GAS %s landing before login and preserves query', (stationNumber) => {
        const response = middleware(request(`/gas/${stationNumber}?from=bookmark`, false));
        const location = response.headers.get('location');

        expect(response.status).toBe(307);
        expect(location).not.toBeNull();
        const loginUrl = new URL(location!);
        expect(loginUrl.pathname).toBe('/login');
        expect(loginUrl.searchParams.get('redirect')).toBe(`/stations/station-${stationNumber}?from=bookmark`);
    });

    it.each(['5', '6'])('redirects authenticated GAS %s summary to canonical overview and preserves query', (stationNumber) => {
        const response = middleware(request(`/gas/${stationNumber}/summary?from=summary&tab=now`));

        expect(response.status).toBe(307);
        expect(response.headers.get('location')).toBe(
            `https://credit-billing-supachai.local/stations/station-${stationNumber}?from=summary&tab=now`
        );
    });

    it.each(['5', '6'])('normalizes unauthenticated GAS %s summary before login and preserves query', (stationNumber) => {
        const response = middleware(request(`/gas/${stationNumber}/summary?from=bookmark`, false));
        const location = response.headers.get('location');

        expect(response.status).toBe(307);
        expect(location).not.toBeNull();
        const loginUrl = new URL(location!);
        expect(loginUrl.pathname).toBe('/login');
        expect(loginUrl.searchParams.get('redirect')).toBe(`/stations/station-${stationNumber}?from=bookmark`);
    });

    it('retires GAS supplies to canonical Inventory and preserves query', () => {
        const response = middleware(request('/gas/5/supplies?source=test'));
        expect(response.status).toBe(307);
        expect(response.headers.get('location')).toBe('https://credit-billing-supachai.local/stations/station-5/inventory?source=test');
    });

    it('retires station-5 products inventory to canonical Inventory and preserves query', () => {
        const response = middleware(request('/gas/5/products?source=test'));
        expect(response.status).toBe(307);
        expect(response.headers.get('location')).toBe('https://credit-billing-supachai.local/stations/station-5/inventory?source=test');
    });


    it.each(['5', '6'])('retires GAS %s meter/gauge recovery to canonical Operations and preserves query', (stationNumber) => {
        for (const page of ['meters', 'gauge']) {
            const response = middleware(request(`/gas/${stationNumber}/${page}?from=s98`));
            expect(response.status).toBe(307);
            expect(response.headers.get('location')).toBe(
                `https://credit-billing-supachai.local/stations/station-${stationNumber}/operations?from=s98`
            );
        }
    });

    it.each(['5', '6'])('normalizes unauthenticated GAS %s recovery bookmark before login', (stationNumber) => {
        const response = middleware(request(`/gas/${stationNumber}/meters?from=s98-bookmark`, false));
        const location = response.headers.get('location');
        expect(response.status).toBe(307);
        expect(location).not.toBeNull();
        const loginUrl = new URL(location!);
        expect(loginUrl.pathname).toBe('/login');
        expect(loginUrl.searchParams.get('redirect')).toBe(`/stations/station-${stationNumber}/operations?from=s98-bookmark`);
    });

    it.each([
        '/gas-station/5',
        '/gas-station/5/new',
        '/gas-station/5/new/home',
        '/gas-station/6',
        '/gas-station/6/new',
        '/gas-station/6/new/home',
    ])('flattens older GAS entry %s to canonical overview and preserves query', (path) => {
        const response = middleware(request(`${path}?from=older`));
        const stationNumber = path.includes('/6') ? '6' : '5';

        expect(response.status).toBe(307);
        expect(response.headers.get('location')).toBe(
            `https://credit-billing-supachai.local/stations/station-${stationNumber}?from=older`
        );
    });

    it.each([
        ['/gas-station/5/new/meters?from=older', '/stations/station-5/operations?from=older'],
        ['/gas-station/5/new/supplies?from=older', '/stations/station-5/inventory?from=older'],
        ['/gas-station/5/new/products?from=older', '/stations/station-5/inventory?from=older'],
        ['/gas-station/5/new/summary?from=older', '/stations/station-5?from=older'],
        ['/gas-station/6/new/shift-summary?from=older', '/stations/station-6?from=older'],
    ])('maps older GAS compatibility route %s and preserves query', (path, expectedPath) => {
        const response = middleware(request(path));

        expect(response.status).toBe(307);
        expect(response.headers.get('location')).toBe(`https://credit-billing-supachai.local${expectedPath}`);
    });

    it('sends older station-6 products bookmark to canonical overview because products are disabled there', () => {
        const response = middleware(request('/gas-station/6/new/products?from=older'));

        expect(response.status).toBe(307);
        expect(response.headers.get('location')).toBe(
            'https://credit-billing-supachai.local/stations/station-6?from=older'
        );
    });

    it.each(['5', '6'])('flattens redirect-only older monthly-balance page for GAS %s to canonical overview', (stationNumber) => {
        const response = middleware(request(`/gas-station/${stationNumber}/new/monthly-balance?from=older`));

        expect(response.status).toBe(307);
        expect(response.headers.get('location')).toBe(
            `https://credit-billing-supachai.local/stations/station-${stationNumber}?from=older`
        );
    });

    it.each(['5', '6'])('keeps active GAS shift redirect behavior and preserves query for station %s', (stationNumber) => {
        const response = middleware(request(`/gas/${stationNumber}/shift/open?source=old`));

        expect(response.status).toBe(307);
        expect(response.headers.get('location')).toBe(
            `https://credit-billing-supachai.local/stations/station-${stationNumber}/operations?source=old`
        );
    });

    it('retires FULL shift-history to canonical History and preserves query', () => {
        const response = middleware(request('/station/1/new/shift-history?from=legacy-bookmark'));

        expect(response.status).toBe(307);
        expect(response.headers.get('location')).toBe(
            'https://credit-billing-supachai.local/stations/station-1/history?from=legacy-bookmark'
        );
    });

    it('normalizes unauthenticated FULL shift-history before login', () => {
        const response = middleware(request('/station/1/new/shift-history?from=bookmark', false));
        const location = response.headers.get('location');

        expect(response.status).toBe(307);
        expect(location).not.toBeNull();
        const loginUrl = new URL(location!);
        expect(loginUrl.pathname).toBe('/login');
        expect(loginUrl.searchParams.get('redirect')).toBe('/stations/station-1/history?from=bookmark');
    });

    it('retires FULL meter-summary to canonical History and preserves query', () => {
        const response = middleware(request('/station/1/new/meter-summary?from=legacy-meter'));

        expect(response.status).toBe(307);
        expect(response.headers.get('location')).toBe(
            'https://credit-billing-supachai.local/stations/station-1/history?from=legacy-meter'
        );
    });

    it('normalizes unauthenticated FULL meter-summary before login', () => {
        const response = middleware(request('/station/1/new/meter-summary?from=bookmark', false));
        const location = response.headers.get('location');

        expect(response.status).toBe(307);
        expect(location).not.toBeNull();
        const loginUrl = new URL(location!);
        expect(loginUrl.pathname).toBe('/login');
        expect(loginUrl.searchParams.get('redirect')).toBe('/stations/station-1/history?from=bookmark');
    });

    it.each(['summary', 'list', 'record'])('retires FULL %s compatibility entry to canonical History and preserves query', (page) => {
        const response = middleware(request(`/station/1/new/${page}?from=s96`));

        expect(response.status).toBe(307);
        expect(response.headers.get('location')).toBe(
            'https://credit-billing-supachai.local/stations/station-1/history?from=s96'
        );
    });

    it('retires direct FULL V2 entry to canonical History and preserves query', () => {
        const response = middleware(request('/station/1/v2?from=s96-v2'));

        expect(response.status).toBe(307);
        expect(response.headers.get('location')).toBe(
            'https://credit-billing-supachai.local/stations/station-1/history?from=s96-v2'
        );
    });

    it('normalizes unauthenticated FULL V2 bookmark before login', () => {
        const response = middleware(request('/station/1/v2?from=s96-bookmark', false));
        const location = response.headers.get('location');

        expect(response.status).toBe(307);
        expect(location).not.toBeNull();
        const loginUrl = new URL(location!);
        expect(loginUrl.pathname).toBe('/login');
        expect(loginUrl.searchParams.get('redirect')).toBe('/stations/station-1/history?from=s96-bookmark');
    });

    it('retires exact FULL classic station root to canonical Overview and preserves query', () => {
        const response = middleware(request('/station/1?from=s96'));
        expect(response.status).toBe(307);
        expect(response.headers.get('location')).toBe(
            'https://credit-billing-supachai.local/stations/station-1?from=s96'
        );
    });

    it('normalizes unauthenticated FULL classic station root before login', () => {
        const response = middleware(request('/station/1?from=s96-bookmark', false));
        const location = response.headers.get('location');
        expect(response.status).toBe(307);
        expect(location).not.toBeNull();
        const loginUrl = new URL(location!);
        expect(loginUrl.pathname).toBe('/login');
        expect(loginUrl.searchParams.get('redirect')).toBe('/stations/station-1?from=s96-bookmark');
    });

    it.each([
        '/station/1/new/products?from=s90',
        '/simple-station/1/new/products?from=s90',
    ])('retires FULL products compatibility entry %s to canonical overview', (path) => {
        const response = middleware(request(path));
        expect(response.status).toBe(307);
        expect(response.headers.get('location')).toBe(
            'https://credit-billing-supachai.local/stations/station-1?from=s90'
        );
    });

    it('normalizes unauthenticated FULL products bookmark before login', () => {
        const response = middleware(request('/station/1/new/products?from=s90-bookmark', false));
        const location = response.headers.get('location');
        expect(response.status).toBe(307);
        expect(location).not.toBeNull();
        const loginUrl = new URL(location!);
        expect(loginUrl.pathname).toBe('/login');
        expect(loginUrl.searchParams.get('redirect')).toBe('/stations/station-1?from=s90-bookmark');
    });

    it.each(['2', '3', '4'])('retires retired SIMPLE %s summary to canonical History and preserves query', (stationNumber) => {
        const response = middleware(request(`/simple-station/${stationNumber}/new/summary?from=s101`));
        expect(response.status).toBe(307);
        expect(response.headers.get('location')).toBe(`https://credit-billing-supachai.local/stations/station-${stationNumber}/history?from=s101`);
    });

    it('normalizes unauthenticated retired SIMPLE summary before login', () => {
        const response = middleware(request('/simple-station/2/new/summary?from=s101-bookmark', false));
        const location = response.headers.get('location');
        expect(response.status).toBe(307);
        const loginUrl = new URL(location!);
        expect(loginUrl.pathname).toBe('/login');
        expect(loginUrl.searchParams.get('redirect')).toBe('/stations/station-2/history?from=s101-bookmark');
    });

    it('normalizes unauthenticated FULL summary bookmark to canonical History before login', () => {
        const response = middleware(request('/station/1/new/summary?from=s96-bookmark', false));
        const location = response.headers.get('location');

        expect(response.status).toBe(307);
        expect(location).not.toBeNull();
        const loginUrl = new URL(location!);
        expect(loginUrl.pathname).toBe('/login');
        expect(loginUrl.searchParams.get('redirect')).toBe('/stations/station-1/history?from=s96-bookmark');
    });
});
