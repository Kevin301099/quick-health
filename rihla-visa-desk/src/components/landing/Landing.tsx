import { motion } from 'motion/react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/lib/theme';
import { Wordmark } from '../ui';
import { Hero } from './Hero';
import { Autonomy, Closing, Faq, Generative, Loop, Pricing, Routes, Trust } from './sections';

const LINKS = [
  ['Routes', '#routes'],
  ['How it works', '#how'],
  ['Control', '#control'],
  ['Pricing', '#pricing'],
  ['Questions', '#faq'],
] as const;

function Nav({ onOpenDemo, onContact }: { onOpenDemo: () => void; onContact: () => void }) {
  const { theme, toggle } = useTheme();
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-[color-mix(in_srgb,var(--bg)_92%,transparent)] backdrop-blur-md" style={{ top: 'env(safe-area-inset-top, 0px)' }}>
      <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-4 px-6 py-3">
        <a href="#top" className="rounded-lg" aria-label="Rihla, back to the top">
          <Wordmark />
        </a>
        <nav className="hidden items-center gap-7 lg:flex" aria-label="Sections">
          {LINKS.map(([l, h]) => (
            <a key={h} href={h} className="text-[14px] text-muted transition-colors hover:text-fg">
              {l}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <button type="button" className="btn btn-ghost btn-sm !px-2.5" onClick={toggle} aria-label={theme === 'dark' ? 'Switch to the light theme' : 'Switch to the dark theme'}>
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button type="button" className="btn btn-outline btn-sm hidden sm:inline-flex" onClick={onContact}>
            Book a pilot
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={onOpenDemo}>
            Open the demo
          </button>
        </div>
      </div>
    </header>
  );
}

export function Landing({ onOpenDemo }: { onOpenDemo: () => void }) {
  const contact = () => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  return (
    <div id="top" className="min-h-full bg-bg">
      <Nav onOpenDemo={onOpenDemo} onContact={contact} />
      <main>
        <Hero onOpenDemo={onOpenDemo} onContact={contact} />
        <Routes />
        <Loop />
        <Generative />
        <Autonomy />
        <Trust />
        <Pricing onContact={contact} />
        <Faq />
        <Closing onOpenDemo={onOpenDemo} />
      </main>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-4 px-6 py-8">
          <Wordmark />
          <p className="max-w-[60ch] text-[12.5px] text-faint">
            Working name. This build uses fictional people, sandbox submissions and demo rule packs reviewed on 2 October 2026. Not legal advice.
          </p>
          <motion.a href="#top" className="text-[13px] text-muted hover:text-fg" whileHover={{ y: -2 }}>
            Back to the top
          </motion.a>
        </div>
      </footer>
    </div>
  );
}
