export type ToastKind = 'info' | 'error';

export interface Toast {
  id: number;
  kind: ToastKind;
  text: string;
  actionLabel?: string;
  action?: () => Promise<boolean>;
}

let nextId = 1;
export const toasts = $state<Toast[]>([]);

export function notify(text: string, kind: ToastKind = 'info', ms = kind === 'error' ? 8000 : 3000): void {
  const id = nextId++;
  toasts.push({ id, kind, text });
  setTimeout(() => dismiss(id), ms);
}

export function notifyAction(text: string, actionLabel: string, action: () => Promise<boolean>, ms = 10000): void {
  const id = nextId++;
  toasts.push({ id, kind: 'info', text, actionLabel, action });
  setTimeout(() => dismiss(id), ms);
}

export async function runAction(id: number): Promise<void> {
  const toast = toasts.find((t) => t.id === id);
  if (!toast?.action) return;
  const action = toast.action;
  // Remove first to prevent duplicate taps; the action reports errors itself.
  dismiss(id);
  await action();
}

export function dismiss(id: number): void {
  const i = toasts.findIndex((t) => t.id === id);
  if (i >= 0) toasts.splice(i, 1);
}

export function errorText(e: unknown): string {
  if (e instanceof Error) {
    // Dexie errors: name like "QuotaExceededError", "ConstraintError"
    if (e.name === 'QuotaExceededError') return 'Нет места в хранилище браузера. Сделайте экспорт и освободите место.';
    return e.message || e.name;
  }
  return String(e);
}
