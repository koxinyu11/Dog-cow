import { useEffect, useState } from 'react';
import { deskMoves, type DeskMove } from '../../../shared/desk-movement';
import { expandedPose, extraMoves, handMoves, type ExtraMove, type HandMove, type Limbs, type Point } from './expanded-poses';
import { MovementHands } from './MovementHands';

const baseline: Limbs = {
  head: [110, 34], neck: [110, 49], hip: [110, 94],
  arms: [[[97, 55], [86, 78], [91, 96]], [[123, 55], [134, 78], [129, 96]]],
  legs: [[[101, 94], [87, 99], [87, 131], [76, 131]], [[119, 94], [133, 99], [133, 131], [144, 131]]],
};

function pose(move: DeskMove, amount: number, ankleFlex: number, cycle: number): Limbs {
  if ((extraMoves as readonly DeskMove[]).includes(move)) return expandedPose(move as ExtraMove, amount, cycle, baseline);
  const sign = Math.sign(amount);
  const v = Math.abs(amount);
  switch (move) {
    case 'march': {
      const raised = (side: number): Point[] => {
        const lift = side === sign ? v : 0;
        const x = 110 + side * 23;
        return [[110 + side * 9, 94], [x, 99 - 17 * lift], [x, 131 - 17 * lift], [x + side * 11, 131 - 17 * lift]];
      };
      return { ...baseline, legs: [raised(-1), raised(1)] };
    }
    case 'chest':
      return { ...baseline, arms: [
        [[97, 55], [86 - 18 * v, 78 - 8 * v], [91 - 38 * v, 96 - 15 * v]],
        [[123, 55], [134 + 18 * v, 78 - 8 * v], [129 + 38 * v, 96 - 15 * v]],
      ] };
    case 'ankle': {
      const raised = (side: number): Point[] => {
        const lift = side === sign ? v : 0;
        const heel: Point = [110 + side * (23 + 25 * lift), 131 - 25 * lift];
        return [[110 + side * 9, 94], [110 + side * 23, 99], heel, [heel[0] + side * 11, heel[1] + lift * ankleFlex]];
      };
      return { ...baseline, legs: [raised(-1), raised(1)] };
    }
    case 'neck':
      return baseline;
    case 'twist':
      return { ...baseline, head: [110 + amount * 5, 34], neck: [110 + amount * 4, 49],
        arms: [
          [[97 + 10 * amount, 55], [100 + 13 * amount, 73], [120 + 6 * amount, 57]],
          [[123 + 10 * amount, 55], [120 + 13 * amount, 76], [100 + 6 * amount, 57]],
        ] };
    case 'rise': {
      const lift = v * 25;
      const lean = Math.sin(v * Math.PI) * 12;
      return { head: [110 + lean, 34 - lift], neck: [110 + lean, 49 - lift], hip: [110, 94 - lift],
        arms: [[[102 + lean, 56 - lift], [98 + lean, 78 - lift], [100 + lean, 91 - lift]], [[118 + lean, 56 - lift], [122 + lean, 78 - lift], [124 + lean, 91 - lift]]],
        legs: [[[101, 94 - lift], [87 + 11 * v, 99 - lift / 3], [87, 131], [76, 131]], [[119, 94 - lift], [133 - 11 * v, 99 - lift / 3], [133, 131], [144, 131]]] };
    }
    case 'calves': {
      const lift = v * 7;
      return { head: [110, 22 - lift], neck: [110, 37 - lift], hip: [110, 79 - lift],
        arms: [[[97, 42 - lift], [84, 62], [78, 54]], [[123, 42 - lift], [138, 62], [145, 54]]],
        legs: [[[101, 79 - lift], [96, 105 - lift], [94, 131 - lift], [82, 131]], [[119, 79 - lift], [124, 105 - lift], [126, 131 - lift], [138, 131]]] };
    }
    case 'walk':
      return { head: [110, 22], neck: [110, 37], hip: [108, 82],
        arms: [[[105, 42], [98 + 13 * amount, 65], [100 + 20 * amount, 76]], [[115, 42], [117 - 13 * amount, 65], [119 - 20 * amount, 76]]],
        legs: [[[103, 82], [101 + 12 * amount, 107], [98 + 25 * amount, 131], [109 + 25 * amount, 131]], [[113, 82], [114 - 12 * amount, 107], [117 - 25 * amount, 131], [128 - 25 * amount, 131]]] };
  }
  return baseline;
}

function movementAmount(move: DeskMove, seconds: number) {
  if (move === 'walk') return Math.sin(seconds * 4);
  const hold = ['chest', 'neck', 'twist', 'cross', 'neckSide', 'knee', 'backLeg', 'prayer'].includes(move) ? 5 :
    ['ankle', 'wristSide', 'wristAssist', 'palmTurn', 'shrug'].includes(move) ? 3 : 0;
  const duration = hold + 4;
  const phase = seconds % duration;
  const alternating: readonly DeskMove[] = ['neck', 'twist', 'march', 'ankle', 'wristSide', 'wristAssist', 'palmTurn',
    'cross', 'overheadSide', 'seatedHeels', 'knee', 'armRaise', 'elbow', 'sideLeg', 'backLeg', 'neckSide', 'standSide', 'sideStep'];
  const direction = alternating.includes(move) && Math.floor(seconds / duration) % 2 === 1 ? -1 : 1;
  return direction * Math.max(0, Math.min(1, phase / 2, (duration - phase) / 2));
}

const line = (points: Point[]) => points.map(point => point.join(',')).join(' ');
export function MovementDiagram({ move, elapsed = 0, playing = false }: { move: DeskMove; elapsed?: number; playing?: boolean }) {
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [showEnd, setShowEnd] = useState(false);
  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  const amount = reduced ? (showEnd ? 1 : 0) : movementAmount(move, elapsed / 1000);
  const ankleFlex = reduced ? -10 : 10 * Math.cos(Math.max(0, Math.min(1, (elapsed / 1000 % 7 - 2) / 3)) * Math.PI);
  const cycle = reduced ? (showEnd ? Math.PI / 2 : 0) : elapsed / 600;
  const { head, neck, hip, arms, legs } = pose(move, amount, ankleFlex, cycle);
  const support = deskMoves[move].support;
  const closeup = (handMoves as readonly DeskMove[]).includes(move);
  const chair = ['calves', 'squat', 'sideLeg', 'backLeg'].includes(move)
    ? 'M76 54H144V104H76ZM82 105v27m56-27v27'
    : 'M79 60v39h62V60m-57 39v34m52-34v34';
  return <div className="movement-picture">
    {closeup ? <MovementHands move={move as HandMove} amount={amount} phase={cycle} /> : <svg className="desk-movement-diagram" viewBox="0 0 220 150" aria-hidden="true">
      <path d="M48 134h124" className="movement-ground" />
      {support === '稳固无轮椅' && <path className="movement-chair" d={chair} />}
      {support === '墙面' && <path className="movement-chair" d="M151 25v108m0-19 12-11m-12-13 12-11m-12-13 12-11" />}
      <circle cx={head[0]} cy={head[1]} r="12" className="movement-head" />
      <path d={`M${head[0] + (move === 'neck' || move === 'twist' ? amount * 7 : 0)} ${head[1] + 1}h2`} className="movement-person" />
      <polyline points={line([neck, hip])} className="movement-person" />
      {[...arms, ...legs].map((points, index) => <polyline key={index} points={line(points)} className="movement-person" />)}
    </svg>}
    {reduced && playing && <button type="button" onClick={() => setShowEnd(value => !value)}>{showEnd ? '起始姿势' : '动作姿势'}</button>}
  </div>;
}
