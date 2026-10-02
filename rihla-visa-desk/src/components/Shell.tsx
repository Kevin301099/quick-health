import { useCallback, useEffect, useState } from 'react';
import { Console } from './console/Console';
import { Landing } from './landing/Landing';

type View = 'site' | 'demo';

/** One page, two views. The hash keeps the demo linkable (#demo) without a second document. */
export default function Shell({ initial = 'site' }: { initial?: View }) {
  const [view, setView] = useState<View>(initial);

  useEffect(() => {
    const read = () => setView(window.location.hash === '#demo' ? 'demo' : initial === 'demo' && !window.location.hash ? 'demo' : 'site');
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, [initial]);

  const go = useCallback((next: View) => {
    setView(next);
    try {
      window.history.replaceState(null, '', next === 'demo' ? '#demo' : window.location.pathname + window.location.search);
    } catch {
      /* some frames refuse history changes; the view state still switches */
    }
    window.scrollTo({ top: 0 });
  }, []);

  if (view === 'demo') return <Console onExit={() => go('site')} />;
  return <Landing onOpenDemo={() => go('demo')} />;
}
