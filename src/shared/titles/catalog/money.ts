import { hidden, sumLadder, type Catalog } from './define.js';

const yuan = (cents: number) => `¥${(cents / 100).toLocaleString('zh-CN')}`;
const total = (ledger: Readonly<Record<string, number | string>>) =>
  Object.values(ledger).reduce<number>((sum, value) => sum + (typeof value === 'number' ? value : 0), 0);

export const money: Catalog = {
  series: [
    { id: 'steal', name: '摸鱼小金库', icon: 'PiggyBank', color: '#7a5bc4' },
    { id: 'owed', name: '讨薪进度', icon: 'HandCoins', color: '#c0392b', silent: true },
  ],
  titles: [
    ...sumLadder('steal', 'steal', (n) => `开启偷时间的日子里，每日偷出金额（估算）累计达到 ${yuan(n)}；不是额外工资。`, [
      ['steal-1', '第一块钢镚', 100, '偷到第一块钱。老板没发现，小牛发现了。'],
      ['steal-100', '零钱罐保管员', 10_000, '偷够一顿火锅的钱，锅底自选。'],
      ['steal-1000', '带薪发呆理财师', 100_000, '这一千块，是你一分一秒发呆攒下的。'],
      ['steal-5000', '摸鱼小金库行长', 500_000, '小金库开了分行，行长是你。'],
      ['steal-20000', '摸鱼界巴菲特', 2_000_000, '你的长期主义，用在了不上班上。'],
    ]),
    ...sumLadder('owed', 'owed', (n) => `“老板欠我钱”累计（估算）达到 ${yuan(n)}；仅作记录，不代表实际收入。`, [
      ['owed-1', '老实牛马', 100, '第一笔加班账，记下了。'],
      ['owed-100', '隐形加班侠', 10_000, '没人看见的加班，小牛都看见了。'],
      ['owed-500', '讨薪预备役', 50_000, '账本越来越厚，底气越来越足。'],
      ['owed-2000', '讨薪先锋', 200_000, '这笔账，够老板请全组喝一个月奶茶。'],
      ['owed-10000', '资本家克星', 1_000_000, '一万块的加班，记在你的功劳簿上。'],
    ]),
    hidden('secret', 'h-coffee', '一杯奶茶自由', '今天偷出的钱够买一杯奶茶。少糖，去冰，记得是估算。',
      '单日偷出金额（估算）首次达到 ¥20。', { any: 'steal', atLeast: 2000 }),
    hidden('secret', 'h-pi', '圆周率会计', '小金库停在 314 块，非常圆，非常无理。',
      '累计偷出金额（估算）落在 ¥314.00–¥314.99。', { custom: (v) => { const n = total(v.ledger('steal')); return n >= 31400 && n <= 31499; } }),
  ],
};
