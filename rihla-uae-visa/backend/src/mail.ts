import { AwsClient } from 'aws4fetch';
import type { Config } from './config';

/*
  Email is the one channel every applicant has.
  - ses: Amazon SES, billed per message (about $0.10 per 1,000) with no monthly plan. On Lambda it uses the
    function's own role, so there is no key to manage.
  - resend: the simplest to set up; its free tier is small and paid use is a monthly plan.
  - console: prints messages during development (and tests read them back from `outbox`).
*/

export interface Mail {
  to: string;
  subject: string;
  text: string;
}

export interface Mailer {
  send(m: Mail): Promise<void>;
  /** Messages sent through the console driver, newest last. Empty for real drivers. */
  outbox: Mail[];
}

export function createMailer(c: Config): Mailer {
  if (c.MAIL_DRIVER === 'ses') {
    const region = c.SES_REGION || c.AWS_REGION;
    const own = !!c.SES_ACCESS_KEY_ID;
    const aws = new AwsClient({
      accessKeyId: own ? c.SES_ACCESS_KEY_ID : c.AWS_ACCESS_KEY_ID,
      secretAccessKey: own ? c.SES_SECRET_ACCESS_KEY : c.AWS_SECRET_ACCESS_KEY,
      sessionToken: own ? undefined : c.AWS_SESSION_TOKEN || undefined,
      service: 'ses',
      region,
      retries: 2,
    });
    return {
      outbox: [],
      async send(m) {
        const r = await aws.fetch(`https://email.${region}.amazonaws.com/v2/email/outbound-emails`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            FromEmailAddress: c.MAIL_FROM,
            Destination: { ToAddresses: [m.to] },
            Content: { Simple: { Subject: { Data: m.subject, Charset: 'UTF-8' }, Body: { Text: { Data: m.text, Charset: 'UTF-8' } } } },
          }),
        });
        if (!r.ok) throw new Error(`Email failed: ${r.status} ${await r.text()}`);
      },
    };
  }
  if (c.MAIL_DRIVER === 'resend') {
    return {
      outbox: [],
      async send(m) {
        const r = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { authorization: `Bearer ${c.RESEND_API_KEY}`, 'content-type': 'application/json' },
          body: JSON.stringify({ from: c.MAIL_FROM, to: [m.to], subject: m.subject, text: m.text }),
        });
        if (!r.ok) throw new Error(`Email failed: ${r.status} ${await r.text()}`);
      },
    };
  }
  const outbox: Mail[] = [];
  return {
    outbox,
    async send(m) {
      outbox.push(m);
      if (c.NODE_ENV !== 'test') console.log(`\n[mail] to ${m.to}: ${m.subject}\n${m.text}\n`);
    },
  };
}

export const templates = {
  loginCode: (code: string) => ({
    subject: `${code} is your Rihla sign-in code`,
    text: `Your sign-in code is ${code}. It works for 10 minutes.\n\nIf you did not ask for it, you can ignore this email.`,
  }),
  needsYou: (appUrl: string, message: string) => ({
    subject: 'Your visa application needs you',
    text: `${message}\n\nOpen your application: ${appUrl}`,
  }),
  approved: (appUrl: string, name: string) => ({
    subject: 'Your UAE visa is ready',
    text: `Good news, ${name}. Your UAE visa has been issued.\n\nDownload it here: ${appUrl}\n\nCarry a printed or saved copy when you travel.`,
  }),
  rejected: (appUrl: string, message: string) => ({
    subject: 'Update on your UAE visa application',
    text: `The application was not approved.${message ? `\n\nReason given: ${message}` : ''}\n\nSee the details and your options: ${appUrl}`,
  }),
  paid: (appUrl: string) => ({
    subject: 'Payment received. We are filing your visa',
    text: `Thank you. Your payment went through and your application is being filed now.\n\nFollow it here: ${appUrl}`,
  }),
};
