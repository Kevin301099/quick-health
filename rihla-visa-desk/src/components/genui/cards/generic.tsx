import { Check, Circle, Ban, Info } from 'lucide-react';
import type { CardProps } from '../types';
import { CardShell } from '../Frame';
import { Pill } from '../../ui';

/* Free-form cards. A model (or the local router) can compose these for questions nobody planned for. */

export function InfoCard({ props }: CardProps<{ title: string; tone?: 'neutral' | 'ok' | 'warn'; bullets: string[]; footnote?: string }>) {
  return (
    <CardShell eyebrow="Answer" title={props.title} tone={props.tone === 'warn' ? 'warn' : 'default'} right={props.tone === 'ok' ? <Pill tone="ok">Clear</Pill> : props.tone === 'warn' ? <Pill tone="warn">Check</Pill> : <Info size={16} className="text-faint" aria-hidden />}>
      <ul className="space-y-2 text-[14px] text-fg">
        {props.bullets.map((b, i) => (
          <li key={i} className="flex gap-2.5">
            <span className="mt-[9px] size-1 shrink-0 rounded-full bg-brass" aria-hidden />
            <span className="min-w-0 pretty">{b}</span>
          </li>
        ))}
      </ul>
      {props.footnote && <p className="mt-3 text-[12px] text-faint">{props.footnote}</p>}
    </CardShell>
  );
}

const STATUS = {
  done: { icon: Check, cls: 'text-ok', label: 'Done' },
  todo: { icon: Circle, cls: 'text-faint', label: 'To do' },
  blocked: { icon: Ban, cls: 'text-crit', label: 'Blocked' },
} as const;

export function Checklist({ props }: CardProps<{ title: string; items: { label: string; status: 'done' | 'todo' | 'blocked'; note?: string }[] }>) {
  const done = props.items.filter((i) => i.status === 'done').length;
  return (
    <CardShell eyebrow="Checklist" title={props.title} right={<Pill mono tone={done === props.items.length ? 'ok' : 'neutral'}>{done}/{props.items.length}</Pill>}>
      <ul className="ledger">
        {props.items.map((it, i) => {
          const S = STATUS[it.status] ?? STATUS.todo;
          return (
            <li key={i} className="flex items-start gap-3 py-2.5">
              <S.icon size={16} className={`mt-0.5 shrink-0 ${S.cls}`} aria-label={S.label} />
              <div className="min-w-0">
                <div className="text-[14px] text-fg">{it.label}</div>
                {it.note && <div className="text-[12.5px] text-muted">{it.note}</div>}
              </div>
            </li>
          );
        })}
      </ul>
    </CardShell>
  );
}

export function ComparisonTable({ props }: CardProps<{ title: string; columns: string[]; rows: { label: string; cells: string[] }[]; footnote?: string }>) {
  return (
    <CardShell eyebrow="Comparison" title={props.title}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-[13.5px]">
          <thead>
            <tr>
              <th className="py-2 pr-4" />
              {props.columns.map((c) => (
                <th key={c} className="py-2 pr-4 text-[13px] font-semibold text-fg">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {props.rows.map((r) => (
              <tr key={r.label} className="border-t border-line align-top">
                <th className="eyebrow py-2.5 pr-4 text-left font-normal">{r.label}</th>
                {r.cells.map((c, i) => (
                  <td key={i} className="py-2.5 pr-4 text-fg">
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {props.footnote && <p className="mt-3 text-[12px] text-faint">{props.footnote}</p>}
    </CardShell>
  );
}
