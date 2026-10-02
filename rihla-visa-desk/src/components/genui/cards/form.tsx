import { useMemo, useState } from 'react';
import { Lock, Pencil } from 'lucide-react';
import type { FormDraftData, FormField } from '@/agent/types';
import { formProgress } from '@/agent/forms';
import type { CardProps } from '../types';
import { CardShell } from '../Frame';
import { Initials, Pill } from '../../ui';
import { cn } from '@/lib/utils';

function Row({ f, onEdit, readonly }: { f: FormField; onEdit: (v: string) => void; readonly: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(f.value);
  const locked = f.locked || readonly;
  const commit = () => {
    setEditing(false);
    if (draft.trim() && draft !== f.value) onEdit(draft.trim());
    else setDraft(f.value);
  };
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 py-[7px]">
      <div className="min-w-0">
        <div className="text-[12px] text-faint">{f.label}</div>
        {editing ? (
          <input
            autoFocus
            id={`edit-${f.key}`}
            className="field mt-0.5 !min-h-[32px] !py-1 font-mono text-[13px]"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') {
                setDraft(f.value);
                setEditing(false);
              }
            }}
          />
        ) : (
          <button
            type="button"
            disabled={locked}
            onClick={() => setEditing(true)}
            className={cn('group flex w-full items-center gap-1.5 text-left font-mono text-[13px] leading-snug', locked ? 'cursor-default text-faint' : 'text-fg')}
          >
            <span className="break-words">{f.value}</span>
            {!locked && <Pencil size={11} className="shrink-0 text-faint opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden />}
          </button>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5">
        <span className="font-mono text-[11px] text-faint">{f.source}</span>
        {f.by === 'human' && <Pill tone="brass">Edited by you</Pill>}
      </div>
    </div>
  );
}

export function FormDraft({ props, ctx }: CardProps<{ form: FormDraftData; progress: { agent: number; applicant: number; human: number; total: number } }>) {
  const [form, setForm] = useState<FormDraftData>(props.form);
  const [tab, setTab] = useState(0);
  const prog = useMemo(() => formProgress(form), [form]);
  const t = form.travellers[tab] ?? form.travellers[0];

  const edit = (sectionId: string, key: string, value: string) => {
    let before = '';
    setForm((cur) => ({
      ...cur,
      travellers: cur.travellers.map((tr, i) =>
        i !== tab
          ? tr
          : {
              ...tr,
              sections: tr.sections.map((s) =>
                s.id !== sectionId
                  ? s
                  : {
                      ...s,
                      fields: s.fields.map((f) => {
                        if (f.key !== key) return f;
                        before = f.value;
                        return { ...f, value, by: 'human' as const, source: 'Edited by you' };
                      }),
                    },
              ),
            },
      ),
    }));
    ctx.editField(t.name, key, before, value);
  };

  return (
    <CardShell
      eyebrow={form.portal}
      title="Application draft"
      right={
        <Pill tone="ok" mono>
          {prog.agent + prog.human} filled · {prog.applicant} for the applicant
        </Pill>
      }
    >
      <div className="relative mb-4 h-[3px] overflow-hidden rounded-full bg-surface3">
        <div className="absolute inset-y-0 left-0 w-full origin-left rounded-full bg-brass" style={{ transform: `scaleX(${prog.total ? (prog.agent + prog.human) / prog.total : 0})` }} />
      </div>

      {form.travellers.length > 1 && (
        <div role="tablist" aria-label="Travellers" className="mb-3 flex flex-wrap gap-1.5">
          {form.travellers.map((tr, i) => (
            <button
              key={tr.id}
              role="tab"
              aria-selected={i === tab}
              type="button"
              onClick={() => setTab(i)}
              className={cn(
                'inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[13px] transition-colors',
                i === tab ? 'border-brass bg-[var(--brass-wash)] text-fg' : 'border-line text-muted hover:text-fg',
              )}
            >
              <Initials name={tr.name} size={20} />
              {tr.name.split(' ')[0]}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-x-8 gap-y-4 @2xl:grid-cols-2">
        {t.sections.map((s) => (
          <section key={s.id} className={cn('min-w-0 rounded-xl p-3', s.applicantOnly ? 'bg-surface2' : '')} aria-label={s.title}>
            <div className="mb-1 flex items-center justify-between gap-2">
              <h4 className="eyebrow">{s.title}</h4>
              {s.applicantOnly && (
                <span className="inline-flex items-center gap-1 text-[11.5px] text-faint">
                  <Lock size={11} aria-hidden /> Applicant only
                </span>
              )}
            </div>
            <div className="ledger">
              {s.fields.map((f) => (
                <Row key={f.key} f={f} readonly={ctx.readonly} onEdit={(v) => edit(s.id, f.key, v)} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </CardShell>
  );
}
