/** Stable persisted IDs. Display names, emoji and search terms share one catalog. */
export const ACTIVITY_ICONS = {
  meal: { label: '吃饭', emoji: '🍚', keywords: '吃饭 午餐 早餐 晚餐 外卖 食物 饭 lunch meal' },
  fish: { label: '摸鱼', emoji: '🐟', keywords: '摸鱼 放空 休息 鱼 fish' },
  phone: { label: '刷手机', emoji: '📱', keywords: '刷手机 手机 冲浪 浏览 phone' },
  chat: { label: '聊天', emoji: '💬', keywords: '聊天 消息 八卦 chat' },
  game: { label: '游戏', emoji: '🎮', keywords: '游戏 手柄 game' },
  book: { label: '阅读', emoji: '📖', keywords: '阅读 看书 小说 book' },
  walk: { label: '散步', emoji: '👣', keywords: '散步 走路 遛弯 walk' },
  sleep: { label: '睡觉', emoji: '😴', keywords: '睡觉 小憩 午睡 发困 sleep' },
  music: { label: '听音乐', emoji: '🎧', keywords: '听音乐 耳机 听歌 播客 music' },
  video: { label: '看视频', emoji: '📺', keywords: '看视频 电视 追剧 video' },
  water: { label: '喝水', emoji: '💧', keywords: '喝水 接水 water' },
  tea: { label: '喝茶', emoji: '🍵', keywords: '喝茶 泡茶 奶茶 tea' },
  coffee: { label: '咖啡', emoji: '☕', keywords: '咖啡 coffee' },
  shopping: { label: '购物', emoji: '🛍️', keywords: '购物 买东西 逛街 shopping' },
  exercise: { label: '运动', emoji: '💪', keywords: '运动 健身 伸展 锻炼 exercise' },
  sparkles: { label: '其他', emoji: '✨', keywords: '其他 自定义 发呆 闪光 other' },
};
export const ACTIVITY_ICON_IDS = Object.keys(ACTIVITY_ICONS);
export function searchActivityIcons(query) {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/u).filter(Boolean);
  return ACTIVITY_ICON_IDS.filter(id => terms.every(term => `${ACTIVITY_ICONS[id].label} ${ACTIVITY_ICONS[id].emoji} ${ACTIVITY_ICONS[id].keywords}`.toLocaleLowerCase().includes(term)));
}
