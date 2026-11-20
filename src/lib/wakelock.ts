/**
 * Keeps the screen on while a workout is open (Wake Lock API). The browser drops the lock
 * when the page is hidden, so it is taken again on return. Returns a release function.
 */
export function keepAwake(): () => void {
  let lock: WakeLockSentinel | null = null;
  let active = true;

  async function take() {
    if (!active || document.visibilityState !== 'visible' || !('wakeLock' in navigator)) return;
    try {
      lock = await navigator.wakeLock.request('screen');
    } catch {
      // denied (battery saver etc.): nothing to do
    }
  }

  const onVis = () => void take();
  document.addEventListener('visibilitychange', onVis);
  void take();

  return () => {
    active = false;
    document.removeEventListener('visibilitychange', onVis);
    void lock?.release().catch(() => {});
    lock = null;
  };
}
