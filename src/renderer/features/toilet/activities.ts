import { BedDouble, BookOpen, Cigarette, Coffee, Dumbbell, Droplet, Fish, Footprints, Gamepad2, Headphones, Leaf, MessageCircle, ShoppingBag, Smartphone, Sparkles, Toilet, Tv, Utensils, type LucideIcon } from 'lucide-react';
import type { ActivityKind, CustomActivity, CustomActivityIcon, ToiletState } from '../../../shared/contracts';

import { ACTIVITY_ICONS } from '../../../../app/income/src/activity-icons.js';

/** Presentation only. All activities use the same command and calculation path. */
export const ACTIVITIES = {
  toilet: { label: '带薪拉屎', Icon: Toilet, emoji: '💩', runningEmoji: '🚽', start: '开始蹲班', end: '拉完了', color: '#56865b', idle: '换个工位，继续领薪。', running: '人在隔间，薪在工位。' },
  smoking: { label: '抽烟', Icon: Cigarette, emoji: '🚬', runningEmoji: '🚬', start: '去抽一根', end: '抽完了', color: '#a17854', idle: '离开工位，透一口气。', running: '烟在飘，时间在计价。' },
  coffee: { label: '买咖啡', Icon: Coffee, emoji: '☕', runningEmoji: '☕', start: '去买咖啡', end: '回工位了', color: '#b67a45', idle: '去接一杯续航。', running: '等一杯咖啡，也在领薪。' },
  custom: { label: '带薪自定义', Icon: Sparkles, emoji: '✨', runningEmoji: '✨', start: '开始', end: '结束', color: '#8271b3', idle: '给摸鱼起个名字。', running: '休息一下，时间照样计价。' },
} satisfies Record<ActivityKind, object>;
export const ACTIVITY_KEYS = Object.keys(ACTIVITIES) as ActivityKind[];

export const CUSTOM_ICON_COMPONENTS = {
  meal: Utensils, fish: Fish, phone: Smartphone, chat: MessageCircle,
  game: Gamepad2, book: BookOpen, walk: Footprints, sleep: BedDouble,
  music: Headphones, video: Tv, water: Droplet, tea: Leaf,
  coffee: Coffee, shopping: ShoppingBag, exercise: Dumbbell, sparkles: Sparkles,
} satisfies Record<CustomActivityIcon, LucideIcon>;

export function getActivity(kind: ActivityKind, custom?: CustomActivity | null) {
  const base = ACTIVITIES[kind];
  if (kind !== 'custom' || !custom) return base;
  const icon = ACTIVITY_ICONS[custom.icon];
  const Icon = CUSTOM_ICON_COMPONENTS[custom.icon];
  return { ...base, label: custom.name, Icon, emoji: icon.emoji, runningEmoji: icon.emoji };
}

export function currentActivity(kind: ActivityKind, data?: ToiletState) {
  const active = data?.records.find(item => item.kind === kind && item.status !== 'completed');
  return getActivity(kind, active?.customActivity ?? data?.customActivity);
}
