import { hidden, type Catalog } from './define.js';

export const meta: Catalog = {
  series: [{ id: 'secret', name: '内部消息', icon: 'Sparkles', color: '#2f4a3a' }],
  titles: [
    hidden('secret', 'h-collector', '职称收藏夹本夹', '你的工牌已经挂不下了，只好再申请一个职称来装它们。',
      '已解锁任意职称累计 10 个。', { unlocked: 10 }),
  ],
};
