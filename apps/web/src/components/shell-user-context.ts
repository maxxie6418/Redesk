import { createContext, useContext } from 'react';
import type { AuthUser } from '@/lib/api';

export const ShellUserContext = createContext<AuthUser | null>(null);

export function useShellUser() {
  return useContext(ShellUserContext);
}
