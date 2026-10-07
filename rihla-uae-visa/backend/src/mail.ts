import type { Config } from './config';

/*
  Email is the one channel every applicant has. Resend is cheap and simple; the console driver prints
  messages during development (and tests read them back from `outbox`).
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
