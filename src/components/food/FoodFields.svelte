<script lang="ts" module>
  import { parseNum, type NewFood } from '../../lib/logic/nutrition';

  export interface FoodDraft {
    name: string;
    kcal: string;
    p: string;
    f: string;
    c: string;
    portionName: string;
    portionG: string;
  }

  export const emptyDraft = (name = ''): FoodDraft => ({ name, kcal: '', p: '', f: '', c: '', portionName: '', portionG: '' });

  export function draftOf(f: NewFood): FoodDraft {
    const s = (n: number) => String(n).replace('.', ',');
    return {
      name: f.name,
      kcal: s(f.per100.kcal),
      p: s(f.per100.p),
      f: s(f.per100.f),
      c: s(f.per100.c),
      portionName: f.portionName ?? '',
      portionG: f.portionG ? String(f.portionG) : '',
    };
  }

  /** null if the draft is not a valid food. Empty P/F/C count as 0; kcal is required. */
  export function foodOf(d: FoodDraft): NewFood | null {
    const kcal = parseNum(d.kcal);
    const [p, f, c] = [d.p, d.f, d.c].map((v) => (v.trim() === '' ? 0 : parseNum(v)));
    if (!d.name.trim() || kcal == null || p == null || f == null || c == null) return null;
    const pg = parseNum(d.portionG);
    return {
      name: d.name.trim(),
      per100: { kcal, p, f, c },
      portionName: pg ? d.portionName.trim() || `порция` : undefined,
      portionG: pg || undefined,
    };
  }
</script>

<script lang="ts">
  let { draft = $bindable() }: { draft: FoodDraft } = $props();
</script>

<div class="stack">
  <input bind:value={draft.name} placeholder="Название" aria-label="Название продукта" autocomplete="off" />
  <span class="muted small">На 100 г</span>
  <div class="grid">
    <label class="lbl"><span class="muted small">Ккал</span><input bind:value={draft.kcal} inputmode="decimal" /></label>
    <label class="lbl"><span class="muted small">Белки</span><input bind:value={draft.p} inputmode="decimal" /></label>
    <label class="lbl"><span class="muted small">Жиры</span><input bind:value={draft.f} inputmode="decimal" /></label>
    <label class="lbl"><span class="muted small">Углев.</span><input bind:value={draft.c} inputmode="decimal" /></label>
  </div>
  <div class="row">
    <label class="lbl grow"><span class="muted small">Порция (необяз.)</span><input bind:value={draft.portionName} placeholder="1 яйцо" /></label>
    <label class="lbl g"><span class="muted small">Граммов</span><input bind:value={draft.portionG} inputmode="decimal" placeholder="55" /></label>
  </div>
</div>

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 6px;
  }

  .grid input {
    padding: 0 8px;
  }

  .g {
    width: 96px;
  }
</style>
