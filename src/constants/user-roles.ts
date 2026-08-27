/**
 * User Roles - บทบาทผู้ใช้
 * Synced with Prisma enum UserRole
 */

export const UserRole = {
    ADMIN: 'ADMIN',
    STAFF: 'STAFF',
} as const;

export type UserRoleValue = typeof UserRole[keyof typeof UserRole];

export function isUserRole(value: unknown): value is UserRoleValue {
    return value === UserRole.ADMIN || value === UserRole.STAFF;
}

/**
 * Thai labels for user roles
 */
export const UserRoleLabels: Record<UserRoleValue, string> = {
    ADMIN: 'ผู้ดูแลระบบ',
    STAFF: 'พนักงาน',
};

/**
 * Check if role has admin privileges
 */
export function isAdmin(role: UserRoleValue): boolean {
    return role === UserRole.ADMIN;
}
