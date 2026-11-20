export const STORAGE_TARGET_BYTES = 300 * 1024 * 1024;
export const STORAGE_WARNING_BYTES = STORAGE_TARGET_BYTES * 0.8;
export const importFileWithinLimit = (size: number) => size <= STORAGE_TARGET_BYTES;

export type PersistState = 'persisted' | 'not-persisted' | 'unsupported';

/**
 * Asks the browser not to evict our IndexedDB under storage pressure.
 * Chrome on Android usually grants this for installed PWAs.
 */
export async function requestPersistence(): Promise<PersistState> {
  if (!navigator.storage?.persist) return 'unsupported';
  if (await navigator.storage.persisted()) return 'persisted';
  return (await navigator.storage.persist()) ? 'persisted' : 'not-persisted';
}

export async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  if (!navigator.storage?.estimate) return null;
  const { usage = 0, quota = 0 } = await navigator.storage.estimate();
  return { usage, quota };
}
