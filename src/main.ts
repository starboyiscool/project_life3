import { mount } from 'svelte';
import './app.css';
import App from './App.svelte';
import { db, initDb, migratedFrom } from './lib/app-db';
import { ensureGymSeed } from './lib/repo/gym';
import { restoreRest } from './lib/rest.svelte';
import { SCHEMA_VERSION } from './lib/db/migrations';
import { initPwa } from './lib/pwa.svelte';
import { loadSettings, startClock } from './lib/state.svelte';
import { requestPersistence } from './lib/storage';
import { errorText, notify } from './lib/toast.svelte';

// Any unhandled failure (including IndexedDB write errors) is shown, never swallowed.
window.addEventListener('unhandledrejection', (e) => notify(`Ошибка: ${errorText(e.reason)}`, 'error'));
window.addEventListener('error', (e) => notify(`Ошибка: ${errorText(e.error ?? e.message)}`, 'error'));

initPwa();
startClock();

const target = document.getElementById('app')!;
try {
  // Open (and migrate, with a snapshot) the database before the UI needs it.
  await initDb();
  await loadSettings();
  await ensureGymSeed(db);
  restoreRest();
  mount(App, { target });
  if (migratedFrom !== null) notify(`Данные обновлены до схемы v${SCHEMA_VERSION}. Снапшот старых данных сохранён.`);
  void requestPersistence();
} catch (e) {
  target.innerHTML = `<div class="card" style="margin:16px"><h2>Не удалось открыть данные</h2><p class="muted"></p></div>`;
  target.querySelector('p')!.textContent = errorText(e);
}
