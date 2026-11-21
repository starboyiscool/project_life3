<script lang="ts">
  import Icon from '../Icon.svelte';
  import { db } from '../../lib/app-db';
  import { act, days, live, nutritionSettings, saveNutritionSettings } from '../../lib/state.svelte';
  import { addDays, formatDayShort } from '../../lib/logic/day';
  import {
    ACTIVITY_LEVELS,
    GOAL_KINDS,
    estimateTargets,
    goalForDay,
    observationWarnings,
    parseNum,
    periodSummary,
    suggestFromAverage,
    type Macros,
    type NutritionGoal,
    type NutritionGoalKind,
  } from '../../lib/logic/nutrition';
  import { entriesBetween, listGoals, setGoals } from '../../lib/repo/nutrition';
  import { listWeights } from '../../lib/repo/weights';
  import { formatKg, movingAverage, weeklyTrend } from '../../lib/logic/weight';

  const data = live(
    () => {
      const to = addDays(days.today, -1);
      const from = addDays(to, -6);
      return async () => {
        const [entries, goals, weights] = await Promise.all([entriesBetween(db, from, to), listGoals(db), listWeights(db)]);
        return { s: periodSummary(entries, from, to), goals, weights, from, to };
      };
    },
    null as null | {
      s: ReturnType<typeof periodSummary>;
      goals: NutritionGoal[];
      weights: Awaited<ReturnType<typeof listWeights>>;
      from: string;
      to: string;
    },
  );

  const ns = nutritionSettings;
  const s = $derived(data.current?.s);
  const warnings = $derived(s ? observationWarnings(s) : []);
  const suggested = $derived(s?.avg ? suggestFromAverage(s.avg, ns.surplusPct) : null);
  const current = $derived(data.current ? goalForDay(data.current.goals, days.today) : undefined);

  // body weight for the formula: 7-day average of the latest entries, else the profile value
  const maWeight = $derived(data.current ? movingAverage(data.current.weights).at(-1) : undefined);
  const trend = $derived(data.current ? weeklyTrend(data.current.weights) : null);
  const weightKg = $derived(maWeight ? Math.round(maWeight.avg * 10) / 10 : ns.weightKg);
  const estimate = $derived(
    ns.age && ns.sex ? estimateTargets({ sex: ns.sex, age: ns.age, heightCm: ns.heightCm, weightKg }, ns.activity, ns.goal) : null,
  );

  let target = $state({ kcal: '', p: '', f: '', c: '' });
  let source = $state<NutritionGoal['source']>('manual');
  let initialized = false;

  $effect(() => {
    if (initialized || !data.current) return;
    initialized = true;
    if (suggested) fill(suggested, 'calc');
    else if (current) fill(current, 'manual');
    else if (estimate) fill(estimate.target, 'calc');
  });

  function fill(m: Macros, src: NutritionGoal['source']) {
    target = { kcal: String(m.kcal), p: String(m.p), f: String(m.f), c: String(m.c) };
    source = src;
  }

  const parsed = $derived.by(() => {
    const v = [target.kcal, target.p, target.f, target.c].map(parseNum);
    return v.some((x) => x == null) ? null : { kcal: Math.round(v[0]!), p: Math.round(v[1]!), f: Math.round(v[2]!), c: Math.round(v[3]!) };
  });
  const macroKcal = $derived(parsed ? parsed.p * 4 + parsed.f * 9 + parsed.c * 4 : 0);

  async function save() {
    if (!parsed) return;
    if (current && !confirm(`Сейчас цель ${current.kcal} ккал. Заменить на ${parsed.kcal} ккал с сегодняшнего дня?`)) return;
    const m = parsed;
    await act(() => setGoals(db, days.today, m, source), 'Цели сохранены');
  }

  function num(e: Event): number | undefined {
    const n = parseNum((e.currentTarget as HTMLInputElement).value);
    return n == null || n === 0 ? undefined : n;
  }
</script>

{#if data.current && s}
  <div class="stack">
    <section class="card stack">
      <h2 class="section-title">1. Наблюдение</h2>
      <p class="small muted">{formatDayShort(data.current.from)} – {formatDayShort(data.current.to)}, 7 полных дней</p>
      <p>Заполнено дней: <b>{s.filledDays} из 7</b>, приёмов пищи: <b>{s.meals}</b></p>
      {#if s.avg}
        <p class="num">Среднее в день: <b>{s.avg.kcal} ккал</b> · Б {Math.round(s.avg.p)} · Ж {Math.round(s.avg.f)} · У {Math.round(s.avg.c)}</p>
      {/if}
      {#each warnings as w (w)}<p class="warn small">{w}</p>{/each}
      {#if suggested}
        <div class="row">
          <span>Предложение: среднее +</span>
          <input
            class="pct"
            inputmode="numeric"
            value={ns.surplusPct}
            onchange={(e) => {
              const n = parseNum(e.currentTarget.value);
              if (n != null && n <= 50) saveNutritionSettings({ surplusPct: n });
            }}
            aria-label="Процент"
          /><span>%</span>
        </div>
        <p class="num"><b>{suggested.kcal} ккал</b> · Б {suggested.p} · Ж {suggested.f} · У {suggested.c}</p>
        <button onclick={() => fill(suggested!, 'calc')}>Взять в цели <Icon name="down" size={16} /></button>
      {/if}
    </section>

    <section class="card stack">
      <h2 class="section-title">2. Оценка по Миффлину — Сан-Жеору</h2>
      <p class="muted small">Формула даёт ориентир с ошибкой ±10–15%, это не измерение. Используй для сравнения.</p>
      <div class="chips">
        <button class="chip" class:on={ns.sex === 'm'} onclick={() => saveNutritionSettings({ sex: 'm' })}>Мужской</button>
        <button class="chip" class:on={ns.sex === 'f'} onclick={() => saveNutritionSettings({ sex: 'f' })}>Женский</button>
      </div>
      <div class="row">
        <label class="lbl grow"><span class="muted small">Возраст</span><input inputmode="numeric" value={ns.age ?? ''} onchange={(e) => saveNutritionSettings({ age: num(e) })} /></label>
        <label class="lbl grow"><span class="muted small">Рост, см</span><input inputmode="numeric" value={ns.heightCm} onchange={(e) => { const n = num(e); if (n) saveNutritionSettings({ heightCm: n }); }} /></label>
        <label class="lbl grow">
          <span class="muted small">Вес, кг</span>
          {#if maWeight}
            <input value={formatKg(weightKg)} disabled />
          {:else}
            <input inputmode="decimal" value={ns.weightKg} onchange={(e) => { const n = num(e); if (n) saveNutritionSettings({ weightKg: n }); }} />
          {/if}
        </label>
      </div>
      {#if maWeight}<p class="muted small">Вес взят из раздела «Вес» (среднее за 7 дней){#if trend !== null}, тренд {formatKg(trend)} кг/нед{/if}.</p>{/if}
      <label class="lbl">
        <span class="muted small">Активность</span>
        <select value={ns.activity} onchange={(e) => saveNutritionSettings({ activity: Number(e.currentTarget.value) })}>
          {#each ACTIVITY_LEVELS as a (a.value)}<option value={a.value}>{a.label}</option>{/each}
        </select>
      </label>
      <div class="chips">
        {#each Object.entries(GOAL_KINDS) as [k, g] (k)}
          <button class="chip" class:on={ns.goal === k} onclick={() => saveNutritionSettings({ goal: k as NutritionGoalKind })}>{g.label}</button>
        {/each}
      </div>
      {#if estimate}
        <p class="num small muted">Основной обмен {estimate.bmr} ккал, с активностью {estimate.tdee} ккал</p>
        <p class="num"><b>{estimate.target.kcal} ккал</b> · Б {estimate.target.p} · Ж {estimate.target.f} · У {estimate.target.c}</p>
        <p class="muted small">Белок 1,8 г/кг{ns.goal === 'cut' ? ' (2 г/кг на сушке)' : ''}, жиры 0,9 г/кг, остальное углеводы.</p>
        <button onclick={() => fill(estimate!.target, 'calc')}>Взять в цели <Icon name="down" size={16} /></button>
      {:else}
        <p class="muted small">Укажи пол и возраст для оценки.</p>
      {/if}
    </section>

    <section class="card stack">
      <h2 class="section-title">3. Цели на день</h2>
      <div class="grid">
        <label class="lbl"><span class="muted small">Ккал</span><input bind:value={target.kcal} oninput={() => (source = 'manual')} inputmode="numeric" /></label>
        <label class="lbl"><span class="muted small">Белки</span><input bind:value={target.p} oninput={() => (source = 'manual')} inputmode="numeric" /></label>
        <label class="lbl"><span class="muted small">Жиры</span><input bind:value={target.f} oninput={() => (source = 'manual')} inputmode="numeric" /></label>
        <label class="lbl"><span class="muted small">Углев.</span><input bind:value={target.c} oninput={() => (source = 'manual')} inputmode="numeric" /></label>
      </div>
      {#if parsed && Math.abs(macroKcal - parsed.kcal) > parsed.kcal * 0.1}
        <p class="muted small">
          По БЖУ выходит {macroKcal} ккал при цели {parsed.kcal}. Небольшая разница нормальна, особенно если часть записей внесена без БЖУ.
        </p>
      {/if}
      <button class="primary" disabled={!parsed} onclick={save}>Сохранить цели с сегодняшнего дня</button>
      {#if data.current.goals.length}
        <div class="stack hist">
          <span class="section-title">История целей</span>
          {#each [...data.current.goals].reverse() as g (g.id)}
            <span class="small num">с {formatDayShort(g.from)}: {g.kcal} ккал · Б {g.p} · Ж {g.f} · У {g.c} <span class="muted">({g.source === 'calc' ? 'расчёт' : 'вручную'})</span></span>
          {/each}
        </div>
      {/if}
      <p class="muted small">Пересчитывать имеет смысл раз в 1–2 недели. Если вес за 2 недели не растёт, подними цель. Если растёт быстрее 0,5 кг в неделю, опусти.</p>
    </section>
  </div>
{/if}

<style>
  .pct {
    width: 64px;
    text-align: center;
  }

  .warn {
    border-left: 3px solid var(--muted);
    padding-left: 8px;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 6px;
  }

  .grid input {
    padding: 0 8px;
  }

  .hist {
    gap: 4px;
  }
</style>
