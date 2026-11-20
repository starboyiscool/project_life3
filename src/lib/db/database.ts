import Dexie from 'dexie';
import { latestVersion, migrations as defaultMigrations, type Migration } from './migrations';
import { SnapshotStore } from './snapshots';
import { dumpDb } from '../backup';

export const DB_NAME = 'life-tracker';

export class NewerSchemaError extends Error {
  constructor(
    public stored: number,
    public supported: number,
  ) {
    super(
      `Данные созданы более новой версией приложения (схема ${stored}, поддерживается ${supported}). ` +
        'Обновите приложение; данные не тронуты.',
    );
    this.name = 'NewerSchemaError';
  }
}

/** Builds a Dexie instance with the given schema history (does not open it). */
export function createDb(name: string, migrations: Migration[] = defaultMigrations): Dexie {
  const db = new Dexie(name);
  for (const m of [...migrations].sort((a, b) => a.version - b.version)) {
    const v = db.version(m.version).stores(m.stores);
    if (m.upgrade) v.upgrade(m.upgrade);
  }
  return db;
}

/** Version of an existing database, or 0 if it does not exist. Does not modify anything. */
export async function storedVersion(name: string): Promise<number> {
  if (!(await Dexie.exists(name))) return 0;
  const probe = new Dexie(name);
  try {
    await probe.open(); // dynamic mode: opens at whatever version is on disk
    return probe.verno;
  } finally {
    probe.close();
  }
}

export interface OpenOptions {
  name?: string;
  migrations?: Migration[];
  snapshots?: SnapshotStore;
}

export interface OpenResult {
  db: Dexie;
  migratedFrom: number | null;
}

/**
 * Opens the app database. If the stored schema is older than the code's schema,
 * saves a full snapshot first, then lets Dexie run the migrations.
 */
export async function openAppDb(opts: OpenOptions = {}): Promise<OpenResult> {
  const name = opts.name ?? DB_NAME;
  const migrations = opts.migrations ?? defaultMigrations;
  const target = latestVersion(migrations);
  const current = await storedVersion(name);

  if (current > target) throw new NewerSchemaError(current, target);

  let migratedFrom: number | null = null;
  if (current > 0 && current < target) {
    const probe = new Dexie(name);
    await probe.open();
    try {
      const backup = await dumpDb(probe);
      const store = opts.snapshots ?? new SnapshotStore();
      await store.save({
        createdAt: new Date().toISOString(),
        reason: 'pre-migration',
        note: `Перед миграцией схемы ${current} → ${target}`,
        backup,
      });
    } finally {
      probe.close();
    }
    migratedFrom = current;
  }

  const db = createDb(name, migrations);
  await db.open();
  return { db, migratedFrom };
}
