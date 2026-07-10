import { PERMISSION_LEVEL, type PermissionLevel } from '@redesk/shared';

const PERMISSION_ORDER: PermissionLevel[] = [PERMISSION_LEVEL.VIEW, PERMISSION_LEVEL.READ, PERMISSION_LEVEL.USE];

export function checkPermission(current: PermissionLevel, required: PermissionLevel): boolean {
  const currentIdx = PERMISSION_ORDER.indexOf(current);
  const requiredIdx = PERMISSION_ORDER.indexOf(required);
  return currentIdx >= requiredIdx;
}