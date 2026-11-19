// One icon per body region and support type; every desk-movement view reads from here.
import type { CSSProperties } from 'react';
import { Armchair, BicepsFlexed, BrickWall, ChevronsUp, Footprints, Grid3x3, Hand, Move, PersonStanding, Shirt, Spline, Table2, UserRound, type LucideIcon } from 'lucide-react';
import type { DeskRegion, supports } from '../../../shared/desk-movement';

export type DeskSupport = (typeof supports)[number];

export const regionIcons: Record<DeskRegion, LucideIcon> = {
  手腕前臂: Hand,
  手臂: BicepsFlexed,
  颈部: UserRound,
  胸肩: Shirt,
  背腰: Spline,
  髋腿: PersonStanding,
  脚踝: Footprints,
};

export const supportIcons: Record<DeskSupport, LucideIcon> = {
  无额外支撑: Move,
  稳固无轮椅: Armchair,
  墙面: BrickWall,
  桌面: Table2,
  空地: Grid3x3,
  台阶: ChevronsUp,
};

export const supportLabels: Record<DeskSupport, string> = {
  无额外支撑: '原地',
  稳固无轮椅: '椅子',
  墙面: '墙面',
  桌面: '桌面',
  空地: '空地',
  台阶: '台阶',
};

export const safetyNote: Record<DeskSupport, string> = {
  无额外支撑: '',
  稳固无轮椅: '使用稳固的无轮椅。',
  桌面: '使用稳固桌面，坐稳后开始。',
  墙面: '使用稳固墙面。',
  空地: '确认地面平坦、周围无障碍。',
  台阶: '使用稳固台阶，最好有扶手或靠墙。',
};

/** Module accent; the board registry and the stylesheet (via --dm-base) both read this. */
export const DESK_MOVEMENT_ACCENT = '#29866e';
export const accentStyle = { '--dm-base': DESK_MOVEMENT_ACCENT } as CSSProperties;

/** Icon sizes by role: tag = chips/labels, btn = buttons/headings, hero = primary controls, badge = celebration. */
export const ICON = { tag: 13, btn: 16, hero: 22, badge: 34 } as const;
export const STROKE = 2;
