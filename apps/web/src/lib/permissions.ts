import { PERMISSION_LEVEL, type PermissionLevel } from '@redesk/shared';
import type { AuthUser } from '@/lib/api';

const PERMISSION_ORDER: PermissionLevel[] = [PERMISSION_LEVEL.VIEW, PERMISSION_LEVEL.READ, PERMISSION_LEVEL.USE];

export function checkPermission(current: PermissionLevel, required: PermissionLevel): boolean {
  const currentIdx = PERMISSION_ORDER.indexOf(current);
  const requiredIdx = PERMISSION_ORDER.indexOf(required);
  return currentIdx >= requiredIdx;
}

export function checkUserPermission(user: AuthUser, required: PermissionLevel): boolean {
  if (user.is_admin) return true;
  return checkPermission(user.permission_level as PermissionLevel, required);
}