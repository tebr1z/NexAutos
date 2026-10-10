import type { Role } from '@prisma/client';

export const FULL_ACCESS_ROLES: Role[] = ['SUPER_ADMIN', 'ADMIN'];
export const MANAGEMENT_ROLES: Role[] = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];
export const OPERATIONS_ROLES: Role[] = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'STAFF'];
export const INTERNAL_ROLES: Role[] = [...OPERATIONS_ROLES, 'FREIGHT_USER'];

