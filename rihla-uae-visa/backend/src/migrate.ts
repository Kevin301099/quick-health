import { loadConfig } from './config';
import { migrate, openDb } from './db';

/** Applies pending migrations once, from the deploy step. Pair with MIGRATE_ON_BOOT=false on the API. */
const config = loadConfig();
if (!config.DATABASE_URL) throw new Error('Set DATABASE_URL to the database to migrate.');
const db = await openDb({ ...config, MIGRATE_ON_BOOT: false });
const ran = await migrate(db);
console.log(ran.length ? `Applied ${ran.join(', ')}` : 'Database is up to date.');
await db.close();
