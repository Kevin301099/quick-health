import { useCallback, useEffect, useState } from 'react';
import { safeStorage } from './utils';

export type Theme = 'dark' | 'light';

const effective = (): Theme => {
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr === 'light' || attr === 'dark') return attr;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

/** Follows the host or the system until the person picks a theme; then remembers the pick. */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>('light');
  useEffect(() => {
    setTheme(effective());
    const mo = new MutationObserver(() => setTheme(effective()));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    const onMq = () => setTheme(effective());
    mq?.addEventListener?.('change', onMq);
    return () => {
      mo.disconnect();
      mq?.removeEventListener?.('change', onMq);
    };
  }, []);
  const toggle = useCallback(() => {
    const next: Theme = effective() === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    safeStorage().set('rihla-theme', next);
    setTheme(next);
  }, []);
  return { theme, toggle };
}
