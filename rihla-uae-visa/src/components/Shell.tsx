import { useCallback, useEffect, useState } from 'react';
import { Landing } from './landing/Landing';
import { StartFlow } from './start/StartFlow';
import { Room } from './room/Room';
import { startRun, stopRun } from '@/agent/engine';
import { useStore } from '@/agent/store';

type View = 'site' | 'start' | 'room';

const fromHash = (): View => {
  const h = typeof window !== 'undefined' ? window.location.hash : '';
  return h === '#apply' ? 'start' : h === '#room' ? 'room' : 'site';
};

/** One page, three views. The hash keeps each one linkable without a second document. */
export default function Shell() {
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
          stopRun();
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
          setTimeout(() => startRun(), 250);
        }}
      />
    );
  return <Landing onApply={() => go('start')} />;
}
