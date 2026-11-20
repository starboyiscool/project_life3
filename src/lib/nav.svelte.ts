import { tick } from 'svelte';

export type Tab = 'today' | 'plan' | 'food' | 'gym' | 'more';
export type MorePage = 'menu' | 'review' | 'habits' | 'done' | 'data' | 'settings' | 'study';
export type FoodPage = 'day' | 'week' | 'calc' | 'base';
export type GymPage = 'now' | 'history' | 'progress' | 'weight' | 'library';

export const nav = $state<{ tab: Tab; more: MorePage; food: FoodPage; gym: GymPage }>({
  tab: 'today',
  more: 'menu',
  food: 'day',
  gym: 'now',
});

/** Scroll position per view ("tab" or "tab:subpage"), restored on return. */
const scrollByView = new Map<string, number>();

function viewKey(): string {
  if (nav.tab === 'more') return `more:${nav.more}`;
  if (nav.tab === 'food') return `food:${nav.food}`;
  if (nav.tab === 'gym') return `gym:${nav.gym}`;
  return nav.tab;
}

export function go(tab: Tab, sub?: MorePage | FoodPage | GymPage): void {
  const from = viewKey();
  scrollByView.set(from, window.scrollY);
  nav.tab = tab;
  if (tab === 'more') nav.more = (sub as MorePage) ?? 'menu';
  if (tab === 'food') nav.food = (sub as FoodPage) ?? nav.food;
  if (tab === 'gym') nav.gym = (sub as GymPage) ?? nav.gym;
  const to = viewKey();
  if (to === from) return;
  // Screens stay mounted (Pane), so the target already has its real height. Restore its own
  // position after Svelte has applied the switch: the old synchronous scrollTo(0, 0) ran
  // against the previous screen, before the DOM update, and made the page jump.
  void tick().then(() => window.scrollTo({ top: scrollByView.get(to) ?? 0, behavior: 'instant' }));
}
