import { useContext } from 'react';
import { ThemeContext, type ThemeContextValue } from './theme-context';

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme 必须在 ThemeProvider 内使用');
  return ctx;
}
