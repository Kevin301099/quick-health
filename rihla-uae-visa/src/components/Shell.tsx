import { useCallback, useEffect, useState } from 'react';
import { Landing } from './landing/Landing';
import dynamic from 'next/dynamic';
import { useStore } from '@/agent/store';
import { LIVE } from '@/live/api';

/*
  Only the landing page loads up front. The application screens, the filing room and the live app arrive
  on demand, so the first visit downloads a fraction of the code.
*/
const Loading = () => <div className="min-h-[60vh]" aria-busy="true" />;
const StartFlow = dynamic(() => import('./start/StartFlow').then((m) => m.StartFlow), { loading: Loading });
const Room = dynamic(() => import('./room/Room').then((m) => m.Room), { loading: Loading });
const LiveApp = dynamic(() => import('@/live/LiveApp'), { loading: Loading });

type View = 'site' | 'start' | 'room';

const fromHash = (): View => {
  const h = typeof window !== 'undefined' ? window.location.hash : '';
  return h === '#apply' ? 'start' : h === '#room' ? 'room' : 'site';
};

/** Built with NEXT_PUBLIC_API_URL, the site is the live product; without it, the self-contained demo. */
export default function Shell() {
  return LIVE ? <LiveApp /> : <DemoShell />;
}

/** One page, three views. The hash keeps each one linkable without a second document. */
function DemoShell() {
  const [view, setView] = useState<View>('site');

  useEffect(() => {
    const read = () => {
      const v = fromHash();
      // A room with nothing to file has nothing to show, so send the person to the start.
      setView(v === 'room' && Object.keys(useStore.getState().files).length === 0 ? 'start' : v);
    };
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, []);

  const go = useCallback((next: View) => {
    setView(next);
    try {
      window.history.replaceState(null, '', next === 'start' ? '#apply' : next === 'room' ? '#room' : window.location.pathname + window.location.search);
    } catch {
      /* some frames refuse history changes; the view still switches */
    }
    window.scrollTo({ top: 0 });
  }, []);

  if (view === 'room')
    return (
      <Room
        onExit={() => go('site')}
        onRestart={() => {
          void import('@/agent/engine').then((e) => e.stopRun());
          useStore.getState().resetRun();
          go('start');
        }}
      />
    );
  if (view === 'start')
    return (
      <StartFlow
        onExit={() => go('site')}
        onStart={() => {
          go('room');
          setTimeout(() => void import('@/agent/engine').then((e) => e.startRun()), 250);
        }}
      />
    );
  return <Landing onApply={() => go('start')} />;
}
