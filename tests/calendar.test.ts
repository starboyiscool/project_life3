import { describe, expect, it } from 'vitest';
import { calendarCounts } from '../src/lib/logic/calendar';
import type { RecurringTask, Task } from '../src/lib/logic/tasks';

describe('calendar counts', () => {
  const rule: RecurringTask = { id: 1, title: 'Пара', isMit: false, category: 'study', rule: {type: 'daily'}, startDay: '2026-11-01', active: true, createdAt: '' };
  const task = (day: string, status: Task['status'], recurringId?: number): Task => ({title: 'x', category:'study', isMit: false, day, status, recurringId, createdAt:''});
  it('projects active repeats without double-counting existing or reviving skipped instances', () => {
    const days = ['2026-11-01', '2026-11-02', '2026-11-03'];
    const rows = [task(days[0], 'done', 1), task(days[1], 'dropped', 1), task(days[2], 'open')];
    expect(calendarCounts(days, rows, [rule])).toEqual({ '2026-11-01': 1, '2026-11-03': 2 });
  });
  it('does not project inactive rules or before start', () => {
    expect(calendarCounts(['2026-10-31','2026-11-01'], [], [{...rule, active:false}])).toEqual({});
    expect(calendarCounts(['2026-10-31','2026-11-01'], [], [rule])).toEqual({'2026-11-01':1});
  });
});

import { semesterWeek, semesterWeekRange, workWeekRange, isControlWeek } from '../src/lib/logic/semester';
import { matchesFilter } from '../src/lib/logic/calendar';
describe('semester and filters', () => {
  it('counts seven-day weeks from any start and crosses year boundaries', () => {
    expect(semesterWeek('2026-09-01', '2026-08-31')).toBeNull();
    expect(semesterWeek('2026-09-01', '2026-09-07')).toBe(1);
    expect(semesterWeek('2026-09-01', '2026-09-08')).toBe(2);
    expect(semesterWeekRange('2026-12-29', 2)).toEqual({from:'2027-01-05',to:'2027-01-11'});
    expect(semesterWeekRange('2026-09-01', 7)).toEqual({from:'2026-10-13',to:'2026-10-19'});
    expect(isControlWeek(7)).toBe(true);expect(isControlWeek(14)).toBe(true);expect(isControlWeek(8)).toBe(false);
    expect(semesterWeekRange('2026-09-01', 53)).toBeNull();
  });
  it('does not apply current dates to a different semester or unknown semester', () => {
    const work = {deadlineWeek: 2} as import('../src/lib/logic/study').Work;
    const subject = {semester: 3} as import('../src/lib/logic/study').Subject;
    expect(workWeekRange(work, subject, 4, '2026-09-01')).toBeNull();
    expect(workWeekRange(work, subject, undefined, '2026-09-01')).toBeNull();
    expect(workWeekRange(work, subject, 3, '2026-09-01')).toEqual({from:'2026-09-08',to:'2026-09-14'});
  });
  it('maps category filters', () => {
    expect(matchesFilter('study','study')).toBe(true);expect(matchesFilter('training','study')).toBe(false);
    expect(matchesFilter('home','other')).toBe(true);expect(matchesFilter('project','other')).toBe(true);
    expect(matchesFilter('study','other')).toBe(false);
  });
});

import { importFileWithinLimit, STORAGE_TARGET_BYTES } from '../src/lib/storage';
it('rejects oversized imports before parsing', () => {
  expect(importFileWithinLimit(STORAGE_TARGET_BYTES)).toBe(true);
  expect(importFileWithinLimit(STORAGE_TARGET_BYTES + 1)).toBe(false);
});

it('filters task counts without reviving a recorded repeat in another category', () => {
  const day = '2026-11-01';
  const r: RecurringTask = {id: 9, title:'Пара', isMit:false, category:'study', rule:{type:'daily'}, startDay:day, active:true, createdAt:''};
  const t: Task = {title:'Пара', category:'training', isMit:false, day, status:'done', recurringId:9, createdAt:''};
  expect(calendarCounts([day], [t], [r], 'study')).toEqual({});
  expect(calendarCounts([day], [t], [r], 'training')).toEqual({[day]:1});
});

import { hasTrainingOnDay } from '../src/lib/logic/calendar';
it('shows a training card only for real events on this calendar day', () => {
  const day = '2026-11-14';
  const t: Task = {title:'Тренировка', category:'training', isMit:false, day, status:'open', createdAt:''};
  const w: import('../src/lib/logic/gym').Workout = {day, status:'active', items:[], startedAt:''};
  expect(hasTrainingOnDay(day, [], [])).toBe(false);
  expect(hasTrainingOnDay(day, [{...t,day:'2026-11-15'}], [])).toBe(false);
  expect(hasTrainingOnDay(day, [{...t,status:'dropped'}], [])).toBe(false);
  expect(hasTrainingOnDay(day, [t], [])).toBe(true);
  expect(hasTrainingOnDay(day, [{...t,status:'done'}], [])).toBe(true);
  expect(hasTrainingOnDay(day, [], [{...w,day:'2026-11-13'}])).toBe(false);
  expect(hasTrainingOnDay(day, [], [w])).toBe(true);
  expect(hasTrainingOnDay(day, [], [{...w,status:'done'}])).toBe(true);
});
