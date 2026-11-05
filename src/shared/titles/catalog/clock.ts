import { countLadder, hidden, type Catalog } from './define.js';

export const clock: Catalog = {
  series: [
    { id: 'clockin', name: '打卡营业部', icon: 'AlarmClock', color: '#e2735a' },
    { id: 'ontime', name: '准点撤离学', icon: 'DoorOpen', color: '#5b6fe0' },
    { id: 'friday', name: '周五生存学', icon: 'PartyPopper', color: '#46a898' },
  ],
  titles: [
    ...countLadder('clockin', 'clockin', (n) => `累计 ${n} 天成功上班打卡，按日期去重。`, [
      ['clockin-1', '今日已开机', 1, '第一次把自己插上电源。'],
      ['clockin-5', '工位常驻嘉宾', 5, '连续出场 5 天（不连续也算，牛不记仇）。'],
      ['clockin-20', '营业部编外主任', 20, '打卡机已经认得你的指纹和黑眼圈。'],
    ]),
    ...countLadder('ontime', 'ontime', (n) => `累计 ${n} 天在排班结束后 0–10 分钟内下班打卡；弹性、非工作日和全天请假不计。`, [
      ['offwork-1', '到点就走', 1, '下班铃响后 10 分钟内消失。像一阵风。'],
      ['offwork-5', '准点撤离专家', 5, '5 次在老板说「那个谁」之前离开。'],
      ['offwork-20', '下班时间管理大师', 20, '你的工位椅已学会自己转回去。'],
    ]),
    ...countLadder('friday', 'friday', (n) => `累计 ${n} 个排班工作日的周五有下班记录。`, [
      ['friday-1', '周五幸存者', 1, '活着走出了一个周五。'],
      ['friday-4', '周末接引员', 4, '亲手把 4 个周末接回了家。'],
      ['friday-12', '星期五荣誉居民', 12, '周五已为你颁发永久居住证。'],
    ]),
    hidden('secret', 'h-exact', '踩点艺术家', '3 次精确卡在规定时间那一分钟。分秒不差，也分秒不早。',
      '累计 3 天上班打卡与排班开始时间在同一分钟内。', { count: 'exact', atLeast: 3 }),
    hidden('secret', 'h-monday', '周一抗体携带者', '4 个周一都没能打倒你，周一开始怀疑自己。',
      '累计 4 个排班工作日的周一成功上班打卡。', { count: 'monday', atLeast: 4 }),
  ],
};
