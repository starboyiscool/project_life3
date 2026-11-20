import { registerSW } from 'virtual:pwa-register';

export const pwa = $state({ needRefresh: false, offlineReady: false });

let updateSW: ((reload?: boolean) => Promise<void>) | null = null;

export function initPwa(): void {
  updateSW = registerSW({
    onNeedRefresh() {
      pwa.needRefresh = true;
    },
    onOfflineReady() {
      pwa.offlineReady = true;
    },
  });
}

export function applyUpdate(): void {
  void updateSW?.(true);
}
