import { NextResponse } from 'next/server';
import { STATIONS } from '@/constants';
import { requireStationAccessApi } from '@/lib/api-auth';
import type { SessionUser } from '@/lib/auth-utils';
import {
    getNonGasStationError,
    resolveGasStation,
    type ResolvedStation,
} from '@/lib/gas/station-resolver';

type GasApiSuccess = {
    station: ResolvedStation;
    user: SessionUser;
    response?: never;
};

type GasApiFailure = {
    station?: never;
    user?: never;
    response: NextResponse;
};

export type GasApiAuthResult = GasApiSuccess | GasApiFailure;

export async function requireGasStationAccess(stationIdOrIndex: string): Promise<GasApiAuthResult> {
    const station = await resolveGasStation(stationIdOrIndex);
    if (!station) {
        return {
            response: NextResponse.json(getNonGasStationError(), { status: 403 }),
        };
    }

    const auth = await requireStationAccessApi(station.dbId);
    if (auth.response) {
        return { response: auth.response };
    }

    return { station, user: auth.user };
}

export function gasStationSupportsProducts(station: Pick<ResolvedStation, 'dbId'> | string): boolean {
    const stationId = typeof station === 'string' ? station : station.dbId;
    const stationConfig = STATIONS.find((s) => s.id === stationId);
    return Boolean(stationConfig && 'hasProducts' in stationConfig && stationConfig.hasProducts === true);
}

export function requireGasProductsEnabled(station: Pick<ResolvedStation, 'dbId'> | string): NextResponse | null {
    if (gasStationSupportsProducts(station)) {
        return null;
    }

    return NextResponse.json(
        { error: 'สาขานี้ไม่ได้เปิดใช้งานสินค้าเสริม' },
        { status: 403 }
    );
}

export function shiftBelongsToStation(
    shift: { dailyRecord?: { stationId: string } | null } | null,
    station: Pick<ResolvedStation, 'dbId'>
): boolean {
    return Boolean(shift?.dailyRecord?.stationId === station.dbId);
}
