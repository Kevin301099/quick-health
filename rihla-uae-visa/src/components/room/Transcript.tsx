import { memo, useState } from 'react';
import { motion } from 'motion/react';
import { Check, Hand } from 'lucide-react';
import type { Item } from '@/agent/types';
import { Generated } from '../cards/registry';
import { Mark, Spinner } from '../ui';
import { cn } from '@/lib/utils';

function ToolRow({ item }: { item: Extract<Item, { kind: 'tool' }> }) {
  const [open, setOpen] = useState(false);
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="pl-[34px]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full min-w-0 items-center gap-2 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-left transition-colors hover:border-line-strong"
      >
        {item.status === 'running' ? <Spinner size={13} className="shrink-0 text-brand" /> : <Check size={13} className="shrink-0 text-ok" aria-hidden />}
        <span className="shrink-0 font-mono text-[12px] font-medium text-brand">{item.name}</span>
        <span className={cn('min-w-0 flex-1 font-mono text-[12px] text-faint', open ? 'whitespace-normal break-words' : 'truncate')}>({item.args})</span>
      </button>
      {item.status === 'done' && item.result && <div className="mt-1 pl-2.5 text-[13px] text-muted">{item.result}</div>}
    </motion.div>
  );
}

function ActionRow({ item }: { item: Extract<Item, { kind: 'action' }> }) {
  const waiting = item.status === 'waiting';
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="pl-[34px]">
      <div className={cn('flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13.5px]', waiting ? 'bg-[var(--attn-wash)] text-fg' : 'bg-[var(--ok-wash)] text-fg')}>
        {waiting ? <Hand size={15} className="shrink-0 text-attn" aria-hidden /> : <Check size={15} className="shrink-0 text-ok" aria-hidden />}
        <span className="min-w-0 flex-1">
          <span className={cn('font-semibold', waiting ? 'text-attn' : 'text-ok')}>{waiting ? 'Your turn' : 'You'}</span>
          <span className="text-muted"> · {waiting ? item.title : (item.summary ?? item.title)}</span>
        </span>
      </div>
    </motion.div>
  );
}

function View({ item }: { item: Item }) {
  switch (item.kind) {
    case 'user':
      return (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="flex justify-end">
          <div className="max-w-[85%] rounded-2xl rounded-br-md bg-brand px-4 py-2.5 text-[14.5px] text-[var(--on-brand)]">{item.text}</div>
        </motion.div>
      );
    case 'text':
      return (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="flex gap-2.5">
          <Mark size={24} className="mt-[1px] shrink-0" />
          <p className={cn('min-w-0 max-w-[62ch] text-[15px] leading-relaxed text-fg pretty', item.streaming && 'caret')}>{item.text}</p>
        </motion.div>
      );
    case 'tool':
      return <ToolRow item={item} />;
    case 'action':
      return <ActionRow item={item} />;
    case 'ui':
      if (item.dock) return null;
      return (
        <div className="pl-0 @lg:pl-[34px]">
          <Generated id={item.id} component={item.component} props={item.props} ready={item.ready} act={() => undefined} readonly />
        </div>
      );
    case 'notice':
      return <div className={cn('pl-[34px] text-[13px]', item.tone === 'warn' ? 'text-attn' : item.tone === 'ok' ? 'text-ok' : 'text-faint')}>{item.text}</div>;
  }
}

const Memo = memo(View, (a, b) => a.item === b.item);

export function Transcript({ items }: { items: Item[] }) {
  return (
    <div className="flex flex-col gap-3.5">
      {items.map((it) => (
        <div key={it.id} id={`item-${it.id}`} className={it.kind === 'ui' && it.dock ? 'hidden' : undefined}>
          <Memo item={it} />
        </div>
      ))}
    </div>
  );
}
