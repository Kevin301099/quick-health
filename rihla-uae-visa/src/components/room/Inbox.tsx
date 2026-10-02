import { useEffect, useRef, useState } from 'react';
import { Bell, Mail } from 'lucide-react';
import { useStore } from '@/agent/store';
import { clock, cn } from '@/lib/utils';

/** The person's inbox in the demo. The portal's codes arrive here, and only the person can read them. */
export function Inbox() {
  const inbox = useStore((s) => s.inbox);
  const readInbox = useStore((s) => s.readInbox);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const unread = inbox.filter((m) => m.unread).length;

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener('rihla:open-inbox', onOpen);
    return () => window.removeEventListener('rihla:open-inbox', onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    readInbox();
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, readInbox, inbox.length]);

  return (
    <div className="relative" ref={ref}>
      <button type="button" className="btn btn-ghost btn-sm relative !px-2.5" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label={`Inbox${unread ? `, ${unread} new` : ''}`}>
        <Bell size={17} aria-hidden />
        {unread > 0 && <span className="absolute right-1 top-1 grid size-[16px] place-items-center rounded-full bg-attn text-[10px] font-bold text-[var(--on-attn)]">{unread}</span>}
      </button>
      {open && (
        <div className="card card-soft absolute right-0 top-[calc(100%+8px)] z-50 w-[360px] max-w-[88vw] overflow-hidden" role="dialog" aria-label="Your inbox">
          <div className="flex items-center gap-2 border-b border-line px-4 py-3">
            <Mail size={15} className="text-brand" aria-hidden />
            <span className="text-[14px] font-semibold">Your inbox</span>
            <span className="ml-auto text-[12px] text-faint">Only you can read this</span>
          </div>
          <ul className="max-h-[360px] overflow-y-auto">
            {inbox.length === 0 && <li className="px-4 py-6 text-center text-[13.5px] text-muted">Nothing yet. Codes from the portal and your bank show up here.</li>}
            {inbox.map((m) => (
              <li key={m.id} className={cn('border-b border-line px-4 py-3 last:border-0', m.unread && 'bg-[var(--brand-wash)]')}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[13px] font-semibold text-fg">{m.from}</span>
                  <span className="font-mono text-[11px] text-faint">{clock(m.at)}</span>
                </div>
                <div className="text-[13.5px] text-fg">{m.subject}</div>
                {m.code && <div className="my-1.5 select-all font-mono text-[28px] font-semibold tracking-[0.18em] text-brand">{m.code}</div>}
                <div className="text-[12.5px] text-muted">{m.body}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
