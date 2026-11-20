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

export function go(tab: Tab, sub?: MorePage | FoodPage | GymPage): void {
  nav.tab = tab;
  if (tab === 'more') nav.more = (sub as MorePage) ?? 'menu';
  if (tab === 'food') nav.food = (sub as FoodPage) ?? nav.food;
  if (tab === 'gym') nav.gym = (sub as GymPage) ?? nav.gym;
  window.scrollTo(0, 0);
}
