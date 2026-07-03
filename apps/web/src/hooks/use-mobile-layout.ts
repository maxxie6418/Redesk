import { useEffect, useState } from 'react';

const MOBILE_LAYOUT_QUERY = '(max-width: 1023px)';

function getInitialValue() {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.matchMedia(MOBILE_LAYOUT_QUERY).matches;
}

export function useMobileLayout() {
  const [isMobileLayout, setIsMobileLayout] = useState(getInitialValue);

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
