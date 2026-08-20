export const API_PERMISSIONS = [
  'menu:read',
  'offers:read',
  'branches:read',
  'delivery:read',
  'orders:create',
  'orders:read',
  'orders:update',
  'customers:read',
  'reservations:create',
  'reservations:read',
] as const;

export type ApiPermission = (typeof API_PERMISSIONS)[number];

export function isValidPermission(permission: string): permission is ApiPermission {
  return API_PERMISSIONS.includes(permission as ApiPermission);
}
