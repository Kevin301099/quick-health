import type { FlowCtx } from './engine';
import { useStore } from './store';
import { PRODUCTS, SLOTS } from '@/domain/visas';
import { aed } from '@/lib/utils';

export const SUGGESTIONS = ['What do I need to do next?', 'How much will I pay?', 'Is my card safe?', 'How long will it take?'];

const has = (t: string, ...w: string[]) => w.some((x) => t.includes(x));

/** Free-form questions, answered locally from what the agent already knows. */
export async function answer(ctx: FlowCtx, text: string): Promise<void> {
  const t = text.toLowerCase();
  const s = useStore.getState();
  const { answers } = s;

  if (has(t, 'card', 'safe', 'secure', 'privacy', 'data')) {
    await ctx.say('Your card stays yours. Here is exactly how payment works.');
    await ctx.render(
      'InfoCard',
      {
        title: 'Your card is never seen by the agent',
        tone: 'ok',
        bullets: [
          'Payment happens inside the portal, on the right. You type the card details yourself.',
          'The agent is stopped while you do it. It reads nothing from the payment form.',
          'Your bank sends you its own code, which only you enter.',
          'Rihla stores no card details, in this demo or in production.',
        ],
        footnote: 'In production the payment page is the official gateway, opened in your own session.',
      },
      { gen: 350 },
    );
    return;
  }

  if (has(t, 'fee', 'cost', 'price', 'how much', 'pay', 'total')) {
    await ctx.say('Here is the full price. The government fee is paid straight to the government.');
    await ctx.render('FeeBreakdown', { visa: answers.visa, days: answers.days }, { gen: 350 });
    return;
  }

  if (has(t, 'how long', 'time', 'when', 'fast', 'quick', 'wait')) {
    await ctx.say('The service lists 48 hours for a decision, and says that is not a guarantee. The portal in this demo decides in a few seconds so you can see the whole journey.');
    return;
  }

  if (has(t, 'document', 'upload', 'file', 'need')) {
    const slots = PRODUCTS[answers.visa].slots;
    await ctx.say(`For this visa I use ${slots.length} documents.`);
    await ctx.render(
      'Checklist',
      { title: 'Your documents', items: slots.map((sl) => ({ label: SLOTS[sl].label, note: s.files[sl] ? s.files[sl]!.name : 'Missing' })) },
      { gen: 300 },
    );
    return;
  }

  if (has(t, 'next', 'status', 'where', 'progress', 'what now', 'do')) {
    const waiting = s.pending[0];
    const cur = s.phases.find((p) => p.status === 'running' || p.status === 'needs_you');
    await ctx.say(
      s.run.state === 'idle'
        ? 'I have not started yet. Press Start filing and I will work through your documents.'
        : waiting
          ? `I am waiting for you: ${waiting.title.toLowerCase()}. It is pinned at the bottom of this panel.`
          : s.run.state === 'done'
            ? 'All done. Your entry permit is above.'
            : `I am on "${(cur?.title ?? 'the next step').toLowerCase()}". I will tell you the moment I need you.`,
    );
    return;
  }

  await ctx.say('I can answer questions about this application: what you need to do next, the price, how long it takes, which documents I used, or how your card is kept safe.');
}
