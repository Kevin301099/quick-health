import type { Deps } from './deps';
import { applyUpdate, logEvent, submitToProvider, UNFILED, type AppRow } from './applications';

/*
  Background work: retry filings that failed at payment time, ask an automatic partner for news, and delete
  old documents. Run in-process, by a scheduler invoking the Lambda function, or by a cron hitting /internal/tick.
  Filing itself happens the moment payment lands, so this can run rarely: every 10 minutes with a partner API,
  hourly with manual filing. Each step is idempotent, so overlapping or repeated runs are harmless.
*/

export async function tick(d: Deps) {
  const out = { submitted: 0, polled: 0, purged: 0, errors: 0 };

  // 1. File anything paid for that did not get filed at payment time.
  const paid = await d.db.query<AppRow>(`SELECT * FROM applications WHERE ${UNFILED} ORDER BY paid_at LIMIT 20`);
  for (const a of paid) {
    try {
      await submitToProvider(d, a);
      out.submitted++;
    } catch (e) {
      out.errors++;
      console.error('[tick] submit failed', a.id, e);
      await logEvent(d, a.id, 'system', 'filing_error', { message: String(e).slice(0, 300) });
    }
  }

  // 2. Ask automatic providers how filed applications are doing.
  if (d.provider.automatic && d.provider.poll) {
    const open = await d.db.query<AppRow>(`SELECT * FROM applications WHERE status IN ('submitted', 'processing') AND provider_ref IS NOT NULL ORDER BY updated_at LIMIT 50`);
    for (const a of open) {
      try {
        const u = await d.provider.poll(a.provider_ref!, a.submitted_at ?? a.updated_at);
        await applyUpdate(d, a, u, 'partner');
        out.polled++;
      } catch (e) {
        out.errors++;
        console.error('[tick] poll failed', a.id, e);
      }
    }
  }

  // 3. Delete documents we no longer need: decided applications after the retention window, drafts nobody
  //    finished within the same window, and free applications soon after the traveller submitted them.
  const old = await d.db.query<AppRow>(
    `SELECT * FROM applications WHERE purged_at IS NULL AND (
        (decided_at IS NOT NULL AND decided_at < now() - ($1 || ' days')::interval)
     OR (status IN ('draft', 'ready_to_pay') AND updated_at < now() - ($1 || ' days')::interval)
     OR (status = 'self_submitted' AND updated_at < now() - ($2 || ' days')::interval)
     ) LIMIT 50`,
    [String(d.config.RETENTION_DAYS), String(d.config.SELF_RETENTION_DAYS)],
  );
  for (const a of old) {
    const docs = await d.db.query<{ id: string; storage_key: string }>('SELECT id, storage_key FROM documents WHERE application_id = $1 AND deleted_at IS NULL', [a.id]);
    for (const doc of docs) {
      await d.storage.remove(doc.storage_key);
      await d.db.query('UPDATE documents SET deleted_at = now() WHERE id = $1', [doc.id]);
    }
    // Keep names for the receipt; drop identity numbers and contact details.
    const keep = { given: a.profile.given, surname: a.profile.surname, email: a.profile.email };
    await d.db.query(`UPDATE applications SET profile = $2::jsonb, photo_report = NULL, purged_at = now(), updated_at = now() WHERE id = $1`, [a.id, JSON.stringify(keep)]);
    await logEvent(d, a.id, 'system', 'purged', { documents: docs.length });
    out.purged++;
  }
  return out;
}
