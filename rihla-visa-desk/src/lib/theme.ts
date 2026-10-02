import { useCallback, useEffect, useState } from 'react';
import { safeStorage } from './utils';

export type Theme = 'dark' | 'light';

export function useTheme() {
  const [theme, setTheme] = useState<Theme>('dark');
  useEffect(() => {
    const cur = document.documentElement.getAttribute('data-theme');
    setTheme(cur === 'light' ? 'light' : 'dark');
    // Follow a host that changes the theme after load.
    const mo = new MutationObserver(() => {
      setTheme(document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark');
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => mo.disconnect();
  }, []);
  const toggle = useCallback(() => {
    const next: Theme = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    safeStorage().set('rihla-theme', next);
    setTheme(next);
  }, []);
  return { theme, toggle };
}
