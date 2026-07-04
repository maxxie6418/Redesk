import { useEffect, useState } from 'react';

const MOBILE_LAYOUT_QUERY = '(max-width: 767px)';
const TABLET_LAYOUT_QUERY = '(min-width: 768px) and (max-width: 1023px)';

function getInitialValue(query: string) {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.matchMedia(query).matches;
}

export function useMobileLayout() {
  const [isMobileLayout, setIsMobileLayout] = useState(() => getInitialValue(MOBILE_LAYOUT_QUERY));

  useEffect(() => {
    const mediaQuery = window.matchMedia(MOBILE_LAYOUT_QUERY);

    const syncState = (matches: boolean) => {
      setIsMobileLayout(matches);
    };

    syncState(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      syncState(event.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return isMobileLayout;
}

export function useTabletLayout() {
  const [isTabletLayout, setIsTabletLayout] = useState(() => getInitialValue(TABLET_LAYOUT_QUERY));

  useEffect(() => {
    const mediaQuery = window.matchMedia(TABLET_LAYOUT_QUERY);

    const syncState = (matches: boolean) => {
      setIsTabletLayout(matches);
    };

    syncState(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      syncState(event.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return isTabletLayout;
}
