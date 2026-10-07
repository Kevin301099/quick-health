import { randomUUID } from 'node:crypto';
import Stripe from 'stripe';
import type { Config } from './config';

/*
  Payment is the last thing a person does. We hand them to a hosted checkout page (the card never touches
  our servers), then learn the result from a signed webhook, never from the browser redirect alone.
*/

export interface Quote {
  currency: 'AED';
  days: 30 | 60;
  govFee: number;
  serviceFee: number;
  vat: number;
  total: number;
}

export function quoteFor(c: Config, days: 30 | 60): Quote {
  const govFee = days === 60 ? c.GOV_FEE_TOURIST_60 : c.GOV_FEE_TOURIST_30;
  const serviceFee = c.SERVICE_FEE;
  const vat = Math.round((govFee + serviceFee) * c.VAT_RATE * 100) / 100;
  return { currency: 'AED', days, govFee, serviceFee, vat, total: Math.round((govFee + serviceFee + vat) * 100) / 100 };
}

export interface CheckoutInput {
  applicationId: string;
  email: string;
  quote: Quote;
  successUrl: string;
  cancelUrl: string;
}

export type WebhookResult = { eventId: string; kind: 'paid'; applicationId: string; sessionId: string; amount: number } | { eventId: string; kind: 'ignored' };

export interface Payments {
  driver: 'fake' | 'stripe';
  createCheckout(i: CheckoutInput): Promise<{ sessionId: string; url: string }>;
  parseWebhook(rawBody: string, signature: string | undefined): Promise<WebhookResult>;
  refund(sessionId: string): Promise<void>;
}

const fils = (aed: number) => Math.round(aed * 100);

export function createPayments(c: Config): Payments {
  if (c.PAYMENTS_DRIVER === 'stripe') return stripePayments(c);
  return {
    driver: 'fake',
    async createCheckout(i) {
      const sessionId = `fake_${randomUUID()}`;
      const q = new URLSearchParams({ app: i.applicationId, ok: i.successUrl, cancel: i.cancelUrl, total: String(i.quote.total) });
      return { sessionId, url: `${c.API_URL}/v1/dev/checkout/${sessionId}?${q}` };
    },
    async parseWebhook() {
      throw new Error('The fake driver has no webhooks');
    },
    async refund() {
      /* nothing to refund */
    },
  };
}

function stripePayments(c: Config): Payments {
  const stripe = new Stripe(c.STRIPE_SECRET_KEY);
  return {
    driver: 'stripe',
    async createCheckout(i) {
      const q = i.quote;
      const line = (name: string, amount: number) => ({ quantity: 1, price_data: { currency: 'aed', unit_amount: fils(amount), product_data: { name } } });
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        customer_email: i.email,
        client_reference_id: i.applicationId,
        metadata: { applicationId: i.applicationId },
        payment_intent_data: { metadata: { applicationId: i.applicationId } },
        line_items: [line(`UAE tourist visa, ${q.days} days (government fee)`, q.govFee), line('Rihla filing service', q.serviceFee), line('VAT 5%', q.vat)],
        success_url: i.successUrl,
        cancel_url: i.cancelUrl,
        expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
      });
      if (!session.url) throw new Error('Stripe returned no checkout URL');
      return { sessionId: session.id, url: session.url };
    },
    async parseWebhook(rawBody, signature) {
      if (!signature) throw new Error('Missing Stripe signature');
      const event = await stripe.webhooks.constructEventAsync(rawBody, signature, c.STRIPE_WEBHOOK_SECRET);
      if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
        const s = event.data.object;
        if (s.payment_status === 'paid' && s.client_reference_id) {
          return { eventId: event.id, kind: 'paid', applicationId: s.client_reference_id, sessionId: s.id, amount: (s.amount_total ?? 0) / 100 };
        }
      }
      return { eventId: event.id, kind: 'ignored' };
    },
    async refund(sessionId) {
      const s = await stripe.checkout.sessions.retrieve(sessionId);
      const pi = typeof s.payment_intent === 'string' ? s.payment_intent : s.payment_intent?.id;
      if (pi) await stripe.refunds.create({ payment_intent: pi });
    },
  };
}
