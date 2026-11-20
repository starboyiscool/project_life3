import Dexie from 'dexie';
import { latestVersion, migrations as defaultMigrations, type Migration } from './db/migrations';
import { createDb } from './db/database';
import { SnapshotStore } from './db/snapshots';

export const BACKUP_APP_ID = 'life-tracker';
export const BACKUP_FORMAT = 1;

export interface BackupFile {
  app: typeof BACKUP_APP_ID;
  format: number;
  schemaVersion: number;
  exportedAt: string;
  tables: Record<string, unknown[]>;
}

export class BackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupError';
  }
}

/** Full dump of every table of an open database. */
export async function dumpDb(db: Dexie): Promise<BackupFile> {
  const tables: Record<string, unknown[]> = {};
  await db.transaction('r', db.tables, async () => {
    for (const t of db.tables) tables[t.name] = await t.toArray();
  });
  return {
    app: BACKUP_APP_ID,
    format: BACKUP_FORMAT,
    schemaVersion: db.verno,
    exportedAt: new Date().toISOString(),
    tables,
  };
}

/** Parses and validates a backup file. Throws BackupError with a user-facing message. */
export function parseBackup(text: string, migrations: Migration[] = defaultMigrations): BackupFile {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupError('Файл не является корректным JSON.');
  }
  if (!raw || typeof raw !== 'object') throw new BackupError('Пустой или повреждённый файл.');
  const b = raw as Partial<BackupFile>;
  if (b.app !== BACKUP_APP_ID) throw new BackupError('Это не файл бэкапа Life Tracker.');
  if (b.format !== BACKUP_FORMAT) throw new BackupError(`Неизвестный формат бэкапа: ${String(b.format)}.`);
  if (!Number.isInteger(b.schemaVersion) || (b.schemaVersion as number) < 1)
    throw new BackupError('В бэкапе нет корректной версии схемы.');
  const target = latestVersion(migrations);
  if ((b.schemaVersion as number) > target)
    throw new BackupError(
      `Бэкап сделан более новой версией приложения (схема ${b.schemaVersion}, поддерживается ${target}). Обновите приложение.`,
    );
  if (!b.tables || typeof b.tables !== 'object' || Array.isArray(b.tables))
    throw new BackupError('В бэкапе нет данных таблиц.');
  for (const [name, rows] of Object.entries(b.tables)) {
    if (!Array.isArray(rows)) throw new BackupError(`Таблица «${name}» повреждена.`);
  }
  return b as BackupFile;
}

/** Tables that exist after applying migrations up to `version`. */
function tablesAtVersion(migrations: Migration[], version: number): Set<string> {
  const set = new Set<string>();
  for (const m of [...migrations].sort((a, b) => a.version - b.version)) {
    if (m.version > version) break;
    for (const [name, spec] of Object.entries(m.stores)) {
      if (spec === null) set.delete(name);
      else set.add(name);
    }
  }
  return set;
}

/**
 * Brings an older backup up to the current schema by loading it into a temporary
 * database at its own version and letting the regular migrations run.
 */
async function upgradeBackup(backup: BackupFile, migrations: Migration[], tmpName: string): Promise<BackupFile> {
  await Dexie.delete(tmpName);
  const old = createDb(
    tmpName,
    migrations.filter((m) => m.version <= backup.schemaVersion),
  );
  await old.open();
  await fillTables(old, backup.tables);
  old.close();

  const upgraded = createDb(tmpName, migrations);
  await upgraded.open();
  try {
    return await dumpDb(upgraded);
  } finally {
    upgraded.close();
    await Dexie.delete(tmpName);
  }
}

async function fillTables(db: Dexie, tables: Record<string, unknown[]>): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    for (const t of db.tables) {
      await t.clear();
      const rows = tables[t.name];
      if (rows?.length) await t.bulkAdd(rows);
    }
  });
}

export interface ImportOptions {
  migrations?: Migration[];
  snapshots?: SnapshotStore;
}

/**
 * Replaces ALL data in `db` with the backup contents. Caller must confirm with the user first.
 * A snapshot of the current data is saved before anything is changed.
 * The replacement runs in a single transaction: on any error nothing is changed.
 */
export async function importBackup(db: Dexie, backup: BackupFile, opts: ImportOptions = {}): Promise<void> {
  const migrations = opts.migrations ?? defaultMigrations;

  const known = tablesAtVersion(migrations, backup.schemaVersion);
  const unknown = Object.keys(backup.tables).filter((n) => !known.has(n));
  if (unknown.length)
    throw new BackupError(`В бэкапе есть неизвестные таблицы: ${unknown.join(', ')}.`);

  const data =
    backup.schemaVersion < db.verno
      ? await upgradeBackup(backup, migrations, `${db.name}-import-tmp`)
      : backup;

  const store = opts.snapshots ?? new SnapshotStore();
  await store.save({
    createdAt: new Date().toISOString(),
    reason: 'pre-import',
    note: `Перед импортом бэкапа от ${backup.exportedAt}`,
    backup: await dumpDb(db),
  });

  await fillTables(db, data.tables);
}

export function backupFileName(date = new Date(), timeZone = 'Asia/Novosibirsk'): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  return `life-tracker-${get('year')}-${get('month')}-${get('day')}_${get('hour')}${get('minute')}.json`;
}
