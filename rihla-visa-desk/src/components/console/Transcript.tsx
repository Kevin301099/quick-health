import { memo, useState } from 'react';
import { motion } from 'motion/react';
import { Check } from 'lucide-react';
import type { Item } from '@/agent/types';
import type { GenUICtx } from '../genui/types';
import { Generated } from '../genui/registry';
import { Mark, Spinner } from '../ui';
import { cn } from '@/lib/utils';

function ToolRow({ item }: { item: Extract<Item, { kind: 'tool' }> }) {
  const [open, setOpen] = useState(false);
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="pl-[34px]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full min-w-0 items-center gap-2 rounded-lg border border-line bg-raised px-2.5 py-1.5 text-left transition-colors hover:border-line-strong"
        style={{ borderColor: undefined }}
      >
        {item.status === 'running' ? <Spinner size={13} className="shrink-0 text-brass" /> : <Check size={13} className="shrink-0 text-ok" aria-hidden />}
        <span className="shrink-0 font-mono text-[12px] text-brasshi">{item.name}</span>
        <span className={cn('min-w-0 flex-1 font-mono text-[11.5px] text-faint', open ? 'whitespace-normal break-words' : 'truncate')}>({item.args})</span>
        {item.ms ? <span className="hidden shrink-0 font-mono text-[11px] text-faint sm:inline">{item.ms} ms</span> : null}
      </button>
      {item.status === 'done' && item.result && <div className="mt-1 pl-2.5 text-[12.5px] text-muted">{item.result}</div>}
    </motion.div>
  );
}

function ItemView({ item, ctx }: { item: Item; ctx: GenUICtx }) {
  switch (item.kind) {
    case 'user':
      return (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="flex justify-end">
          <div className="max-w-[85%] rounded-2xl rounded-br-md bg-surface3 px-4 py-2.5 text-[14.5px] text-fg">{item.text}</div>
        </motion.div>
      );
    case 'text':
      return (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="flex gap-3">
          <Mark size={22} className="mt-[3px] shrink-0" />
          <p className={cn('min-w-0 max-w-[68ch] text-[15px] leading-relaxed text-fg pretty', item.streaming && 'caret')}>{item.text}</p>
        </motion.div>
      );
    case 'tool':
      return <ToolRow item={item} />;
    case 'ui':
      return (
        <div className="pl-0 sm:pl-[34px]">
          <Generated id={item.id} component={item.component} props={item.props} ready={item.ready} ctx={ctx} />
        </div>
      );
    case 'notice':
      return (
        <div className={cn('pl-[34px] text-[12.5px]', item.tone === 'warn' ? 'text-warn' : item.tone === 'ok' ? 'text-ok' : 'text-faint')}>{item.text}</div>
      );
  }
}

const Memo = memo(ItemView, (a, b) => a.item === b.item && a.ctx === b.ctx);

export function Transcript({ items, ctx }: { items: Item[]; ctx: GenUICtx }) {
  return (
    <div className="flex flex-col gap-3.5">
      {items.map((it) => (
        <div key={it.id} id={`item-${it.id}`} className="scroll-mt-4">
          <Memo item={it} ctx={ctx} />
        </div>
      ))}
    </div>
  );
}
