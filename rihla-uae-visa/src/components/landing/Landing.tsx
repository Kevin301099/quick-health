import { ArrowRight, Ban, CreditCard, Eye, Mail, Moon, PenLine, Plus, ScrollText, ShieldCheck, Sun } from 'lucide-react';
import { RULES_REVIEWED, SOURCES } from '@/domain/visas';
import { useTheme } from '@/lib/theme';
import { Wordmark } from '../ui';
import { ChecksReport } from '../cards/results';
import { Checker } from './Checker';
import { HeroPreview } from './HeroPreview';
import { Pricing } from './Pricing';

const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

const NAV: [string, string][] = [
  ['how', 'How it works'],
  ['check', 'Do I need a visa?'],
  ['pricing', 'Pricing'],
  ['faq', 'Questions'],
];

const YOUR_TURN = [
  {
    icon: Mail,
    title: 'The email code',
    body: 'The portal emails you a 6-digit code to prove the address is yours. It shows up on screen the moment it is needed. You type it; the agent carries on.',
  },
  {
    icon: ScrollText,
    title: 'The declarations',
    body: 'Prior refusals, criminal record, health. These are legal statements, so the agent reads each one out and you answer. It never ticks a box for you.',
  },
  {
    icon: PenLine,
    title: 'The sign-off',
    body: 'Before anything is submitted you see every field next to the document it came from. Nothing goes in until you approve. Family visits wait for your sponsor to approve too.',
  },
  {
    icon: CreditCard,
    title: 'The payment',
    body: 'The card form opens in the browser and the agent steps back. You type your card on the payment page itself. It never reaches the agent or us.',
  },
];

const STEPS = [
  { who: 'You do this', title: 'Upload your documents', body: 'Passport, photo, ticket, hotel and insurance, all at once. A family visit adds your sponsor’s papers. Nothing is filed yet.' },
  { who: 'The agent does this', title: 'It reads, checks and files', body: 'It reads every page, cross-checks the names and dates, then opens the portal and fills in each field in a browser you can watch.' },
  { who: 'You, for a moment', title: 'You step in when it asks', body: 'A code, a declaration, a signature, the payment. Each appears on screen as a single card. Do it, and the agent goes on to the next step.' },
  { who: 'The portal decides', title: 'The permit arrives', body: 'The agent reads the status, and when it clears you get the permit and a short list of what to do before you fly.' },
];

const NEVER = [
  ['Sees your card', 'The payment page is the government’s. You type your card there, not to us.'],
  ['Answers for you', 'Declarations are yours. If it needs a yes or a no from you, it asks.'],
  ['Submits unseen', 'Nothing is filed until you have seen every field and signed off.'],
  ['Works around the rules', 'No CAPTCHA tricks, no rate-limit dodging. If the portal wants a person, you are the person.'],
  ['Guesses', 'If your name is spelled two ways across documents, it stops and asks which is right.'],
];

const FAQ = [
  ['Is this a government service?', 'No. Rihla is not affiliated with any government. In this demo the agent files into a sandbox portal that imitates a government site, so you can see the whole journey without filing anything real.'],
  ['What happens to my documents?', 'In this demo they stay in your browser. The photo check, for example, is measured on the pixels on your own device. Nothing is uploaded to a server.'],
  ['Is my card safe?', 'The card form is on the payment page, and you fill it in yourself. The agent never sees the number, and we never store it. The agent watches only for the page to say the payment went through.'],
  ['How long does it take?', 'The agent files in a couple of minutes once your documents are in. Approval time is up to the authorities, listed at about 48 hours for a tourist visa and not guaranteed. Family visits wait first for your sponsor.'],
  ['What if the application is refused?', 'The agent cannot promise an outcome. What it does is catch the avoidable mistakes before filing: a photo that is too dark, names that do not match, a ticket that falls outside the window. If there is a refusal, the portal’s reason is shown to you in plain words.'],
  ['Can I do some of it myself?', 'Yes. Take control of the browser at any point and click through the portal yourself, then hand it back. You can also pause the agent or stop it completely.'],
  ['Will this work for real filings?', 'Production needs a licensed UAE sponsor partner (an airline, hotel, licensed agency or resident), a legal review, and a maintained rules service. Until then this is a demo of the experience.'],
];

function Section({ id, className = '', children }: { id?: string; className?: string; children: React.ReactNode }) {
  return (
    <section id={id} className={`scroll-mt-16 ${className}`}>
      <div className="mx-auto max-w-[1280px] px-6">{children}</div>
    </section>
  );
}

function H2({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <h2 className={`font-display text-[32px] font-bold leading-[1.04] tracking-[-0.035em] balance md:text-[40px] lg:text-[46px] ${className}`}>{children}</h2>;
}

export function Landing({ onApply }: { onApply: () => void }) {
  const { theme, toggle } = useTheme();

  return (
    <div className="min-h-full bg-bg text-fg">
      <div className="border-b border-line bg-surface2 px-6 py-1.5 text-center text-[12.5px] text-muted">A working demo. It files into a sandbox portal, not a government system.</div>

      <header className="sticky z-30 border-b border-line bg-bg/90 backdrop-blur" style={{ top: 'env(safe-area-inset-top, 0px)' }}>
        <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-4 px-6 py-3">
          <a href="#top" aria-label="Rihla" onClick={(e) => e.preventDefault()}>
            <Wordmark />
          </a>
          <nav aria-label="Sections" className="hidden items-center gap-1 md:flex">
            {NAV.map(([id, label]) => (
              <button key={id} type="button" className="btn btn-ghost btn-sm" onClick={() => jump(id)}>
                {label}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <button type="button" className="btn btn-ghost btn-sm !px-2.5" onClick={toggle} aria-label={theme === 'dark' ? 'Switch to the light theme' : 'Switch to the dark theme'}>
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={onApply}>
              <span>
                Start<span className="hidden sm:inline"> your application</span>
              </span>
            </button>
          </div>
        </div>
      </header>

      <main id="top">
        {/* hero */}
        <Section className="pb-20 pt-12 lg:pt-20">
          <div className="grid items-center gap-12 xl:grid-cols-[minmax(0,1fr)_minmax(0,640px)]">
            <div className="min-w-0">
              <h1 className="font-display text-[44px] font-extrabold leading-[0.96] md:text-[60px] lg:text-[72px] tracking-[-0.045em] balance">
                Your UAE visa,
                <br />
                <span className="text-brand">filed for you.</span>
              </h1>
              <p className="mt-6 max-w-[52ch] text-[18px] leading-relaxed text-muted pretty">
                Upload your documents once. An agent opens the portal, fills in every field and checks its own work. It stops only when something is yours to do: a code, a declaration, a signature, the payment. You do it on screen, and it carries on.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <button type="button" className="btn btn-primary btn-lg" onClick={onApply}>
                  Start your application <ArrowRight size={18} aria-hidden />
                </button>
                <button type="button" className="btn btn-outline btn-lg" onClick={() => jump('how')}>
                  See how it works
                </button>
              </div>
              <dl className="mt-10 grid max-w-[520px] grid-cols-3 gap-4 border-t border-line pt-5">
                {[
                  ['5', 'documents, uploaded once'],
                  ['4', 'moments that need you'],
                  ['0', 'card numbers the agent sees'],
                ].map(([n, l]) => (
                  <div key={l}>
                    <dt className="font-display text-[34px] font-bold leading-none tracking-[-0.03em] tnum">{n}</dt>
                    <dd className="mt-1.5 text-[13px] leading-snug text-muted">{l}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="min-w-0 max-w-[720px] xl:max-w-none">
              <HeroPreview />
            </div>
          </div>
        </Section>

        {/* do I need one */}
        <Section id="check" className="border-y border-line bg-surface py-20">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-start">
            <div>
              <H2>First, do you even need a visa?</H2>
              <p className="mt-4 max-w-[46ch] text-[16.5px] leading-relaxed text-muted pretty">Many passports get in free on arrival, and some only need a visa without a residence permit from another country. Pick yours. If you do not need to file, we will say so, and you save the fee.</p>
            </div>
            <Checker onApply={onApply} />
          </div>
        </Section>

        {/* how it works */}
        <Section id="how" className="py-24">
          <div className="max-w-[640px]">
            <H2>Upload once. Then handle only what only you can.</H2>
          </div>
          <ol className="relative mt-12 grid gap-10 lg:grid-cols-4 lg:gap-6">
            <span className="absolute bottom-5 left-[19px] top-5 border-l-2 border-dashed lg:hidden" style={{ borderColor: 'var(--line-strong)' }} aria-hidden />
            <span className="absolute left-5 top-[19px] hidden w-[calc(75%-14px)] border-t-2 border-dashed lg:block" style={{ borderColor: 'var(--line-strong)' }} aria-hidden />
            {STEPS.map((s, i) => (
              <li key={s.title} className="relative flex gap-4 lg:block">
                <span className="relative grid size-10 shrink-0 place-items-center rounded-full border-2 border-brand bg-bg font-display text-[17px] font-bold text-brand">{i + 1}</span>
                <div className="min-w-0 lg:mt-5">
                  <h3 className="font-display text-[22px] font-semibold leading-tight tracking-[-0.02em]">{s.title}</h3>
                  <div className="mt-1 text-[13.5px] font-semibold text-brand">{s.who}</div>
                  <p className="mt-2 text-[15px] leading-relaxed text-muted pretty">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </Section>

        {/* your turn */}
        <Section className="border-t border-line bg-surface py-24">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
            <div className="lg:sticky lg:top-24 lg:self-start">
              <H2>Four things only you can do.</H2>
              <p className="mt-4 max-w-[44ch] text-[16.5px] leading-relaxed text-muted pretty">The agent does everything else. When it reaches one of these it pins a single card to the screen, tells you what it needs, and waits. You never have to guess what happens next, or watch a spinner and wonder.</p>
            </div>
            <ol className="ledger">
              {YOUR_TURN.map(({ icon: Icon, title, body }) => (
                <li key={title} className="flex gap-5 py-6 first:pt-0">
                  <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[var(--attn-wash)] text-attn">
                    <Icon size={22} aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-display text-[22px] font-semibold leading-tight tracking-[-0.02em]">{title}</h3>
                    <p className="mt-2 max-w-[56ch] text-[15px] leading-relaxed text-muted pretty">{body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </Section>

        {/* checks */}
        <Section className="py-24">
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]">
            <div className="w-full max-w-[540px]">
              <ChecksReport
                id="landing-checks"
                act={() => undefined}
                readonly
                props={{
                  passes: ['Passport is valid for 33 months after arrival', 'You will arrive within 60 days of the visa being issued', 'Insurance covers the whole stay', 'Your name matches across passport, ticket and insurance'],
                  issues: [
                    { title: 'The photo background is too dark', risk: 'medium' },
                    { title: 'Your arrival date shows up as two different days', risk: 'medium' },
                  ],
                }}
              />
            </div>
            <div>
              <H2>It checks its own work first.</H2>
              <p className="mt-4 max-w-[48ch] text-[16.5px] leading-relaxed text-muted pretty">Most refusals are small, avoidable mistakes. So the agent looks for them before anything is filed, and again after.</p>
              <ul className="mt-6 grid gap-3 text-[15px] text-fg">
                {[
                  'Passport valid long enough, names the same on every document.',
                  'Photo measured on the pixels: shape, background and file size, on your own device.',
                  'Arrival and stay dates that fit the visa window.',
                  'After filing, it reads the review page back and compares every field with what you approved.',
                ].map((t) => (
                  <li key={t} className="flex gap-3">
                    <Eye size={18} className="mt-[3px] shrink-0 text-brand" aria-hidden />
                    <span className="pretty">{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Section>

        {/* pricing */}
        <Section id="pricing" className="border-t border-line bg-surface py-24">
          <div className="max-w-[640px]">
            <H2>One price, shown before you start.</H2>
            <p className="mt-4 text-[16.5px] leading-relaxed text-muted pretty">The government fee, our flat service fee and VAT, added up. No surprises on the last page.</p>
          </div>
          <div className="mt-10">
            <Pricing onApply={onApply} />
          </div>
        </Section>

        {/* trust */}
        <section id="trust" className="scroll-mt-16 bg-[var(--band)] py-24 text-[var(--on-band)]">
          <div className="mx-auto max-w-[1280px] px-6">
            <div className="grid gap-12 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]">
              <div>
                <H2>What the agent will never do.</H2>
                <p className="mt-4 max-w-[48ch] text-[16.5px] leading-relaxed text-[var(--on-band-muted)] pretty">A fast agent is only useful if it knows where to stop.</p>
                <ul className="mt-8">
                  {NEVER.map(([t, d]) => (
                    <li key={t} className="flex gap-4 border-t py-4" style={{ borderColor: 'var(--band-line)' }}>
                      <Ban size={20} className="mt-0.5 shrink-0 text-[var(--band-accent)]" aria-hidden />
                      <div className="min-w-0">
                        <div className="font-display text-[19px] font-semibold tracking-[-0.01em]">Never {t.charAt(0).toLowerCase() + t.slice(1)}</div>
                        <p className="mt-0.5 max-w-[52ch] text-[14.5px] leading-relaxed text-[var(--on-band-muted)]">{d}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
              <aside className="self-start rounded-[22px] border p-6" style={{ borderColor: 'var(--band-line)' }}>
                <ShieldCheck size={24} className="text-[var(--band-accent)]" aria-hidden />
                <h3 className="mt-3 font-display text-[24px] font-semibold leading-tight tracking-[-0.02em]">Straight talk about this demo</h3>
                <p className="mt-3 text-[14.5px] leading-relaxed text-[var(--on-band-muted)]">The portal in this demo is a sandbox. It looks plain on purpose and is labelled as one. Nothing you do here is filed with, or known to, any government.</p>
                <p className="mt-3 text-[14.5px] leading-relaxed text-[var(--on-band-muted)]">Real filings would go through a licensed UAE sponsor partner, with a legal review and a rules service a person keeps current. Fees and entry rules shown here were compiled from public sources on {RULES_REVIEWED}.</p>
                <ul className="mt-4 grid gap-1.5 font-mono text-[12.5px] text-[var(--on-band-muted)]">
                  {SOURCES.map((s) => (
                    <li key={s.domain}>
                      {s.domain} <span className="opacity-70">· {s.label.split(':')[0]}</span>
                    </li>
                  ))}
                </ul>
              </aside>
            </div>
          </div>
        </section>

        {/* faq */}
        <Section id="faq" className="py-24">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)]">
            <div>
              <H2>Fair things to ask.</H2>
            </div>
            <div className="ledger border-y border-line">
              {FAQ.map(([q, a]) => (
                <details key={q} className="group py-1">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-lg py-4 text-[17px] font-medium text-fg [&::-webkit-details-marker]:hidden">
                    <span className="min-w-0">{q}</span>
                    <Plus size={18} className="shrink-0 text-faint transition-transform duration-200 group-open:rotate-45" aria-hidden />
                  </summary>
                  <p className="max-w-[62ch] pb-5 text-[15px] leading-relaxed text-muted pretty">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </Section>

        {/* closing */}
        <Section className="pb-24">
          <div className="ticket">
            <div className="ticket-body flex flex-col items-start justify-between gap-6 px-8 py-10 md:flex-row md:items-center" style={{ ['--y' as string]: '50%' }}>
              <div className="min-w-0">
                <h2 className="font-display text-[32px] font-bold leading-[1.04] tracking-[-0.035em] balance md:text-[40px] lg:text-[44px]">Ready when your documents are.</h2>
                <p className="mt-3 max-w-[48ch] text-[16px] text-muted pretty">It takes a few minutes to upload. The agent does the rest, and tells you the moment it needs you.</p>
              </div>
              <button type="button" className="btn btn-primary btn-lg shrink-0" onClick={onApply}>
                Start your application <ArrowRight size={18} aria-hidden />
              </button>
            </div>
          </div>
        </Section>
      </main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-start justify-between gap-8 px-6 py-10">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <Wordmark />
              <span lang="ar" className="font-arabic text-[20px] text-faint">
                رحلة
              </span>
            </div>
            <p className="mt-3 max-w-[56ch] text-[13px] leading-relaxed text-faint">Rihla means journey. This is a demo and is not affiliated with any government. Entry rules and fees were compiled from public sources on {RULES_REVIEWED} and must be verified before you rely on them.</p>
          </div>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => jump('top')}>
            Back to top
          </button>
        </div>
      </footer>
    </div>
  );
}
