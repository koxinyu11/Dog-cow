import { hidden, type Catalog } from './define.js';
import type { LedgerId } from '../signals.js';
import type { Tier } from '../types.js';
const milestones = (series: string, ledger: LedgerId, unit: string, steps: [string, string, number, string][]) =>
  steps.map(([id, name, n, copy], index) => ({ id, name, series, tier: (index + 1) as Tier, copy,
    rule: `${unit}达到 ${n.toLocaleString('zh-CN')}。`, when: { any: ledger, atLeast: n } }));
export const games: Catalog = {
  series: [
    { id: 'game-time', name: '游玩资历', icon: 'Gamepad2', color: '#729b87' },
    { id: 'fishing', name: '工位钓鱼', icon: 'Fish', color: '#5e9ca7' },
    { id: 'poker', name: '工位德州', icon: 'Spade', color: '#b79751' },
  ],
  titles: [
    ...[ [2, '带薪休闲骨干'], [10, '摸鱼项目主管'], [30, '快乐事业部经理'], [100, '班间娱乐总监'], [300, '工位游乐场场长'] ].map(([hours, name], index) => ({
      id: `game-time-${hours}`, name: String(name), series: 'game-time', tier: (index + 1) as Tier,
      copy: `快乐已累计 ${hours} 小时，这份资历谁也拿不走。`, rule: `累计参与游玩 ${hours} 小时；挂机、暂停和离线时间不计。`,
      when: { any: 'gameActive' as const, atLeast: Number(hours) * 3_600_000 },
    })),
    ...milestones('fishing', 'fishingCaught', '累计钓到的鱼数量', [
      ['fishing-caught-50', '工位渔业专员', 50, '工位旁的小池塘，已经成了你的业务范围。'],
      ['fishing-caught-200', '带薪渔业总监', 200, '河里的鱼开会，都得先问你有没有空。'],
      ['fishing-caught-1000', '千鱼塘主', 1000, '一千条鱼，足够写满一份水下年报。'],
    ]),
    ...milestones('fishing', 'fishingFound', '图鉴发现的不同收获种类', [
      ['fishing-found-20', '水下户口调查员', 20, '河里住着谁，你比物业还清楚。'],
      ['fishing-found-50', '河湾博物馆馆长', 50, '藏品越来越多，工位越来越像博物馆。'],
      ['fishing-found-100', '百物收藏家', 100, '一百种水下见闻，够讲到下次下班。'],
    ]),
    hidden('fishing', 'fishing-mythic', '神话打捞员', '传说终于上岸，还被你签收了。', '收获至少一种神话级物种或宝物。', { any: 'fishingMythic', atLeast: 1 }),
    ...milestones('poker', 'pokerHands', '累计完成牌局手数（未结算离桌不计）', [
      ['poker-hands-50', '牌桌熟面孔', 50, '你一落座，大家就知道这局不会很快结束。'],
      ['poker-hands-200', '工位牌局主管', 200, '牌局已成项目，筹码就是进度。'],
      ['poker-hands-1000', '牌桌常驻董事', 1000, '开会未必到场，开牌从不缺席。'],
    ]),
    ...milestones('poker', 'pokerWins', '单手收入减去本手投入后净赢筹码的累计手数', [
      ['poker-wins-20', '筹码回收专员', 20, '散出去的筹码，开始认得回家的路。'],
      ['poker-wins-100', '工位读牌专家', 100, '牌面有很多话，你已经听懂了一百次。'],
    ]),
  ],
};
