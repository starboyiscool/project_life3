import Dexie, { type Table } from 'dexie';
import type { BackupFile } from '../backup';

/**
 * Automatic snapshots live in a separate IndexedDB database, so a failed migration
 * or a bad import of the main database cannot damage them.
 */
export interface Snapshot {
  id?: number;
  createdAt: string;
  reason: 'pre-migration' | 'pre-import';
  note: string;
  backup: BackupFile;
}

export const SNAPSHOT_DB_NAME = 'life-tracker-snapshots';
export const MAX_SNAPSHOTS = 10;

export class SnapshotStore {
  private db: Dexie & { snapshots: Table<Snapshot, number> };

  constructor(name = SNAPSHOT_DB_NAME) {
    this.db = new Dexie(name) as Dexie & { snapshots: Table<Snapshot, number> };
    this.db.version(1).stores({ snapshots: '++id, createdAt' });
  }

  async save(snapshot: Omit<Snapshot, 'id'>): Promise<number> {
    const id = await this.db.snapshots.add(snapshot as Snapshot);
    await this.prune();
    return id;
  }

  /** Newest first. */
  list(): Promise<Snapshot[]> {
    return this.db.snapshots.orderBy('createdAt').reverse().toArray();
  }

  get(id: number): Promise<Snapshot | undefined> {
    return this.db.snapshots.get(id);
  }

  close(): void {
    this.db.close();
  }

  private async prune(): Promise<void> {
    const count = await this.db.snapshots.count();
    if (count <= MAX_SNAPSHOTS) return;
    const old = await this.db.snapshots
      .orderBy('createdAt')
      .limit(count - MAX_SNAPSHOTS)
      .primaryKeys();
    await this.db.snapshots.bulkDelete(old);
  }
}
