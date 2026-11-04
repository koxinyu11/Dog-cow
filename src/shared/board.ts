// Home board model: shared by main (validation, persistence) and renderer (layout, rendering).
// Positions are not stored. Order + size are packed into a fixed-column grid, so modules can never overlap.

export const BOARD_KEY = 'dogcow.board.v2';
/** 12 sub-columns so a row holds 4 small, 3 medium or 2 large cards. */
export const BOARD_COLUMNS = 12;

export const SIZES = {
  // nw: width on a narrow (6 sub-column) window, where small and medium cards sit two per row.
  s: { w: 3, nw: 3, h: 1, label: '小', hint: '1/4 宽' },
  m: { w: 4, nw: 3, h: 1, label: '中', hint: '1/3 宽' },
  l: { w: 6, nw: 6, h: 2, label: '大', hint: '1/2 宽 · 两行高' },
  wide: { w: 12, nw: 6, h: 1, label: '长', hint: '整行' },
  tall: { w: 4, nw: 3, h: 2, label: '竖', hint: '1/3 宽 · 两行高' },
} as const;
export type SizeKey = keyof typeof SIZES;
export const SIZE_KEYS = Object.keys(SIZES) as SizeKey[];

export const MODULE_IDS = [
  'income',
  'work-time',
  'week-summary',
  'clock',
  'progress',
  'next-task',
  'tasks',
  'calendar',
  'stolen',
] as const;
export type ModuleId = (typeof MODULE_IDS)[number];

export const METRICS = {
  'income-today': '今日已赚',
  'income-month': '本月已赚',
  'per-second': '秒薪',
  countdown: '下班倒计时',
  'worked-today': '今日已工作',
  progress: '今日完成度',
  'week-done': '本周完成',
  'stolen-today': '今日偷出',
  date: '今天日期',
  clock: '当前时间',
} as const;
export type MetricId = keyof typeof METRICS;

// Keys are persisted; labels can change freely. Never rename or remove a key.
export const BACKGROUND_PRESETS = {
  classic: '工位米白',
  meadow: '牛马草原',
  ocean: '摸鱼海',
  sunset: '下班晚霞',
  night: '加班夜空',
  friday: '周五狂喜',
  monday: '周一阴天',
  boba: '奶茶续命',
  pie: '画饼工厂',
  candy: '带薪发呆',
  paper: '周报白纸',
} as const;
export type PresetKey = keyof typeof BACKGROUND_PRESETS;
/** Presets with a dark sky need light header text. */
export const DARK_PRESETS: readonly PresetKey[] = ['night'];
/** Presets with slow ambient animation. */
export const ANIMATED_PRESETS: readonly PresetKey[] = ['meadow', 'ocean', 'sunset', 'night', 'friday', 'monday'];
export type Background =
  | { kind: 'preset'; value: keyof typeof BACKGROUND_PRESETS }
  | { kind: 'color'; value: string }
  | { kind: 'image'; value: string };

export interface BoardItem {
  id: ModuleId;
  size: SizeKey;
}
export interface Board {
  version: 2;
  items: BoardItem[];
  background: Background;
  bindings: Record<string, MetricId>;
  /** Legacy v4 preview field. Still accepted when reading, no longer used. */
  columns?: 3 | 4;
  /** Per-module card colour, #rrggbb. Absent means the theme default. */
  colors?: Partial<Record<ModuleId, string>>;
}

export const MAX_IMAGE_LENGTH = 4_000_000;

export function defaultBoard(): Board {
  return {
    version: 2,
    items: [
      { id: 'income', size: 'm' },
      { id: 'work-time', size: 'm' },
      { id: 'clock', size: 'm' },
      { id: 'week-summary', size: 'wide' },
    ],
    background: { kind: 'preset', value: 'classic' },
    bindings: {},
  };
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);

export function validBackground(value: unknown): value is Background {
  if (!isRecord(value) || typeof value.value !== 'string') return false;
  if (value.kind === 'preset') return Object.hasOwn(BACKGROUND_PRESETS, value.value);
  if (value.kind === 'color') return /^#[0-9a-f]{6}$/i.test(value.value);
  if (value.kind === 'image')
    return (
      value.value.length <= MAX_IMAGE_LENGTH &&
      /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value.value)
    );
  return false;
}

export function validBoard(value: unknown, copyKeys: readonly string[]): value is Board {
  if (!isRecord(value) || value.version !== 2 || !Array.isArray(value.items)) return false;
  const ids = new Set<string>();
  for (const item of value.items) {
    if (
      !isRecord(item) ||
      typeof item.id !== 'string' ||
      !(MODULE_IDS as readonly string[]).includes(item.id) ||
      typeof item.size !== 'string' ||
      !Object.hasOwn(SIZES, item.size) ||
      ids.has(item.id)
    )
      return false;
    ids.add(item.id);
  }
  if (!validBackground(value.background) || !isRecord(value.bindings)) return false;
  if (value.columns !== undefined && value.columns !== 3 && value.columns !== 4) return false;
  if (
    value.colors !== undefined &&
    (!isRecord(value.colors) ||
      !Object.entries(value.colors).every(
        ([id, c]) => (MODULE_IDS as readonly string[]).includes(id) && typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c),
      ))
  )
    return false;
  return Object.entries(value.bindings).every(
    ([key, metric]) =>
      copyKeys.includes(key) && typeof metric === 'string' && Object.hasOwn(METRICS, metric),
  );
}

export interface Placed extends BoardItem {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Dense first-fit packing. Each item takes the first free slot scanning rows top-down. */
export function pack(items: BoardItem[], columns = BOARD_COLUMNS): Placed[] {
  const taken: boolean[][] = [];
  const free = (x: number, y: number, w: number, h: number) => {
    for (let r = y; r < y + h; r++)
      for (let c = x; c < x + w; c++) if (taken[r]?.[c]) return false;
    return true;
  };
  return items.map((item) => {
    const w = Math.min(columns < BOARD_COLUMNS ? SIZES[item.size].nw : SIZES[item.size].w, columns);
    const h = SIZES[item.size].h;
    for (let y = 0; ; y++)
      for (let x = 0; x + w <= columns; x++)
        if (free(x, y, w, h)) {
          for (let r = y; r < y + h; r++) {
            taken[r] ??= [];
            for (let c = x; c < x + w; c++) taken[r][c] = true;
          }
          return { ...item, x, y, w, h };
        }
  });
}

/** Snap a dragged footprint (in cells) to the closest allowed size. */
export function nearestSize(w: number, h: number, allowed: readonly SizeKey[]): SizeKey {
  let best = allowed[0];
  let score = Infinity;
  for (const key of allowed) {
    const d = ((SIZES[key].w - w) / 3) ** 2 + (SIZES[key].h - h) ** 2;
    if (d < score) [best, score] = [key, d];
  }
  return best;
}

/* ---------- Smart arrange ---------- */

/** Sizes each module looks good in, best first. */
export const GOOD_SIZES: Record<ModuleId, SizeKey[]> = {
  clock: ['m', 'l', 'tall'],
  income: ['m', 's', 'l', 'wide'],
  'work-time': ['m', 's', 'wide', 'l'],
  'week-summary': ['wide', 'l', 'm'],
  tasks: ['wide', 'l', 'tall', 'm'],
  'next-task': ['m', 's', 'wide'],
  progress: ['m', 's', 'tall'],
  calendar: ['l', 'm', 'wide'],
  stolen: ['m', 's', 'tall'],
};
/** Lower comes first: actions and live money on top, reference views below. */
const IMPORTANCE: ModuleId[] = ['clock', 'income', 'work-time', 'week-summary', 'next-task', 'progress', 'tasks', 'calendar', 'stolen'];

export function layoutScore(items: BoardItem[], columns: number) {
  const placed = pack(items, columns);
  const rows = placed.reduce((m, p) => Math.max(m, p.y + p.h), 0);
  const used = placed.reduce((a, p) => a + p.w * p.h, 0);
  const holes = rows * columns - used;
  const sizeCost = items.reduce((a, i) => a + Math.max(0, GOOD_SIZES[i.id].indexOf(i.size)), 0);
  const orderCost = placed.reduce((a, p) => a + Math.max(0, p.y * columns + p.x - IMPORTANCE.indexOf(p.id) * 1.5) * 0.05, 0);
  return { holes, rows, score: holes * 100 + rows * 12 + sizeCost * 4 + orderCost };
}

/**
 * Randomly re-lay the modules already on the board: random order, random good sizes,
 * kept only when the grid has no gaps. Returns a layout different from `items` when one exists.
 */
export function smartArrange(
  items: BoardItem[],
  columns = BOARD_COLUMNS,
  random: () => number = Math.random,
): { items: BoardItem[]; holes: number } {
  if (items.length < 2) return { items: items.map((i) => ({ ...i })), holes: layoutScore(items, columns).holes };
  const fits = (k: SizeKey) => columns >= BOARD_COLUMNS || SIZES[k].nw <= columns;
  const options = (id: ModuleId) => {
    const ok = GOOD_SIZES[id].filter(fits);
    return ok.length ? ok : (['m'] as SizeKey[]);
  };
  const same = (a: BoardItem[]) => JSON.stringify(a) === JSON.stringify(items);
  let best: BoardItem[] | null = null;
  let bestScore = Infinity;
  for (let attempt = 0; attempt < 3000; attempt++) {
    const order = items.map((i) => i.id);
    for (let k = order.length - 1; k > 0; k--) {
      const j = Math.floor(random() * (k + 1));
      [order[k], order[j]] = [order[j], order[k]];
    }
    const next = order.map((id) => {
      const opts = options(id);
      // Favour each module's best sizes without making them certain.
      const pickIndex = Math.min(opts.length - 1, Math.floor(random() ** 1.6 * opts.length));
      return { id, size: opts[pickIndex] };
    });
    if (same(next)) continue;
    const { holes, rows } = layoutScore(next, columns);
    if (holes === 0) return { items: next, holes: 0 };
    const score = holes * 100 + rows;
    if (score < bestScore) [best, bestScore] = [next, score];
  }
  const fallback = best ?? items.map((i) => ({ ...i }));
  return { items: fallback, holes: layoutScore(fallback, columns).holes };
}
