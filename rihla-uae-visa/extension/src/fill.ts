import {
  DATE_KEYS,
  LABELS,
  NORMAL_PASSPORT,
  PAYMENT_CONTEXT,
  SEX_WORDS,
  bestOption,
  classify,
  countryCandidates,
  datePart,
  datePartValue,
  dateFormatFrom,
  formatDate,
  isTravellerOnly,
  normalise,
  normaliseId,
  type Described,
  type Key,
} from './match';
import type { Pack } from './pack';

/*
  Runs inside the official website's page, only when the traveller asks (the toolbar button or Alt+Shift+F).
  It types the prepared details into the fields it recognises, attaches the prepared documents, marks every
  field it touched, and explains what is left. It never clicks a button, never submits, never pays, and never
  touches a login, a one-time code, a captcha, a card field or a tick-box.
*/

export interface Item {
  key: Key;
  label: string;
  value: string;
  state: 'filled' | 'check' | 'yours' | 'kept';
  note?: string;
  ref?: string;
  frame: 'top' | 'inner';
}

export interface FrameReport {
  url: string;
  filled: number;
  attached: number;
  privateSkipped: number;
  items: Item[];
}

type Field = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
type Kind = 'text' | 'date' | 'select' | 'radio' | 'file';

const GREEN = '#0b7a63';
const AMBER = '#c27a0e';

interface Touched {
  el: Field;
  prevValue: string;
  prevChecked?: boolean;
  prevStyle: string;
  file?: boolean;
}

const state: { touched: Touched[]; seen: WeakSet<Element>; refs: number } = { touched: [], seen: new WeakSet(), refs: 0 };

/* ------------------------------------------------------------------ reading the page */

function allFields(root: Document | ShadowRoot = document, out: Field[] = []): Field[] {
  root.querySelectorAll<Field>('input, select, textarea').forEach((el) => out.push(el));
  // Sites built from web components keep their inputs in shadow roots.
  root.querySelectorAll('*').forEach((el) => {
    if (el.shadowRoot && el.id !== 'rihla-filler-panel') allFields(el.shadowRoot, out);
  });
  return out;
}

function kindOf(el: Field): Kind | 'private' | null {
  if (el.disabled) return null;
  if (el instanceof HTMLSelectElement) return 'select';
  if (el instanceof HTMLTextAreaElement) return 'text';
  const t = (el.getAttribute('type') || 'text').toLowerCase();
  if (t === 'password') return 'private';
  if (['hidden', 'submit', 'button', 'reset', 'image', 'checkbox', 'range', 'color', 'search'].includes(t)) return null;
  if (t === 'radio') return 'radio';
  if (t === 'file') return 'file';
  if (t === 'date') return 'date';
  if (['text', 'email', 'tel', 'number', 'url', ''].includes(t)) return 'text';
  return null;
}

function visible(el: Element) {
  const s = getComputedStyle(el);
  return s.display !== 'none' && s.visibility !== 'hidden' && (el as HTMLElement).getClientRects().length > 0;
}

/** Selects replaced by a styled widget (select2, chosen) are hidden but still drive the page. */
const widgetBacked = (el: Field) => el instanceof HTMLSelectElement && /select2|chosen|choices/.test(`${el.className} ${el.nextElementSibling?.className ?? ''}`);

const clean = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();

function labelText(label: Element) {
  const copy = label.cloneNode(true) as Element;
  copy.querySelectorAll('select, option, input, textarea, button, script, style').forEach((n) => n.remove());
  return clean(copy.textContent).slice(0, 140);
}

function byIds(ids: string | null) {
  return (ids ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .map((id) => labelText(document.getElementById(id) ?? document.createElement('i')))
    .join(' ');
}

/** The nearest text before a field, for forms whose labels are not tied to their inputs (tables, plain divs). */
function nearText(el: Element) {
  let node: Element | null = el;
  for (let depth = 0; node && depth < 4; depth++) {
    let sib = node.previousElementSibling;
    for (let hops = 0; sib && hops < 3; hops++, sib = sib.previousElementSibling) {
      if (sib.matches('input, select, textarea') || sib.querySelector('input, select, textarea')) continue;
      const t = labelText(sib);
      if (t) return t.slice(0, 100);
    }
    node = node.parentElement;
    if (node?.matches('form, body')) break;
  }
  return '';
}

/** The label of a small group around a field, such as "Date of birth" over three boxes. */
function groupLabel(el: Element) {
  const g = el.parentElement?.closest('[role="group"], fieldset');
  if (!g || g.querySelectorAll('input, select, textarea').length > 4) return '';
  const legend = g.querySelector(':scope > legend');
  return legend ? labelText(legend) : (g.getAttribute('aria-label') ?? byIds(g.getAttribute('aria-labelledby')));
}

function describe(el: Element): { d: Described; raw: string } {
  const own: string[] = [];
  const labels = (el as HTMLInputElement).labels;
  if (labels?.length) labels.forEach((l) => own.push(labelText(l)));
  else if (el.closest('label')) own.push(labelText(el.closest('label')!));
  own.push(el.getAttribute('aria-label') ?? '', byIds(el.getAttribute('aria-labelledby')), el.getAttribute('placeholder') ?? '', el.getAttribute('title') ?? '', groupLabel(el));
  const ids = ['name', 'id', 'formcontrolname', 'ng-model', 'data-name', 'data-label'].map((a) => normaliseId(el.getAttribute(a) ?? ''));
  const near = nearText(el);
  const raw = [...own, byIds(el.getAttribute('aria-describedby')), el.getAttribute('data-date-format') ?? '', near].join(' ');
  return { d: { own: [...own.map(normalise), ...ids].filter(Boolean), near: normalise(near) }, raw };
}

/** A radio group is described by its legend or the text before its first button, and by its name. */
function describeGroup(radios: HTMLInputElement[]) {
  const first = radios[0];
  const fs = first.closest('fieldset');
  const group = first.closest('[role="radiogroup"]');
  const own = [fs?.querySelector('legend') ? labelText(fs.querySelector('legend')!) : '', group?.getAttribute('aria-label') ?? '', byIds(group?.getAttribute('aria-labelledby') ?? null)].map(normalise);
  return { own: [...own, normaliseId(first.name)].filter(Boolean), near: normalise(nearText(fs ?? group ?? first.closest('td, div, p, li') ?? first)) };
}

const optionLabel = (r: HTMLInputElement) => clean(r.labels?.[0] ? labelText(r.labels[0]) : r.closest('label') ? labelText(r.closest('label')!) : r.value);

/* ------------------------------------------------------------------ writing to the page */

function remember(el: Field, file = false) {
  state.touched.push({ el, prevValue: el.value, prevChecked: (el as HTMLInputElement).checked, prevStyle: el.getAttribute('style') ?? '', file });
}

function fire(el: Element) {
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function setText(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  el.focus({ preventScroll: true });
  el.value = value;
  fire(el);
  el.dispatchEvent(new Event('blur'));
  el.blur();
}

function mark(el: Element, tone: 'filled' | 'check') {
  const h = el as HTMLElement;
  const ref = `r${++state.refs}`;
  h.dataset.rihlaRef = ref;
  h.style.outline = `2px solid ${tone === 'filled' ? GREEN : AMBER}`;
  h.style.outlineOffset = '2px';
  return ref;
}

function dataUrlToFile(data: string, name: string, mime: string) {
  const bin = atob(data.slice(data.indexOf(',') + 1));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], name, { type: mime });
}

function accepts(el: HTMLInputElement, mime: string, name: string) {
  const accept = (el.getAttribute('accept') ?? '').toLowerCase();
  if (!accept.trim()) return true;
  const ext = `.${name.split('.').pop()}`;
  return accept.split(',').some((a) => {
    const t = a.trim();
    return t === mime || t === ext || (t === '.jpg' && ext === '.jpeg') || (t === '.jpeg' && ext === '.jpg') || (t.endsWith('/*') && mime.startsWith(t.slice(0, -1)));
  });
}

const isPlaceholderOption = (sel: HTMLSelectElement) => {
  const o = sel.options[sel.selectedIndex];
  return !o || o.value === '' || /^(-+|select|choose|please|اختر|--)/i.test(clean(o.text));
};

/* ------------------------------------------------------------------ the values */

function valueFor(key: Key, p: Pack, splitMiddle: boolean): string {
  const t = p.traveller;
  const [first, ...rest] = t.given.split(/\s+/);
  switch (key) {
    case 'given':
      return splitMiddle ? first : t.given;
    case 'middle':
      return rest.join(' ');
    case 'surname':
      return t.surname;
    case 'fullName':
      return `${t.given} ${t.surname}`.trim();
    case 'passportNo':
      return t.passportNo;
    case 'passportType':
      return t.passportType;
    case 'nationality':
    case 'issuingCountry':
      return t.nationality.name;
    case 'sex':
      return t.sex === 'M' ? 'Male' : t.sex === 'F' ? 'Female' : '';
    case 'dob':
      return t.dob;
    case 'birthplace':
      return t.birthplace;
    case 'passportIssued':
      return t.passportIssued;
    case 'passportExpires':
      return t.passportExpires;
    case 'email':
      return t.email;
    case 'phone':
      return t.phone;
    case 'profession':
      return t.profession;
    case 'address':
      return t.address;
    case 'arrival':
      return p.trip.arrival;
    case 'departure':
      return p.trip.departure;
    default:
      return '';
  }
}

function wanted(key: Key, value: string, p: Pack) {
  if (key === 'nationality' || key === 'issuingCountry') return countryCandidates(p.traveller.nationality);
  if (key === 'sex') return p.traveller.sex ? SEX_WORDS[p.traveller.sex] : { words: [], codes: [] };
  if (key === 'passportType') return NORMAL_PASSPORT;
  return { words: [value], codes: [] };
}

const pretty = (key: Key, v: string) => (DATE_KEYS.has(key) && v ? formatDate(v, { order: 'dmy', sep: ' ', month: 'short' }) : v);

/* ------------------------------------------------------------------ one pass over the page */

function pass(pack: Pack, report: FrameReport) {
  const frame: Item['frame'] = window.top === window ? 'top' : 'inner';
  const fields = allFields().filter((el) => !state.seen.has(el) && !el.closest('#rihla-filler-panel'));
  const found: { el: Field; kind: Kind; key: Key; sure: boolean; raw: string; own: string }[] = [];
  const radioGroups = new Map<string, HTMLInputElement[]>();

  for (const el of fields) {
    const kind = kindOf(el);
    if (!kind) continue;
    if (kind !== 'file' && kind !== 'radio' && !visible(el) && !widgetBacked(el)) continue;
    state.seen.add(el);
    if (kind === 'radio') {
      const name = (el as HTMLInputElement).name || `#${radioGroups.size}`;
      radioGroups.set(name, [...(radioGroups.get(name) ?? []), el as HTMLInputElement]);
      continue;
    }
    const { d, raw } = describe(el);
    if (kind === 'private' || isTravellerOnly(d) || d.own.some((t) => PAYMENT_CONTEXT.test(t))) {
      report.privateSkipped++;
      continue;
    }
    const hit = classify(kind, d);
    if (hit) found.push({ el, kind, key: hit.key, sure: hit.sure, raw, own: d.own.join(' ') });
  }

  const splitMiddle = found.some((f) => f.key === 'middle');

  for (const f of found) {
    const value = valueFor(f.key, pack, splitMiddle);
    const label = LABELS[f.key];
    const item: Item = { key: f.key, label, value: pretty(f.key, value), state: 'filled', frame };
    const el = f.el;

    if (f.kind === 'file') {
      const slot = f.key.slice(5);
      const doc = pack.documents.find((x) => x.slot === slot);
      const input = el as HTMLInputElement;
      if (!doc) {
        report.items.push({ ...item, value: '', state: 'yours', note: 'Not among the documents you added in Rihla.' });
        continue;
      }
      item.value = doc.name;
      if (input.files?.length) {
        report.items.push({ ...item, state: 'kept', note: 'A file is already attached here.' });
        continue;
      }
      if (!accepts(input, doc.mime, doc.name)) {
        report.items.push({ ...item, state: 'yours', note: `This box takes ${input.getAttribute('accept')}. Upload a matching file yourself.` });
        continue;
      }
      remember(input, true);
      const dt = new DataTransfer();
      dt.items.add(dataUrlToFile(doc.data, doc.name, doc.mime));
      input.files = dt.files;
      fire(input);
      if (input.files?.length) {
        report.attached++;
        report.items.push({ ...item, ref: mark(visible(input) ? input : input.closest('label, div') ?? input, 'filled') });
      } else report.items.push({ ...item, state: 'yours', note: 'The site would not take the file from us. Upload it yourself.' });
      continue;
    }

    if (!value) {
      report.items.push({ ...item, state: 'yours', note: 'Not in your Rihla details.' });
      continue;
    }

    if (f.kind === 'select') {
      const sel = el as HTMLSelectElement;
      const opts = [...sel.options].map((o) => ({ text: o.text, value: o.value }));
      const part = DATE_KEYS.has(f.key) ? datePart(f.own, opts) : null;
      if (DATE_KEYS.has(f.key) && !part) continue; // a select for a date we cannot read: leave it
      const want = part ? datePartValue(value, part) : wanted(f.key, value, pack);
      if (!isPlaceholderOption(sel)) {
        report.items.push({ ...item, state: 'kept', note: `Already set to “${clean(sel.options[sel.selectedIndex]?.text)}”. We left it.` });
        continue;
      }
      const idx = bestOption(opts, want);
      if (idx === null) {
        report.items.push({ ...item, state: 'yours', note: `Choose ${part ? `the ${part}` : `“${item.value}”`} in this list yourself.`, ref: mark(sel, 'check') });
        continue;
      }
      remember(sel);
      sel.focus({ preventScroll: true });
      sel.selectedIndex = idx;
      fire(sel);
      sel.blur();
      const sure = f.sure && f.key !== 'issuingCountry';
      if (!sure) item.state = 'check';
      if (part) item.label = `${label} (${part})`;
      report.filled++;
      report.items.push({ ...item, value: part ? clean(sel.options[idx].text) : item.value, ref: mark(sel, sure ? 'filled' : 'check') });
      continue;
    }

    // Text and date boxes
    const box = el as HTMLInputElement | HTMLTextAreaElement;
    let text = value;
    if (DATE_KEYS.has(f.key)) {
      if (f.kind === 'date') text = value;
      else {
        const part = datePart(f.own, []);
        text = part ? datePartValue(value, part).codes[0] : formatDate(value, dateFormatFrom(f.raw));
        if (part) item.label = `${label} (${part})`;
      }
    }
    if (box.readOnly) {
      report.items.push({ ...item, value: DATE_KEYS.has(f.key) ? text : item.value, state: 'yours', note: DATE_KEYS.has(f.key) ? 'Pick this date in the calendar.' : 'This box cannot be typed into.', ref: mark(box, 'check') });
      continue;
    }
    if (box.value.trim()) {
      const same = normalise(box.value) === normalise(text);
      report.items.push({ ...item, state: 'kept', note: same ? 'Already filled in.' : `Already had “${clean(box.value).slice(0, 40)}”. We left it.` });
      continue;
    }
    remember(box);
    setText(box, text);
    const took = normalise(box.value) === normalise(text);
    const sure = f.sure && took && f.key !== 'issuingCountry';
    report.filled++;
    report.items.push({ ...item, state: sure ? 'filled' : 'check', note: took ? undefined : 'The site changed what we typed. Check it.', ref: mark(box, sure ? 'filled' : 'check') });
  }

  // Radio groups: sex and passport type are the only ones we answer. Declarations stay with the traveller.
  for (const radios of radioGroups.values()) {
    const d = describeGroup(radios);
    const hit = classify('radio', d);
    if (!hit || (hit.key !== 'sex' && hit.key !== 'passportType')) continue;
    const value = valueFor(hit.key, pack, false);
    const item: Item = { key: hit.key, label: LABELS[hit.key], value, state: 'filled', frame };
    if (radios.some((r) => r.checked)) {
      report.items.push({ ...item, state: 'kept', note: 'Already chosen. We left it.' });
      continue;
    }
    const idx = bestOption(
      radios.map((r) => ({ text: optionLabel(r), value: r.value })),
      wanted(hit.key, value, pack),
    );
    if (idx === null) {
      report.items.push({ ...item, state: 'yours', note: `Choose “${value}” yourself.` });
      continue;
    }
    remember(radios[idx]);
    radios[idx].click();
    report.filled++;
    report.items.push({ ...item, state: hit.sure ? 'filled' : 'check', ref: mark(radios[idx].closest('label') ?? radios[idx], hit.sure ? 'filled' : 'check') });
  }
}

/* ------------------------------------------------------------------ entry points */

async function fillPage(pack: Pack): Promise<FrameReport> {
  clearMarks();
  state.seen = new WeakSet();
  const report: FrameReport = { url: location.href, filled: 0, attached: 0, privateSkipped: 0, items: [] };
  pass(pack, report);
  // Choosing a nationality or a visa type often reveals more fields; give the page a moment and look again.
  await new Promise((r) => setTimeout(r, 600));
  pass(pack, report);
  return report;
}

function clearMarks() {
  document.querySelectorAll<HTMLElement>('[data-rihla-ref]').forEach((el) => {
    el.style.outline = '';
    el.style.outlineOffset = '';
    delete el.dataset.rihlaRef;
  });
}

function undo() {
  for (const t of state.touched.reverse()) {
    if (t.file) (t.el as HTMLInputElement).files = new DataTransfer().files;
    else if (t.el instanceof HTMLInputElement && t.el.type === 'radio') t.el.checked = !!t.prevChecked;
    else t.el.value = t.prevValue;
    fire(t.el);
  }
  state.touched = [];
  clearMarks();
}

/* ------------------------------------------------------------------ the panel on the page */

function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, ...kids: (Node | string)[]) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  for (const k of kids) el.append(k);
  return el;
}

const PANEL_CSS = `
:host { all: initial; }
.p { --bg:#fff; --fg:#0c2230; --muted:#4f6470; --line:rgb(12 34 48 / .1); --wash:#f1f4f4; --ok:${GREEN}; --attn:${AMBER}; --ok-wash:rgb(11 122 99 / .1); --attn-wash:rgb(194 122 14 / .12);
  position: fixed; z-index: 2147483647; right: 16px; bottom: 16px; width: min(380px, calc(100vw - 32px)); max-height: min(72vh, 640px);
  display: flex; flex-direction: column; background: var(--bg); color: var(--fg); border: 1px solid var(--line); border-radius: 16px;
  box-shadow: 0 18px 50px -12px rgb(0 0 0 / .28), 0 2px 6px rgb(0 0 0 / .06); font: 14px/1.45 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans Arabic", sans-serif; }
@media (prefers-color-scheme: dark) { .p { --bg:#0f212d; --fg:#e8f1f3; --muted:#9db3bd; --line:rgb(220 236 240 / .1); --wash:#07131b; --ok-wash:rgb(53 197 162 / .14); --attn-wash:rgb(245 181 68 / .14); --ok:#35c5a2; --attn:#f5b544; } }
.hd { display:flex; align-items:center; gap:10px; padding:14px 16px 12px; border-bottom:1px solid var(--line); }
.logo { width:26px; height:26px; border-radius:8px; background:${GREEN}; display:grid; place-items:center; flex-shrink:0; }
.ttl { font-weight:650; font-size:15px; letter-spacing:-.01em; }
.sub { color:var(--muted); font-size:12.5px; }
.x { margin-left:auto; border:0; background:transparent; color:var(--muted); font-size:20px; line-height:1; cursor:pointer; padding:4px 6px; border-radius:8px; }
.x:hover { background:var(--wash); color:var(--fg); }
.body { overflow:auto; padding:12px 16px 4px; }
.sum { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:10px; }
.chip { border-radius:999px; padding:3px 10px; font-size:12.5px; font-weight:600; background:var(--wash); }
.chip.ok { background:var(--ok-wash); color:var(--ok); } .chip.attn { background:var(--attn-wash); color:var(--attn); }
h3 { font-size:12px; text-transform:uppercase; letter-spacing:.06em; color:var(--muted); margin:14px 0 6px; font-weight:650; }
ul { list-style:none; margin:0; padding:0; }
li { display:flex; align-items:flex-start; gap:10px; padding:8px 0; border-top:1px solid var(--line); }
li:first-child { border-top:0; }
.dot { width:8px; height:8px; border-radius:50%; margin-top:6px; flex-shrink:0; background:var(--muted); }
.dot.ok { background:var(--ok); } .dot.attn { background:var(--attn); }
.k { font-weight:600; font-size:13.5px; } .v { font-size:13px; color:var(--muted); word-break:break-word; } .n { font-size:12.5px; color:var(--muted); margin-top:2px; }
.grow { flex:1; min-width:0; }
.b { border:1px solid var(--line); background:var(--bg); color:var(--fg); border-radius:9px; padding:4px 9px; font:inherit; font-size:12.5px; font-weight:600; cursor:pointer; flex-shrink:0; }
.b:hover { background:var(--wash); }
.you { background:var(--wash); border-radius:12px; padding:10px 12px; margin:12px 0 10px; font-size:13px; }
.you strong { display:block; margin-bottom:2px; }
.ft { display:flex; gap:8px; padding:10px 16px 14px; border-top:1px solid var(--line); align-items:center; }
.ft .sub { margin-right:auto; }
`;

function showPanel(reports: FrameReport[], pack: Pack) {
  document.getElementById('rihla-filler-panel')?.remove();
  const host = h('div', { id: 'rihla-filler-panel' });
  const root = host.attachShadow({ mode: 'open' });
  const style = h('style');
  style.textContent = PANEL_CSS;
  const items = reports.flatMap((r) => r.items);
  const filled = reports.reduce((s, r) => s + r.filled, 0);
  const attached = reports.reduce((s, r) => s + r.attached, 0);
  const privateSkipped = reports.reduce((s, r) => s + r.privateSkipped, 0);
  const check = items.filter((i) => i.state === 'check');
  const yours = items.filter((i) => i.state === 'yours');

  const show = (i: Item) => {
    if (!i.ref || i.frame !== 'top') return null;
    const b = h('button', { class: 'b', type: 'button' }, 'Show');
    b.addEventListener('click', () => {
      const el = document.querySelector<HTMLElement>(`[data-rihla-ref="${i.ref}"]`);
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      el?.focus({ preventScroll: true });
    });
    return b;
  };
  const copy = (text: string) => {
    const b = h('button', { class: 'b', type: 'button' }, 'Copy');
    b.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(text);
        b.textContent = 'Copied';
      } catch {
        b.textContent = text;
      }
    });
    return b;
  };
  const row = (i: Item, tone: 'ok' | 'attn' | '') => {
    const li = h('li', {}, h('span', { class: `dot ${tone}` }), h('div', { class: 'grow' }, h('div', { class: 'k' }, i.label), h('div', { class: 'v' }, i.value || '—'), ...(i.note ? [h('div', { class: 'n' }, i.note)] : [])));
    const action = i.state === 'yours' && i.value ? copy(i.value) : show(i);
    if (action) li.append(action);
    return li;
  };

  const logo = h('span', { class: 'logo' });
  logo.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"><path d="M5 19c2-8 7-13 14-14"/></svg>';
  const close = h('button', { class: 'x', type: 'button', 'aria-label': 'Close' }, '×');
  close.addEventListener('click', () => host.remove());

  const body = h(
    'div',
    { class: 'body' },
    h('div', { class: 'sum' }, h('span', { class: 'chip ok' }, `${filled} filled`), h('span', { class: 'chip ok' }, `${attached} attached`), ...(check.length ? [h('span', { class: 'chip attn' }, `${check.length} to check`)] : []), ...(yours.length ? [h('span', { class: 'chip' }, `${yours.length} for you`)] : [])),
  );
  if (!filled && !attached && !check.length && !yours.length) {
    body.append(h('div', { class: 'you' }, h('strong', {}, 'Nothing to fill on this page'), 'This page has no fields we recognise. Move on to the next page of the form and fill it again.'));
  }
  if (check.length) body.append(h('h3', {}, 'Check these'), h('ul', {}, ...check.map((i) => row(i, 'attn'))));
  if (yours.length) body.append(h('h3', {}, 'Fill these yourself'), h('ul', {}, ...yours.map((i) => row(i, ''))));
  const done = items.filter((i) => i.state === 'filled');
  if (done.length) body.append(h('h3', {}, 'Filled'), h('ul', {}, ...done.map((i) => row(i, 'ok'))));
  body.append(
    h(
      'div',
      { class: 'you' },
      h('strong', {}, 'Only you can do these'),
      `Sign-in and one-time codes, every declaration and tick-box, payment, and the final Submit.${privateSkipped ? ` We left ${privateSkipped} private field${privateSkipped === 1 ? '' : 's'} untouched.` : ''}`,
    ),
  );

  const undoBtn = h('button', { class: 'b', type: 'button' }, 'Undo');
  undoBtn.addEventListener('click', () => {
    undo();
    host.remove();
  });
  const clearBtn = h('button', { class: 'b', type: 'button' }, 'Clear marks');
  clearBtn.addEventListener('click', () => {
    clearMarks();
    host.remove();
  });

  root.append(
    style,
    h(
      'div',
      { class: 'p', role: 'dialog', 'aria-label': 'Rihla Filler' },
      h('div', { class: 'hd' }, logo, h('div', {}, h('div', { class: 'ttl' }, 'Filled by Rihla'), h('div', { class: 'sub' }, `${pack.traveller.given} ${pack.traveller.surname}`)), close),
      body,
      h('div', { class: 'ft' }, h('span', { class: 'sub' }, 'Rihla never submits or pays.'), undoBtn, clearBtn),
    ),
  );
  document.documentElement.append(host);
}

declare global {
  // eslint-disable-next-line no-var
  var __rihla: { fill: (pack: Pack) => Promise<FrameReport>; panel: (reports: FrameReport[], pack: Pack) => void; undo: () => void } | undefined;
}

globalThis.__rihla ??= { fill: fillPage, panel: showPanel, undo };
