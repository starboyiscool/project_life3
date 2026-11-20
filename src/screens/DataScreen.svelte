<script lang="ts">
  import { onMount } from 'svelte';
  import { getDb, getMeta } from '../lib/app-db';
  import { backupFileName, importBackup, parseBackup, type BackupFile } from '../lib/backup';
  import { downloadJson, exportAll } from '../lib/export';
  import { SnapshotStore, type Snapshot } from '../lib/db/snapshots';
  import { SCHEMA_VERSION } from '../lib/db/migrations';
  import { requestPersistence, storageEstimate, STORAGE_WARNING_BYTES, importFileWithinLimit, type PersistState } from '../lib/storage';
  import { loadSettings } from '../lib/state.svelte';
  import { errorText, notify } from '../lib/toast.svelte';

  const snapshotStore = new SnapshotStore();

  let busy = $state(false);
  let persist = $state<PersistState | null>(null);
  let usage = $state<string>('');
  let usageBytes = $state<number | null>(null);
  let lastExportAt = $state<string | undefined>();
  let snapshots = $state<Snapshot[]>([]);
  let fileInput: HTMLInputElement;

  const fmt = new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Asia/Novosibirsk',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  const fmtDate = (iso?: string) => (iso ? fmt.format(new Date(iso)) : 'ни разу');

  async function refresh() {
    lastExportAt = await getMeta<string>('lastExportAt');
    snapshots = await snapshotStore.list();
    const est = await storageEstimate();
    if (est) { usageBytes = est.usage; usage = `${(est.usage / 1024 / 1024).toFixed(2)} МиБ (оценка браузера; системная квота ${(est.quota / 1024 / 1024).toFixed(0)} МиБ)`; }
  }

  onMount(async () => {
    try {
      await getDb();
      persist = await requestPersistence();
      await refresh();
    } catch (e) {
      notify(`Не удалось открыть базу: ${errorText(e)}`, 'error');
    }
  });

  const download = (backup: BackupFile, name?: string) => downloadJson(backup, name);

  async function doExport() {
    busy = true;
    try {
      await exportAll();
      await refresh();
      notify('Экспорт готов: файл в «Загрузках».');
    } catch (e) {
      notify(`Экспорт не удался: ${errorText(e)}`, 'error');
    } finally {
      busy = false;
    }
  }

  async function onFile(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    busy = true;
    let imported = false;
    try {
      if (!importFileWithinLimit(file.size)) throw new Error('Файл больше 300 МиБ. Импорт отменён, текущие данные не изменены.');
      const backup = parseBackup(await file.text());
      const counts = Object.entries(backup.tables)
        .map(([t, rows]) => `${t}: ${rows.length}`)
        .join(', ');
      const ok = confirm(
        `Заменить ВСЕ текущие данные содержимым бэкапа?\n\n` +
          `Бэкап от: ${fmtDate(backup.exportedAt)}\nЗаписей: ${counts || 'нет'}\n\n` +
          `Текущие данные будут сохранены в снапшот перед заменой.`,
      );
      if (!ok) return;
      await importBackup(await getDb(), backup, { snapshots: snapshotStore });
      imported = true;
      await loadSettings();
      await refresh();
      notify('Импорт выполнен.');
    } catch (err) {
      notify(imported ? `Импорт выполнен, но обновить экран не удалось: ${errorText(err)}` : `Импорт не завершён: ${errorText(err)}`, 'error');
    } finally {
      busy = false;
    }
  }

  async function restoreSnapshot(s: Snapshot) {
    if (busy) return;
    const ok = confirm(`Восстановить снапшот от ${fmtDate(s.createdAt)} (${reasonLabel[s.reason]})?\n\nВСЕ текущие данные будут заменены. Перед заменой будет создан новый снапшот.`);
    if (!ok) return;
    busy = true;
    let restored = false;
    try {
      const backup = parseBackup(JSON.stringify($state.snapshot(s.backup)));
      await importBackup(await getDb(), backup, { snapshots: snapshotStore });
      restored = true;
      await loadSettings();
      await refresh();
      notify('Снапшот восстановлен.');
    } catch (err) {
      notify(restored ? `Данные восстановлены, но обновить экран не удалось: ${errorText(err)}` : `Восстановление не выполнено: ${errorText(err)}`, 'error');
    } finally { busy = false; }
  }

  function downloadSnapshot(s: Snapshot) {
    download(s.backup, `snapshot-${s.reason}-${backupFileName(new Date(s.createdAt)).replace('life-tracker-', '')}`);
  }

  const reasonLabel = { 'pre-migration': 'перед миграцией', 'pre-import': 'перед импортом' } as const;
</script>

<div class="stack">
  <section class="card stack">
    <p class="muted small">
      Все данные хранятся только на этом устройстве. Последний экспорт: <b>{fmtDate(lastExportAt)}</b>.
    </p>
    <button class="primary" disabled={busy} onclick={doExport}>Экспорт в JSON</button>
    <button disabled={busy} onclick={() => fileInput.click()}>Импорт из JSON…</button>
    <input bind:this={fileInput} type="file" accept="application/json,.json" hidden onchange={onFile} />
  </section>

  <section class="card stack">
    <h2>Снапшоты</h2>
    <p class="muted small">Сохраняются перед миграцией и заменой данных (последние 10). Они находятся на этом же устройстве и не заменяют экспорт в файл.</p>
    {#if snapshots.length === 0}
      <p class="muted">Пока нет.</p>
    {:else}
      {#each snapshots as s (s.id)}
        <div class="snapshot stack">
          <div>
            <div>{fmtDate(s.createdAt)}</div>
            <div class="muted small">{reasonLabel[s.reason]} · схема {s.backup.schemaVersion}</div>
          </div>
          <div class="row actions">
            <button disabled={busy} onclick={() => downloadSnapshot(s)}>Скачать</button>
            <button disabled={busy} onclick={() => restoreSnapshot(s)}>Восстановить</button>
          </div>
        </div>
      {/each}
    {/if}
  </section>

  <section class="card">
    <h2>Хранилище</h2>
    <p class="muted small">Ориентир — 300 МиБ. Оценка браузера включает кэш и данные сайта; системная квота может отличаться. Импорт файлов больше 300 МиБ не допускается. Жёсткий лимит для всех записей пока не установлен.</p>
    {#if usageBytes !== null && usageBytes >= STORAGE_WARNING_BYTES}<p class="danger">Хранилище приблизилось к 300 МиБ. Экспортируйте данные и проверьте размер резервных копий.</p>{/if}
    <dl class="small">
      <dt>Схема данных</dt>
      <dd>v{SCHEMA_VERSION}</dd>
      <dt>Защита от очистки</dt>
      <dd>
        {#if persist === 'persisted'}включена
        {:else if persist === 'not-persisted'}не выдана браузером (установите приложение на экран)
        {:else if persist === 'unsupported'}не поддерживается
        {:else}…{/if}
      </dd>
      {#if usage}
        <dt>Занято</dt>
        <dd>{usage}</dd>
      {/if}
    </dl>
  </section>
</div>

<style>
  .stack {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .snapshot { border-top: 1px solid var(--border); padding-top: 12px; }
  .actions { justify-content: flex-start; flex-wrap: wrap; }

  p {
    margin: 0;
  }

  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 6px 12px;
    margin: 12px 0 0;
  }

  dt {
    color: var(--muted);
  }

  dd {
    margin: 0;
  }
</style>
