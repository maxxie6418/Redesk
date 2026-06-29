import { createContext, useContext } from 'react';
import type { AuthUser } from '@/lib/api';

export const ShellUserContext = createContext<AuthUser | null>(null);

export function useShellUser() {
  const user = useContext(ShellUserContext);
  if (!user) {
    throw new Error('ShellUserContext is missing');
  }
  return user;
}
