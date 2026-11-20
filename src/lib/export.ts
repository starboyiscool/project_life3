import { backupFileName, dumpDb, type BackupFile } from './backup';
import { db, setMeta } from './app-db';

export function downloadJson(backup: BackupFile, name = backupFileName()): void {
  const blob = new Blob([JSON.stringify(backup, null, 1)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Full export to a JSON file; records lastExportAt for the weekly reminder. */
export async function exportAll(): Promise<void> {
  downloadJson(await dumpDb(db));
  await setMeta('lastExportAt', new Date().toISOString());
}
