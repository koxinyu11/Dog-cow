import { addDays } from '../../../domain/tasks/model.js';
import { countLadder, hidden, type Catalog } from './define.js';

/** Most days any single dish was confirmed. */
export const topDish = (lunch: Readonly<Record<string, number | string>>) => {
  const days = new Map<string, number>();
  for (const dish of Object.values(lunch)) if (typeof dish === 'string') days.set(dish, (days.get(dish) ?? 0) + 1);
  let best = { dish: '', days: 0 };
  for (const [dish, count] of days) if (count > best.days) best = { dish, days: count };
  return best;
};

/** True if any 7 consecutive days hold at least 5 distinct moods. */
export const moodVariety = (mood: Readonly<Record<string, number | string>>) =>
  Object.keys(mood).some((start) => {
    const seen = new Set<string>();
    for (let i = 0; i < 7; i++) {
      const value = mood[addDays(start, i)];
      if (typeof value === 'string') seen.add(value);
    }
    return seen.size >= 5;
  });

export const fun: Catalog = {
  series: [
    { id: 'mood', name: '情绪观察站', icon: 'Coffee', color: '#dd858a' },
    { id: 'lunch', name: '午餐决策局', icon: 'UtensilsCrossed', color: '#e28b47' },
  ],
  titles: [
    ...countLadder('mood', 'mood', (n) => `累计 ${n} 天保存精神状态；所有状态等价，按日期去重。`, [
      ['mood-1', '状态已上报', 1, '向组织汇报了一次精神状况。组织表示收到。'],
      ['mood-7', '情绪气象员', 7, '播报 7 天心情天气，暴雨也算播报。'],
      ['mood-30', '精神状态研究员', 30, '30 天样本，足够写一篇没人审的论文。'],
    ]),
    ...countLadder('lunch', 'lunch', (n) => `累计 ${n} 天成功确认午餐，重抽不计。`, [
      ['lunch-1', '今天就吃这个', 1, '做出今天第一个、也是最难的决定。'],
      ['lunch-5', '午餐决策委员', 5, '5 个中午没有因为纠结而饿着。'],
      ['lunch-20', '中午吃啥局局长', 20, '全公司的「中午吃啥」都该来问你。'],
    ]),
    hidden('secret', 'h-nail', '同一道菜钉子户', '同一道菜吃了 5 天。菜单在你面前失去了意义。',
      '同一个菜名累计确认 5 天。', { custom: (v) => topDish(v.ledger('lunch')).days >= 5 },
      (v) => { const dish = topDish(v.ledger('lunch')).dish; return dish ? `${[...dish].slice(0, 6).join('')}钉子户` : null; }),
    hidden('secret', 'h-mixer', '精神状态调色盘', '一周换了 5 种状态。情绪很丰富，牛很坚强。',
      '连续 7 个自然日内记录了至少 5 种不同的精神状态。', { custom: (v) => moodVariety(v.ledger('mood')) }),
    hidden('secret', 'h-dreamer', '盼头囤积户', '同时攒下 5 个盼头。打工的动力，已经囤够一季度。',
      '盼头清单里同时有至少 5 个未过期的盼头。', { any: 'hopes', atLeast: 5 }),
  ],
};
