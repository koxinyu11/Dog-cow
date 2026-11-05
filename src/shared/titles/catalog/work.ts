import { countLadder, hidden, type Catalog } from './define.js';

export const work: Catalog = {
  series: [{ id: 'done', name: '活儿终结者', icon: 'ListChecks', color: '#3c8fd6' }],
  titles: [
    ...countLadder('done', 'done', (n) => `${n} 件不同任务首次完成，按任务去重。`, [
      ['done-1', '这活我熟', 1, '亲手送走第一件活。它走得很安详。'],
      ['done-10', '待办清道夫', 10, '送走 10 件活，没有一件是画的饼。'],
      ['done-50', '需求粉碎机', 50, '50 件活已入土。产品经理开始叫你「那位」。'],
    ]),
    hidden('secret', 'h-boomerang', '回旋镖认证工程师', '一件活被你送走又接回来。它回来的时候，带着新需求。',
      '同一任务取消完成后再次完成；只解锁一次，不重复计入完成数。', { count: 'redone', atLeast: 1 }),
    hidden('secret', 'h-museum', '拖延博物馆馆长', '一件活在你的清单里过了个周年小庆。今天终于送它出馆。',
      '任务所属日期比完成当天早至少 7 天。', { count: 'done-late', atLeast: 1 }),
  ],
};
