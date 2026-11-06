import { Cigarette, Coffee, Toilet } from 'lucide-react';
import type { ActivityKind } from '../../../shared/contracts';

/** Presentation only. All three activities use the same command and calculation path. */
export const ACTIVITIES = {
  toilet: { label: '带薪拉屎', Icon: Toilet, emoji: '💩', runningEmoji: '🚽', start: '开始蹲班', end: '拉完了', color: '#56865b', idle: '换个工位，继续领薪。', running: '人在隔间，薪在工位。' },
  smoking: { label: '抽烟', Icon: Cigarette, emoji: '🚬', runningEmoji: '🚬', start: '去抽一根', end: '抽完了', color: '#a17854', idle: '离开工位，透一口气。', running: '烟在飘，时间在计价。' },
  coffee: { label: '买咖啡', Icon: Coffee, emoji: '☕', runningEmoji: '☕', start: '去买咖啡', end: '回工位了', color: '#b67a45', idle: '去接一杯续航。', running: '等一杯咖啡，也在领薪。' },
} satisfies Record<ActivityKind, object>;
export const ACTIVITY_KEYS = Object.keys(ACTIVITIES) as ActivityKind[];
