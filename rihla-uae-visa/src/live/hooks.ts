import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError, session, type LiveApplication, type LiveConfig } from './api';

export interface Me {
  id: string;
  email: string;
  ops: boolean;
}

/** Who is signed in. `undefined` while checking, `null` when signed out. */
export function useMe() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (!session.token) return setMe(null);
      try {
        const r = await api<{ user: Me }>('/v1/me');
        if (alive) setMe(r.user);
      } catch {
        if (alive) setMe(null);
      }
    };
    void load();
    window.addEventListener('rihla:session', load);
    return () => {
      alive = false;
      window.removeEventListener('rihla:session', load);
    };
  }, []);
  return me;
}

let configCache: Promise<LiveConfig> | null = null;

export function useLiveConfig() {
  const [config, setConfig] = useState<LiveConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    configCache ??= api<LiveConfig>('/v1/config');
    configCache.then(setConfig).catch((e: ApiError) => {
      configCache = null;
      setError(e.message);
    });
  }, []);
  return { config, error };
}

const MOVING = new Set(['paid', 'queued', 'submitted', 'processing']);

/** Loads one application and keeps it fresh while it is moving through filing. */
export function useApplication(id: string, keepPolling?: (a: LiveApplication) => boolean) {
  const [app, setApp] = useState<LiveApplication | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const timer = useRef<number | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api<{ application: LiveApplication }>(`/v1/applications/${id}`);
      setApp(r.application);
      setError(null);
      return r.application;
    } catch (e) {
      setError(e as ApiError);
      return null;
    }
  }, [id]);

  useEffect(() => {
    let alive = true;
    const loop = async () => {
      const a = await load();
      if (!alive) return;
      // Poll quickly while something is happening, slowly otherwise, and not at all once decided.
      const wait = a && (MOVING.has(a.status) || keepPolling?.(a)) ? 4000 : a && a.status === 'needs_info' ? 15000 : 0;
      if (wait) timer.current = window.setTimeout(loop, document.hidden ? wait * 4 : wait);
    };
    void loop();
    return () => {
      alive = false;
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [load]);

  return { app, setApp, error, reload: load };
}
