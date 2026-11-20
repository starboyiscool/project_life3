import type Dexie from 'dexie';
import { openAppDb } from './db/database';

/** The app's single database connection. Set by initDb() before the UI mounts. */
export let db: Dexie;
export let migratedFrom: number | null = null;

export async function initDb(): Promise<Dexie> {
  const r = await openAppDb();
  db = r.db;
  migratedFrom = r.migratedFrom;
  db.on('versionchange', () => {
    // another tab opened a newer version: close so it can upgrade, then reload
    db.close();
    location.reload();
  });
  return db;
}

/** Kept for code written before initDb existed. */
export async function getDb(): Promise<Dexie> {
  return db;
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const row = (await db.table('meta').get(key)) as { key: string; value: T } | undefined;
  return row?.value;
}

export async function setMeta<T>(key: string, value: T): Promise<void> {
  await db.table('meta').put({ key, value });
}
