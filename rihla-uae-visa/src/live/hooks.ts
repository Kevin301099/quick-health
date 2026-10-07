import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError, getIfChanged, session, type LiveApplication, type LiveConfig } from './api';

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
const FIRST_WAIT = 3000;

/**
 * Loads one application and keeps it fresh while it is moving through filing. Polls quickly right after a change,
 * then backs off (up to a minute, or two while waiting on the traveller), pauses while the tab is hidden, and asks
 * the API for changes only, so an unchanged poll is an empty response.
 */
export function useApplication(id: string, keepPolling?: (a: LiveApplication) => boolean) {
  const [app, setApp] = useState<LiveApplication | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const timer = useRef<number | null>(null);
  const etag = useRef<string | null>(null);
  const latest = useRef<LiveApplication | null>(null);
  const keep = useRef(keepPolling);
  keep.current = keepPolling;

  const fetchApp = useCallback(async (): Promise<{ app: LiveApplication | null; changed: boolean }> => {
    try {
      const r = await getIfChanged<{ application: LiveApplication }>(`/v1/applications/${id}`, latest.current ? etag.current : null);
      setError(null);
      if (!r.changed) return { app: latest.current, changed: false };
      etag.current = r.etag;
      latest.current = r.data.application;
      setApp(r.data.application);
      return { app: r.data.application, changed: true };
    } catch (e) {
      setError(e as ApiError);
      return { app: latest.current, changed: false };
    }
  }, [id]);

  useEffect(() => {
    let alive = true;
    let wait = FIRST_WAIT;
    const stop = () => {
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = null;
    };
    const loop = async () => {
      stop();
      if (document.hidden) return; // picks up again when the tab is visible
      const { app: a, changed } = await fetchApp();
      if (!alive || !a) return;
      const moving = MOVING.has(a.status) || !!keep.current?.(a);
      if (!moving && a.status !== 'needs_info') return; // nothing will change without the traveller
      wait = changed ? FIRST_WAIT : Math.min(wait * 1.6, moving ? 60_000 : 120_000);
      timer.current = window.setTimeout(loop, wait);
    };
    const onVisible = () => {
      if (document.hidden || !alive) return;
      wait = FIRST_WAIT;
      void loop();
    };
    document.addEventListener('visibilitychange', onVisible);
    void loop();
    return () => {
      alive = false;
      stop();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [fetchApp]);

  // Local edits (uploads, saves) replace the copy here; the next poll fetches in full because the tag changed.
  const set = useCallback((a: LiveApplication | ((prev: LiveApplication | null) => LiveApplication | null)) => {
    setApp((prev) => {
      const next = typeof a === 'function' ? a(prev) : a;
      latest.current = next;
      return next;
    });
  }, []);

  const reload = useCallback(async () => (await fetchApp()).app, [fetchApp]);

  return { app, setApp: set, error, reload };
}
