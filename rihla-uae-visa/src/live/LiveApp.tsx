import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { fmtDate } from '@/lib/utils';
import { Spinner } from '@/components/ui';
import { Landing } from '@/components/landing/Landing';
import { api, type Status } from './api';
import dynamic from 'next/dynamic';
import { LiveHeader, StatusPill, go } from './chrome';
import { useMe } from './hooks';
import { SignIn } from './SignIn';

const Loading = () => <div className="min-h-[60vh]" aria-busy="true" />;
const LiveStart = dynamic(() => import('./Start').then((m) => m.LiveStart), { loading: Loading });
const LiveApplicationPage = dynamic(() => import('./Application').then((m) => m.LiveApplicationPage), { loading: Loading });
const OpsConsole = dynamic(() => import('./Ops').then((m) => m.OpsConsole), { loading: Loading });

/*
  Routes for the live product. Plain hash tokens only (#apply, #apps, #ops, #app-<id>), so links work everywhere,
  including inside an embedded preview.
*/

function useHash() {
  const [hash, setHash] = useState('');
  useEffect(() => {
    const read = () => setHash(window.location.hash.replace(/^#/, ''));
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, []);
  return hash;
}

export default function LiveApp() {
  const hash = useHash();
  const m = hash.match(/^app-([0-9a-f-]{36})(-paid)?$/i);
  if (m) return <LiveApplicationPage key={m[1]} id={m[1]} justPaid={!!m[2]} />;
  if (hash === 'apply') return <LiveStart />;
  if (hash === 'apps') return <MyApplications />;
  if (hash === 'ops') return <OpsConsole />;
  return <Landing onApply={() => go('apply')} live />;
}

interface Summary {
  id: string;
  status: Status;
  name: string;
  answers: { arrival: string; days: number; emirate: string };
  createdAt: string;
}

function MyApplications() {
  const me = useMe();
  const [list, setList] = useState<Summary[] | null>(null);
  useEffect(() => {
    if (me) void api<{ applications: Summary[] }>('/v1/applications').then((r) => setList(r.applications));
  }, [me]);
  return (
    <div className="min-h-full bg-bg">
      <LiveHeader me={me} />
      <main className="mx-auto max-w-[760px] px-6 py-10">
        {me === null ? (
          <SignIn title="Sign in to see your applications" />
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h1 className="font-display text-[34px] font-bold tracking-[-0.03em]">Your applications</h1>
              <a href="#apply" className="btn btn-primary">
                New application <ArrowRight size={15} aria-hidden />
              </a>
            </div>
            <ul className="ledger mt-6 rounded-2xl border border-line bg-surface">
              {list === null && (
                <li className="p-5">
                  <Spinner />
                </li>
              )}
              {list?.length === 0 && <li className="p-5 text-[14.5px] text-muted">No applications yet.</li>}
              {list?.map((a) => (
                <li key={a.id}>
                  <a href={`#app-${a.id}`} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-surface2">
                    <span className="min-w-0">
                      <span className="block truncate text-[16px] font-semibold text-fg">{a.name || 'Tourist visa'}</span>
                      <span className="block text-[13.5px] text-muted">
                        {a.answers.days}-day tourist visa · arriving {fmtDate(a.answers.arrival)} · {a.answers.emirate}
                      </span>
                    </span>
                    <StatusPill status={a.status} />
                  </a>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
    </div>
  );
}
