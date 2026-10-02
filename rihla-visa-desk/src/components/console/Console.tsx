import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Layers, ListChecks, MessagesSquare, Moon, Sparkles, Sun } from 'lucide-react';
import { useStore } from '@/agent/store';
import { makeUICtx } from '@/agent/actions';
import { liveSample } from '@/agent/live';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { Pill, Wordmark } from '../ui';
import { CaseList } from './CaseList';
import { Workspace } from './Workspace';
import { ActivityPanel } from './ActivityPanel';
import { NewCaseModal } from './NewCaseModal';

type Tab = 'cases' | 'agent' | 'activity';

export function Console({ onExit }: { onExit: () => void }) {
  const cases = useStore((s) => s.cases);
  const order = useStore((s) => s.order);
  const activeId = useStore((s) => s.activeId);
  const settings = useStore((s) => s.settings);
  const liveAvailable = useStore((s) => s.liveAvailable);
  const setActive = useStore((s) => s.setActive);
  const setSettings = useStore((s) => s.setSettings);
  const setLiveAvailable = useStore((s) => s.setLiveAvailable);
  const { theme, toggle } = useTheme();
  const [tab, setTab] = useState<Tab>('agent');
  const [modal, setModal] = useState(false);

  const rt = cases[activeId];
  const ctx = useMemo(() => makeUICtx(activeId), [activeId]);

  useEffect(() => {
    document.documentElement.classList.add('app-mode');
    return () => document.documentElement.classList.remove('app-mode');
  }, []);

  useEffect(() => {
    let alive = true;
    void liveSample().then((s) => alive && setLiveAvailable(!!s));
    return () => {
      alive = false;
    };
  }, [setLiveAvailable]);

  const toggleLive = async () => {
    if (!settings.live) {
      const s = await liveSample();
      if (!s) {
        setLiveAvailable(false);
        return;
      }
      setLiveAvailable(true);
    }
    setSettings({ live: !settings.live });
  };

  const jump = (itemId: string) => {
    setTab('agent');
    setTimeout(() => document.getElementById(`item-${itemId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
  };

  const needs = Object.values(cases).filter((c) => c.status === 'needs_you').length;

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg">
      {/* top bar */}
      <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-4">
          <button type="button" onClick={onExit} className="flex items-center gap-2 rounded-lg" aria-label="Back to the Rihla site">
            <Wordmark />
          </button>
          <span className="hidden h-5 w-px bg-line-strong md:block" style={{ background: 'var(--line-strong)' }} aria-hidden />
          <div className="hidden min-w-0 md:block">
            <div className="truncate text-[13px] font-medium text-fg">Gulf Horizon Travel</div>
            <div className="truncate text-[11.5px] text-faint">Visa desk · demo workspace</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Pill tone="warn" className="hidden lg:inline-flex">
            Sandbox. Nothing is submitted live
          </Pill>
          <div role="group" aria-label="Agent speed" className="inline-flex shrink-0 rounded-lg border border-line bg-raised p-0.5">
            {([1, 2, 4] as const).map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={settings.speed === s}
                onClick={() => setSettings({ speed: s })}
                className={cn('rounded-md px-2.5 py-1 font-mono text-[12px] transition-colors', settings.speed === s ? 'bg-surface3 text-fg' : 'text-faint hover:text-fg')}
              >
                {s}×
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={toggleLive}
            aria-pressed={settings.live}
            disabled={liveAvailable === false}
            title={liveAvailable === false ? 'Live Claude is off in this build' : 'Let Claude answer questions the desk does not cover'}
            className={cn('btn btn-sm !px-2.5 sm:!px-3', settings.live ? 'btn-primary' : 'btn-outline')}
          >
            <Sparkles size={14} aria-hidden /> <span className="hidden sm:inline">Live Claude</span>
          </button>
          <button type="button" className="btn btn-ghost btn-sm !px-2.5" onClick={toggle} aria-label={theme === 'dark' ? 'Switch to the light theme' : 'Switch to the dark theme'}>
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button type="button" className="btn btn-ghost btn-sm !px-2.5 sm:!px-3" onClick={onExit} aria-label="Back to the site">
            <ArrowLeft size={14} aria-hidden /> <span className="hidden sm:inline">Site</span>
          </button>
        </div>
      </header>

      {/* panes */}
      <div className="grid min-h-0 flex-1 min-[1100px]:grid-cols-[272px_minmax(0,1fr)_330px]">
        <aside className={cn('min-h-0 border-r border-line bg-bg', tab === 'cases' ? 'block' : 'hidden', 'min-[1100px]:block')} aria-label="Cases">
          <CaseList
            cases={cases}
            order={order}
            activeId={activeId}
            onSelect={(id) => {
              setActive(id);
              setTab('agent');
            }}
            onNew={() => setModal(true)}
          />
        </aside>
        <main className={cn('min-h-0 min-w-0', tab === 'agent' ? 'block' : 'hidden', 'min-[1100px]:block')}>
          <Workspace key={activeId} rt={rt} ctx={ctx} />
        </main>
        <aside className={cn('min-h-0 border-l border-line bg-bg', tab === 'activity' ? 'block' : 'hidden', 'min-[1100px]:block')} aria-label="Activity">
          <ActivityPanel rt={rt} onJump={jump} />
        </aside>
      </div>

      {/* phone tabs */}
      <nav className="grid grid-cols-3 border-t border-line bg-raised min-[1100px]:hidden" aria-label="Sections" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {(
          [
            ['cases', 'Cases', Layers],
            ['agent', 'Agent', MessagesSquare],
            ['activity', 'Activity', ListChecks],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            aria-current={tab === id ? 'page' : undefined}
            className={cn('relative flex flex-col items-center gap-0.5 py-2.5 text-[12px] transition-colors', tab === id ? 'text-brasshi' : 'text-faint')}
          >
            <Icon size={18} aria-hidden />
            {label}
            {id === 'cases' && needs > 0 && <span className="absolute right-[34%] top-1.5 size-2 rounded-full bg-warn" aria-label={`${needs} cases need you`} />}
          </button>
        ))}
      </nav>

      {modal && <NewCaseModal onClose={() => setModal(false)} />}
    </div>
  );
}
