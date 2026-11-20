import { diffDays, type Day } from './day';

export type WorkKind = 'rgr' | 'lab' | 'course' | 'report' | 'defense' | 'exam' | 'colloquium' | 'homework' | 'presentation' | 'other';

export const WORK_KINDS: { id: WorkKind; label: string }[] = [
  { id: 'lab', label: 'Лабораторная' },
  { id: 'rgr', label: 'РГР' },
  { id: 'course', label: 'Курсовая' },
  { id: 'report', label: 'Реферат / отчёт' },
  { id: 'defense', label: 'Защита' },
  { id: 'exam', label: 'Зачёт / экзамен' },
  { id: 'colloquium', label: 'Коллоквиум' },
  { id: 'homework', label: 'Домашнее задание' },
  { id: 'presentation', label: 'Доклад' },
  { id: 'other', label: 'Другое' },
];

export const kindLabel = (k: WorkKind) => WORK_KINDS.find((x) => x.id === k)?.label ?? k;

export type WorkStatus = 'todo' | 'doing' | 'ready' | 'passed';

export const WORK_STATUSES: { id: WorkStatus; label: string }[] = [
  { id: 'todo', label: 'Не начато' },
  { id: 'doing', label: 'В работе' },
  { id: 'ready', label: 'Готово' },
  { id: 'passed', label: 'Сдано' },
];

export const statusLabel = (s: WorkStatus) => WORK_STATUSES.find((x) => x.id === s)?.label ?? s;

export interface Subject {
  id?: number;
  name: string;
  semester?: number;
  order: number;
  archived?: boolean;
  note?: string;
  createdAt: string;
}

export interface Work {
  id?: number;
  subjectId: number;
  kind: WorkKind;
  title: string;
  status: WorkStatus;
  deadline?: Day;
  /** Week counted from the start of the semester, independent of the calendar date. */
  deadlineWeek?: number;
  deadlineApproximate?: boolean;
  isDebt?: boolean;
  note?: string;
  order: number;
  /** Logical day when the status became 'passed' (for the weekly review). */
  passedDay?: Day;
  createdAt: string;
}

/**
 * Subjects from the requirements. Only the works the requirements name are added
 * (course projects, the C++ labs and the defense, the practice report); no deadlines.
 */
export const PRESET_SUBJECTS: { name: string; semester: number; works?: { kind: WorkKind; title: string }[] }[] = [
  { name: 'Математический анализ', semester: 3 },
  { name: 'Физика', semester: 3 },
  { name: 'Дискретная математика', semester: 3 },
  { name: 'Электроника и схемотехника', semester: 3 },
  { name: 'ТЭЦ (теория электрических цепей)', semester: 3 },
  { name: 'Социология постгуманизма', semester: 3 },
  { name: 'Английский язык', semester: 4 },
  { name: 'Электроника и схемотехника', semester: 4, works: [{ kind: 'course', title: 'Курсовая' }] },
  { name: 'Экономика', semester: 4 },
  { name: 'Теория вероятностей и мат. статистика', semester: 4 },
  { name: 'ТЭЦ', semester: 4, works: [{ kind: 'course', title: 'Курсовая' }] },
  {
    name: 'Методы программирования',
    semester: 4,
    works: [
      { kind: 'lab', title: 'Лабораторная 1 (C++)' },
      { kind: 'lab', title: 'Лабораторная 2 (C++)' },
      { kind: 'lab', title: 'Лабораторная 3 (C++)' },
      { kind: 'lab', title: 'Лабораторная 4 (C++)' },
      { kind: 'defense', title: 'Защита лабораторной 4' },
    ],
  },
  { name: 'Электромагнитные поля и волны', semester: 4 },
  {
    name: 'Ознакомительная практика',
    semester: 4,
    works: [
      { kind: 'report', title: 'Реферат' },
      { kind: 'report', title: 'Отчёт' },
    ],
  },
];

/** Works that gate the admission to the final test: everything except the test itself. */
export const isGate = (w: Work) => w.kind !== 'exam';

export interface Progress {
  total: number;
  passed: number;
  ready: number;
  doing: number;
  /** passed / total, 0 when empty. */
  ratio: number;
}

export function progressOf(works: Work[]): Progress {
  const p = { total: works.length, passed: 0, ready: 0, doing: 0, ratio: 0 };
  for (const w of works) {
    if (w.status === 'passed') p.passed++;
    else if (w.status === 'ready') p.ready++;
    else if (w.status === 'doing') p.doing++;
  }
  p.ratio = p.total ? p.passed / p.total : 0;
  return p;
}

/** Admission is open when every gating work is passed (and there is at least one). */
export function admissionOpen(works: Work[]): boolean {
  const gates = works.filter(isGate);
  return gates.length > 0 && gates.every((w) => w.status === 'passed');
}

const STATUS_ORDER: Record<WorkStatus, number> = { ready: 0, doing: 1, todo: 2, passed: 3 };

/**
 * "What to hand in for admission": open gating works, nearest deadline first,
 * then ready (just needs handing in) before in progress before not started.
 */
export function admissionQueue(works: Work[]): Work[] {
  return works
    .filter((w) => isGate(w) && w.status !== 'passed')
    .sort(
      (a, b) =>
        (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999') ||
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
        a.subjectId - b.subjectId ||
        a.order - b.order,
    );
}

/** Open dated works due no later than seven days from the logical day. */
export function upcomingWorks(works: Work[], today: Day, limit = 3): Work[] {
  return works.filter((w) => w.status !== 'passed' && !!w.deadline && diffDays(today, w.deadline) <= 7)
    .sort((a, b) => a.deadline!.localeCompare(b.deadline!) || a.subjectId - b.subjectId || a.order - b.order)
    .slice(0, limit);
}

/** Neutral deadline text: "сегодня", "через 3 дн.", "срок прошёл 2 дн. назад". */
export function deadlineLabel(deadline: Day | undefined, today: Day): string {
  if (!deadline) return '';
  const d = diffDays(today, deadline);
  if (d === 0) return 'срок сегодня';
  if (d === 1) return 'срок завтра';
  if (d > 1) return `срок через ${d} дн.`;
  return `срок был ${-d} дн. назад`;
}

export const workTaskTitle = (subject: string, w: Pick<Work, 'title'>) => `${subject}: ${w.title}`;
