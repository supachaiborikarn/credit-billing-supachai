export const TANK_LOY_STAFF_UI_FORCE_RELOGIN_AT = new Date('2026-04-27T18:36:00+07:00');
export const GAS_V2_FORCE_RELOGIN_AT = new Date('2026-01-11T00:00:00+07:00');

type SessionPolicyInput = {
    createdAt: Date;
    user: {
        role: string;
        stationId: string | null;
        station?: {
            type: string | null;
        } | null;
    };
};

export function getForcedReloginReason(session: SessionPolicyInput): string | null {
    const isStaff = session.user.role === 'STAFF';

    if (
        isStaff &&
        session.user.stationId === 'station-1' &&
        session.createdAt < TANK_LOY_STAFF_UI_FORCE_RELOGIN_AT
    ) {
        return 'session_expired_tank_loy_v2_migration';
    }

    if (
        isStaff &&
        session.user.station?.type === 'GAS' &&
        session.createdAt < GAS_V2_FORCE_RELOGIN_AT
    ) {
        return 'session_expired_v2_migration';
    }

    return null;
}
