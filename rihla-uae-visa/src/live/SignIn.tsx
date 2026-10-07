import { useState } from 'react';
import { ArrowRight, Mail } from 'lucide-react';
import { Spinner } from '@/components/ui';
import { api, ApiError, session } from './api';
import { ErrorNote, Label } from './chrome';

/** Email, then a six-digit code. No passwords to remember or leak. */
export function SignIn({ title = 'Sign in to save your application', note }: { title?: string; note?: string }) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('/v1/auth/code', { body: { email } });
      setSent(true);
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ token: string }>('/v1/auth/verify', { body: { email, code } });
      session.set(r.token);
    } catch (err) {
      setError((err as ApiError).message);
      setBusy(false);
    }
  };

  return (
    <div className="card p-6" style={{ boxShadow: 'var(--shadow-soft)' }}>
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-[var(--brand-wash)] text-brand">
          <Mail size={19} aria-hidden />
        </span>
        <h2 className="font-display text-[21px] font-semibold leading-tight tracking-[-0.02em]">{title}</h2>
      </div>
      <p className="mt-3 max-w-[52ch] text-[14px] text-muted pretty">{note ?? 'We email you a six-digit code. Your documents and progress are kept under this email, so you can come back on any device.'}</p>
      {!sent ? (
        <form className="mt-5 flex flex-wrap items-end gap-3" onSubmit={send}>
          <div className="min-w-[240px] flex-1">
            <Label htmlFor="signin-email">Email</Label>
            <input id="signin-email" type="email" autoComplete="email" required className="field" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <button type="submit" className="btn btn-primary" disabled={busy || !email}>
            {busy ? <Spinner /> : null} Email me a code
          </button>
        </form>
      ) : (
        <form className="mt-5" onSubmit={verify}>
          <Label htmlFor="signin-code" hint={`Sent to ${email}`}>
            Six-digit code
          </Label>
          <div className="flex flex-wrap items-center gap-3">
            <input
              id="signin-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              required
              className="field max-w-[200px] font-mono text-[20px] tracking-[0.3em]"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              autoFocus
            />
            <button type="submit" className="btn btn-primary" disabled={busy || code.length !== 6}>
              {busy ? <Spinner /> : null} Continue <ArrowRight size={15} aria-hidden />
            </button>
          </div>
          <p className="mt-3 text-[13px] text-faint">
            No email after a minute? Check spam, or{' '}
            <button type="button" className="font-medium text-brand underline-offset-2 hover:underline" onClick={() => void send()}>
              send a new code
            </button>
            .
          </p>
        </form>
      )}
      <ErrorNote>{error}</ErrorNote>
    </div>
  );
}
