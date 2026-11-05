import { countLadder, hidden, type Catalog } from './define.js';

export const appUsage: Catalog = {
  series: [{ id: 'open', name: '狗牛营业天数', icon: 'CalendarHeart', color: '#c4569a' }],
  titles: [
    ...countLadder('open', 'open', (n) => `累计 ${n} 天打开过狗牛，不要求连续。`, [
      ['open-1', '狗牛新同事', 1, '第一次打开狗牛。小牛还在认人。'],
      ['open-7', '试用期观察对象', 7, '来了 7 天，小牛开始给你留草。'],
      ['open-30', '狗牛正式员工', 30, '一个月了，你的桌面已经离不开这头牛。'],
      ['open-100', '百日工位老友', 100, '100 天，你和小牛的感情比和工位还深。'],
      ['open-365', '狗牛终身股东', 365, '一整年。小牛决定把牧场分你一半（不含草）。'],
    ]),
    hidden('secret', 'h-weekend', '周末也想牛', '放假了还回来看小牛。牛很感动，但劝你出去走走。',
      '累计 3 个非排班日打开过狗牛。', { count: 'open-rest', atLeast: 3 }),
    hidden('secret', 'h-comeback', '回归的老员工', '消失了两周以上又回来了。工位还在，草也还在。',
      '两次打开之间间隔至少 14 个自然日。', { count: 'comeback', atLeast: 1 }),
  ],
};
