import type { Fields, Tag, Task, TaskState } from '../../shared/contracts.js';
export const localDate = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export function validDate(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    localDate(new Date(`${value}T12:00:00`)) === value
  );
}
export const copyDefaults = {
  headerKicker: 'Weekly operations desk',
  appTitle: '狗牛',
  dateLine: '',
  progressTitle: '今日完成度',
  addButtonLabel: '新增任务',
  nextTaskTitle: '下一项任务',
  tasksTitle: '',
  calendarTitle: '',
  weekSummaryTitle: '本周概览',
  incomeTitle: '实时收入',
  workTimeTitle: '工时与下班倒计时',
  clockTitle: '打卡操作',
  stolenTitle: '偷出金额',
  toiletTitle: '带薪拉屎',
  owedTitle: '老板欠我钱',
  moodTitle: '今日精神状态', receiptTitle: '下班小票', lunchTitle: '今天吃什么',
  hopesTitle: '盼头清单', pastureTitle: '工位小牧场', converterTitle: '工资能买啥',
};
export const emptyTasks = (): TaskState => ({
  tasks: [],
  tagLibrary: [],
  seededWeeks: [],
  settings: { ...copyDefaults },
});
export const record = (value: unknown): value is Fields =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const color = (value: unknown) =>
  typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : '#6b7280';
export function normalizeTask(raw: Fields, makeId: () => string): Task {
  const tags: Tag[] = Array.isArray(raw.tags)
    ? raw.tags.map((tag) => {
        if (!record(tag) || typeof tag.label !== 'string') throw Error('任务标签格式无效。');
        return {
          id: typeof tag.id === 'string' ? tag.id : makeId(),
          label: tag.label || '标签',
          color: color(tag.color),
        };
      })
    : [
        {
          id: makeId(),
          label: String(raw.category || '工作'),
          color: '#6b7280',
        },
      ];
  if (
    typeof raw.id !== 'string' ||
    !raw.id ||
    typeof raw.title !== 'string' ||
    !validDate(raw.date)
  )
    throw Error('任务编号、日期或标题无效。');
  return {
    ...raw,
    id: raw.id,
    date: raw.date,
    title: raw.title,
    note: String(raw.note || ''),
    priority: ['高', '中', '低'].includes(String(raw.priority)) ? String(raw.priority) : '中',
    tags,
    progress: Number.isFinite(Number(raw.progress))
      ? Math.max(0, Math.min(100, Math.round(Number(raw.progress))))
      : raw.done
        ? 100
        : 0,
    done: Boolean(raw.done),
    hasTime: Boolean(raw.hasTime),
    startTime: String(raw.startTime || ''),
    endTime: String(raw.endTime || ''),
    dueDate: validDate(raw.dueDate) ? raw.dueDate : '',
    calendarMark: Boolean(raw.calendarMark),
    markerColor: color(raw.markerColor || '#8b5cf6'),
  };
}
export function parseTasks(raw: string | null, makeId: () => string): TaskState {
  if (raw === null) return emptyTasks();
  const value: unknown = JSON.parse(raw);
  if (!record(value) || !Array.isArray(value.tasks))
    throw Error('任务数据读取失败，原记录未覆盖。');
  const tasks = value.tasks.map((item) => {
    if (!record(item)) throw Error('任务记录格式无效。');
    return normalizeTask(item, makeId);
  });
  if (new Set(tasks.map((task) => task.id)).size !== tasks.length) throw Error('任务编号重复。');
  const seededWeeks = value.seededWeeks === undefined ? [] : value.seededWeeks;
  if (!Array.isArray(seededWeeks) || !seededWeeks.every(validDate)) throw Error('周记录格式无效。');
  const library = new Map<string, { label: string; color: string }>();
  for (const tag of [
    ...(Array.isArray(value.tagLibrary) ? value.tagLibrary : []),
    ...tasks.flatMap((task) => task.tags),
  ]) {
    if (!record(tag)) continue;
    const label = String(tag.label || '')
      .trim()
      .slice(0, 20);
    if (label && !library.has(label.toLocaleLowerCase('zh-CN')))
      library.set(label.toLocaleLowerCase('zh-CN'), {
        label,
        color: color(tag.color),
      });
  }
  const settings = { ...copyDefaults } as Record<string, string>;
  if (record(value.settings))
    for (const key of Object.keys(settings))
      if (typeof value.settings[key] === 'string') settings[key] = value.settings[key];
  return { tasks, tagLibrary: [...library.values()], seededWeeks, settings };
}
export const matchesDate = (task: Task, date: string) =>
  task.date === date || task.dueDate === date;
export const addDays = (date: string, days: number) => {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return localDate(d);
};
export function weekDates(date: string) {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => addDays(localDate(d), i));
}
