import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import { createDb, NewerSchemaError, openAppDb, storedVersion } from '../src/lib/db/database';
import { SnapshotStore, MAX_SNAPSHOTS } from '../src/lib/db/snapshots';
import type { Migration } from '../src/lib/db/migrations';
import { migrations, SCHEMA_VERSION } from '../src/lib/db/migrations';
import { backupFileName, BackupError, dumpDb, importBackup, parseBackup } from '../src/lib/backup';

let n = 0;
const uid = (p: string) => `${p}-${++n}-${Math.random().toString(36).slice(2)}`;
const opened: Dexie[] = [];
const stores: SnapshotStore[] = [];

function snapStore() {
  const s = new SnapshotStore(uid('snap'));
  stores.push(s);
  return s;
}

afterEach(() => {
  opened.splice(0).forEach((d) => d.close());
  stores.splice(0).forEach((s) => s.close());
});

// A test schema history: v1 has `items` with `title`; v2 renames it to `name` and adds `notes`.
const v1: Migration = { version: 1, stores: { meta: 'key', items: '++id' } };
const v2: Migration = {
  version: 2,
  stores: { items: '++id, name', notes: '++id' },
  upgrade: (tx) =>
    tx
      .table('items')
      .toCollection()
      .modify((row: Record<string, unknown>) => {
        row.name = row.title;
        delete row.title;
      }),
};

describe('real schema', () => {
  it('opens a fresh database at the current schema version', async () => {
    const name = uid('app');
    const { db, migratedFrom } = await openAppDb({ name, snapshots: snapStore() });
    opened.push(db);
    expect(db.verno).toBe(SCHEMA_VERSION);
    expect(migratedFrom).toBeNull();
    expect(db.tables.map((t) => t.name)).toContain('meta');
  });

  it('migration versions are unique and start at 1', () => {
    const versions = migrations.map((m) => m.version);
    expect(new Set(versions).size).toBe(versions.length);
    expect(Math.min(...versions)).toBe(1);
  });
});

describe('migrations and snapshots', () => {
  it('migrates data and saves a pre-migration snapshot of the old data', async () => {
    const name = uid('app');
    const snaps = snapStore();

    const old = createDb(name, [v1]);
    await old.open();
    await old.table('items').add({ title: 'жим' });
    old.close();

    const { db, migratedFrom } = await openAppDb({ name, migrations: [v1, v2], snapshots: snaps });
    opened.push(db);
    expect(migratedFrom).toBe(1);
    expect(db.verno).toBe(2);
    const items = await db.table('items').toArray();
    expect(items).toEqual([{ id: 1, name: 'жим' }]);

    const list = await snaps.list();
    expect(list).toHaveLength(1);
    expect(list[0].reason).toBe('pre-migration');
    expect(list[0].backup.schemaVersion).toBe(1);
    expect(list[0].backup.tables.items).toEqual([{ id: 1, title: 'жим' }]);
  });

  it('does not snapshot when no migration is needed', async () => {
    const name = uid('app');
    const snaps = snapStore();
    const a = await openAppDb({ name, migrations: [v1], snapshots: snaps });
    a.db.close();
    const b = await openAppDb({ name, migrations: [v1], snapshots: snaps });
    opened.push(b.db);
    expect(b.migratedFrom).toBeNull();
    expect(await snaps.list()).toHaveLength(0);
  });

  it('refuses to open data from a newer schema and leaves it untouched', async () => {
    const name = uid('app');
    const newer = createDb(name, [v1, v2]);
    await newer.open();
    await newer.table('items').add({ name: 'x' });
    newer.close();

    await expect(openAppDb({ name, migrations: [v1], snapshots: snapStore() })).rejects.toBeInstanceOf(
      NewerSchemaError,
    );
    expect(await storedVersion(name)).toBe(2);
  });

  it('keeps only the newest snapshots', async () => {
    const snaps = snapStore();
    const backup = { app: 'life-tracker' as const, format: 1, schemaVersion: 1, exportedAt: '', tables: {} };
    for (let i = 0; i < MAX_SNAPSHOTS + 3; i++) {
      await snaps.save({
        createdAt: new Date(Date.UTC(2026, 10, 1, 0, i)).toISOString(),
        reason: 'pre-import',
        note: String(i),
        backup,
      });
    }
    const list = await snaps.list();
    expect(list).toHaveLength(MAX_SNAPSHOTS);
    expect(list[0].note).toBe(String(MAX_SNAPSHOTS + 2));
    expect(list.at(-1)!.note).toBe('3');
  });
});

describe('backup export/import', () => {
  it('round-trips all data and snapshots the replaced data', async () => {
    const snaps = snapStore();
    const src = createDb(uid('src'), [v1, v2]);
    await src.open();
    opened.push(src);
    await src.table('meta').put({ key: 'lastExportAt', value: '2026-11-08' });
    await src.table('items').bulkAdd([{ name: 'а' }, { name: 'б' }]);
    await src.table('notes').add({ text: 'заметка' });

    const text = JSON.stringify(await dumpDb(src));
    const backup = parseBackup(text, [v1, v2]);

    const dst = createDb(uid('dst'), [v1, v2]);
    await dst.open();
    opened.push(dst);
    await dst.table('items').add({ name: 'старое' });

    await importBackup(dst, backup, { migrations: [v1, v2], snapshots: snaps });

    expect(await dst.table('items').toArray()).toEqual(await src.table('items').toArray());
    expect(await dst.table('notes').toArray()).toEqual([{ id: 1, text: 'заметка' }]);
    expect(await dst.table('meta').get('lastExportAt')).toEqual({ key: 'lastExportAt', value: '2026-11-08' });

    const list = await snaps.list();
    expect(list[0].reason).toBe('pre-import');
    expect(list[0].backup.tables.items).toEqual([{ id: 1, name: 'старое' }]);
  });

  it('restores a snapshot while retaining a new snapshot of replaced data', async () => {
    const snaps = snapStore();
    const db = createDb(uid('restore'), [v1, v2]);
    await db.open(); opened.push(db);
    await db.table('items').add({ name: 'до' });
    const backup = await dumpDb(db);
    const snapshotId = await snaps.save({ createdAt: '2026-11-01T00:00:00.000Z', reason: 'pre-import', note: 'old', backup });
    await db.table('items').clear();
    await db.table('items').add({ name: 'после' });
    const stored = (await snaps.get(snapshotId))!;
    await importBackup(db, parseBackup(JSON.stringify(stored.backup), [v1, v2]), { migrations: [v1, v2], snapshots: snaps });
    expect((await db.table('items').toArray()).map((x) => x.name)).toEqual(['до']);
    const list = await snaps.list();
    expect(list[0].backup.tables.items.map((x: any) => x.name)).toEqual(['после']);
  });

  it('upgrades an older backup through the regular migrations', async () => {
    const old = createDb(uid('old'), [v1]);
    await old.open();
    opened.push(old);
    await old.table('items').add({ title: 'тяга' });
    const backup = parseBackup(JSON.stringify(await dumpDb(old)), [v1, v2]);
    expect(backup.schemaVersion).toBe(1);

    const dst = createDb(uid('dst'), [v1, v2]);
    await dst.open();
    opened.push(dst);
    await importBackup(dst, backup, { migrations: [v1, v2], snapshots: snapStore() });
    expect(await dst.table('items').toArray()).toEqual([{ id: 1, name: 'тяга' }]);
  });

  it('leaves data untouched when the import fails midway', async () => {
    const dst = createDb(uid('dst'), [v1, v2]);
    await dst.open();
    opened.push(dst);
    await dst.table('items').add({ name: 'живое' });

    // duplicate primary keys make bulkAdd fail inside the transaction
    const bad = parseBackup(
      JSON.stringify({
        app: 'life-tracker',
        format: 1,
        schemaVersion: 2,
        exportedAt: 'x',
        tables: { items: [{ id: 1, name: 'a' }, { id: 1, name: 'b' }] },
      }),
      [v1, v2],
    );
    await expect(importBackup(dst, bad, { migrations: [v1, v2], snapshots: snapStore() })).rejects.toThrow();
    expect(await dst.table('items').toArray()).toEqual([{ id: 1, name: 'живое' }]);
  });

  it('rejects unknown tables', async () => {
    const dst = createDb(uid('dst'), [v1]);
    await dst.open();
    opened.push(dst);
    const b = parseBackup(
      JSON.stringify({ app: 'life-tracker', format: 1, schemaVersion: 1, exportedAt: 'x', tables: { foo: [] } }),
      [v1],
    );
    await expect(importBackup(dst, b, { migrations: [v1], snapshots: snapStore() })).rejects.toBeInstanceOf(
      BackupError,
    );
  });

  it.each([
    ['not json', 'Файл не является корректным JSON.'],
    ['{"app":"other"}', 'Это не файл бэкапа Life Tracker.'],
    ['{"app":"life-tracker","format":1,"schemaVersion":99,"tables":{}}', 'более новой версией'],
    ['{"app":"life-tracker","format":1,"schemaVersion":1,"tables":{"meta":{}}}', 'повреждена'],
  ])('parseBackup rejects %s', (text, msg) => {
    expect(() => parseBackup(text, [v1])).toThrow(msg);
  });

  it('builds the file name in Novosibirsk time', () => {
    // 2026-11-08 20:30 UTC = 2026-11-09 03:30 in Novosibirsk (UTC+7)
    expect(backupFileName(new Date(Date.UTC(2026, 10, 8, 20, 30)))).toBe('life-tracker-2026-11-09_0330.json');
  });
});
