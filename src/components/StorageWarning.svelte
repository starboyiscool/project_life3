<script lang="ts">
 import { onMount } from 'svelte';
 import { storageEstimate, STORAGE_WARNING_BYTES } from '../lib/storage';
 import { go } from '../lib/nav.svelte';
 let usage = $state<number | null>(null);
 onMount(() => {
   const refresh = () => { void storageEstimate().then(result => { usage = result?.usage ?? null; }).catch(() => { usage = null; }); };
   refresh(); const timer = setInterval(refresh, 60000);
   document.addEventListener('visibilitychange', refresh);
   return () => { clearInterval(timer); document.removeEventListener('visibilitychange', refresh); };
 });
</script>
{#if usage !== null && usage >= STORAGE_WARNING_BYTES}
<section class="card stack" role="status"><b>Мало места в хранилище приложения</b><p class="small">Браузер оценивает занятое место в {(usage / 1024 / 1024).toFixed(0)} МиБ. Проверьте данные и сохраните экспорт.</p><button onclick={() => go('more','data')}>Открыть данные</button></section>
{/if}
