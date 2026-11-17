import { Waves } from 'lucide-react';
import type { FishingTide } from '../../../../../shared/fishing-tide';

export const tideLabel = (tide: FishingTide) => tide.phase === 'peak' ? '鱼汛旺盛' : tide.phase === 'rising' ? '鱼群聚集'
  : tide.phase === 'falling' ? '鱼汛渐退' : tide.activity >= .3 ? '鱼群活跃' : '鱼群平稳';
export function Tide({ tide }: { tide: FishingTide }) {
  const active = tide.activity >= .3;
  const abundant = tide.activity >= .75;
  const groups = [
    ['普通鱼', active ? '鱼群穿梭' : '活动正常'],
    ['稀有鱼', abundant ? '格外活跃' : active ? '更活跃' : '偶尔游过'],
    ['神秘踪迹', abundant ? '踪迹渐多' : '偶有踪迹'],
  ];
  return <div className="df-tide-panel">
    <div className="df-tide-summary"><Waves size={24}/><strong>{tideLabel(tide)}</strong></div>
    <dl className="df-tide-groups">{groups.map(([name, activity]) => <div key={name}><dt>{name}</dt><dd>{activity}</dd></div>)}</dl>
  </div>;
}
