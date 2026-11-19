export type Point = [number, number];
export type Limbs = { head: Point; neck: Point; hip: Point; arms: [Point[], Point[]]; legs: [Point[], Point[]] };

const standing: Limbs = {
  head: [110, 24], neck: [110, 39], hip: [110, 78],
  arms: [[[101, 44], [94, 65], [92, 84]], [[119, 44], [126, 65], [128, 84]]],
  legs: [[[101, 78], [96, 104], [94, 132], [83, 132]], [[119, 78], [124, 104], [126, 132], [137, 132]]],
};

export const handMoves = ['fingers', 'wristSide', 'palmTurn', 'wristAssist', 'prayer'] as const;
export type HandMove = (typeof handMoves)[number];
export const extraMoves = ['shrug', 'chin', 'roll', 'cross', 'overheadSide', 'seatedHeels', 'knee', 'reach', 'armRaise', 'elbow',
  'squat', 'sideLeg', 'backLeg', 'wallPress', 'neckSide', 'standSide', 'calfStretch', 'sideStep'] as const;
export type ExtraMove = (typeof extraMoves)[number];

export function expandedPose(move: ExtraMove, a: number, cycle: number, seated: Limbs): Limbs {
  const v = Math.abs(a);
  const side = a < 0 ? -1 : 1;
  const arms = (fn: (s: number) => Point[]): Limbs['arms'] => [fn(-1), fn(1)];
  const legs = (fn: (s: number) => Point[]): Limbs['legs'] => [fn(-1), fn(1)];
  const supported = { ...standing, arms: arms(s => [[110 + s * 12, 44], [110 + s * 23, 63], [110 + s * 34, 54]]) };
  switch (move) {
    case 'shrug':
    case 'roll': {
      const y = move === 'roll' ? 5 * Math.sin(cycle) : -7 * v;
      const x = move === 'roll' ? 3 * Math.cos(cycle) : 0;
      return { ...seated, arms: arms(s => [[110 + s * (13 + x), 55 + y], [110 + s * 23, 76 + y], [110 + s * 18, 95 + y / 2]]) };
    }
    case 'chin':
      return { ...seated, head: [110 - 7 * v, 34], neck: [110 - 4 * v, 49] };
    case 'cross':
      return { ...seated, arms: arms(s => s === side
        ? [[110 + s * 13, 55], [110 - s * v * 9, 59 + 12 * (1 - v)], [110 - s * v * 34, 62 + 26 * (1 - v)]]
        : [[110 + s * 13, 55], [110 + s * 21, 77], [110 + s * (12 - 11 * v), 91 - 30 * v]]) };
    case 'overheadSide': {
      const lean = a * 16;
      return { ...seated, head: [110 + lean, 34], neck: [110 + lean, 49],
        arms: arms(s => [[110 + lean + s * 13, 55], [110 + lean * 1.3 + s * 20, 27], [110 + lean * 1.5, 11]]) };
    }
    case 'seatedHeels':
      return { ...seated, legs: legs(s => [[110 + s * 9, 94], [110 + s * 23, 99],
        [110 + s * 23, 131 - 8 * Math.max(0, a)], [110 + s * 34, 131 - 8 * Math.max(0, -a)]]) };
    case 'knee':
      return { ...seated, legs: legs(s => {
        const lift = side === s ? v : 0;
        return [[110 + s * 9, 94], [110 + s * 23, 99], [110 + s * (23 + 26 * lift), 131 - 25 * lift],
          [110 + s * (34 + 26 * lift), 131 - 25 * lift]];
      }) };
    case 'reach':
      return { ...seated, head: [110 + 22 * v, 34 + 24 * v], neck: [110 + 18 * v, 49 + 22 * v],
        arms: arms(s => [[110 + s * 12 + 18 * v, 55 + 20 * v], [110 + s * 19 + 18 * v, 76 + 17 * v], [110 + s * 19 + 17 * v, 95 + 24 * v]]) };
    case 'armRaise':
    case 'elbow':
      return { ...seated, arms: arms(s => {
        const lift = side === s ? v : 0;
        return move === 'armRaise'
          ? [[110 + s * 13, 55], [110 + s * (22 + 4 * lift), 76 - 43 * lift], [110 + s * (23 + 6 * lift), 94 - 85 * lift]]
          : [[110 + s * 13, 55], [110 + s * 18, 77], [110 + s * (19 - 4 * lift), 98 - 45 * lift]];
      }) };
    case 'squat':
      return { ...supported, head: [110, 24 + 13 * v], neck: [110, 39 + 13 * v], hip: [110, 78 + 13 * v],
        arms: arms(s => [[110 + s * 12, 44 + 13 * v], [110 + s * 23, 63 + 5 * v], [110 + s * 34, 54]]),
        legs: legs(s => [[110 + s * 9, 78 + 13 * v], [110 + s * (14 + 5 * v), 104 + 6 * v], [110 + s * 16, 132], [110 + s * 27, 132]]) };
    case 'sideLeg':
    case 'backLeg':
      return { ...supported, legs: legs(s => {
        const lift = side === s ? v : 0;
        const direction = move === 'backLeg' ? -1 : s;
        return [[110 + s * 9, 78], [110 + s * 14 + direction * 12 * lift, 104 - 4 * lift],
          [110 + s * 16 + direction * 25 * lift, 132 - 10 * lift], [110 + s * 27 + direction * 25 * lift, 132 - 10 * lift]];
      }) };
    case 'wallPress': {
      const x = 93 + 19 * v;
      return { head: [x + 4, 25 + 5 * v], neck: [x, 39 + 5 * v], hip: [83 + 9 * v, 79],
        arms: [[[x, 48 + 4 * v], [112 + 12 * v, 50 + 17 * v], [149, 48]], [[x - 4, 53], [114, 58], [149, 53]]],
        legs: [[[83 + 9 * v, 79], [78 + 4 * v, 106], [73, 132], [85, 132]], [[87 + 9 * v, 78], [83 + 4 * v, 105], [78, 132], [90, 132]]] };
    }
    case 'neckSide':
      return { ...seated, head: [110 + 8 * a, 34 + 2 * v], arms: arms(s => s === side
        ? [[110 + s * 13, 55], [110 + s * 17, 73], [110 - s * 12, 55]]
        : [[110 + s * 13, 55], [110 + s * 23, 76], [110 + s * 18, 95]]) };
    case 'standSide':
      return { ...standing, head: [110 + 18 * a, 24 + 8 * v], neck: [110 + 15 * a, 39 + 7 * v],
        arms: arms(s => [[110 + s * 10 + 15 * a, 44 + 6 * v], [110 + s * 16 + 9 * a, 66 + s * a * 6],
          [110 + s * 20, 84 + s * a * 10]]) };
    case 'calfStretch': {
      const rear = 82 - 25 * v;
      return { head: [111 + 8 * v, 25], neck: [108 + 8 * v, 40], hip: [95, 80],
        arms: [[[110, 47], [129, 52], [149, 49]], [[108, 51], [129, 56], [149, 54]]],
        legs: [[[95, 80], [112 + 10 * v, 105], [109, 132], [121, 132]],
          [[95, 80], [(95 + rear) / 2, 106], [rear, 132], [rear + 12, 132]]] };
    }
    case 'sideStep': {
      const shift = 20 * a;
      return { head: [110 + shift, 24], neck: [110 + shift, 39], hip: [110 + shift, 78],
        arms: arms(s => [[110 + s * 9 + shift, 44], [110 + s * 17 + shift, 62], [110 + s * 23 + shift, 75]]),
        legs: legs(s => {
          const step = side === s ? 16 * v : 7 * v;
          return [[110 + s * 9 + shift, 78], [110 + s * (14 + step / 2) + shift, 104],
            [110 + s * (15 + step) + shift, 132], [110 + s * (24 + step) + shift, 132]];
        }) };
    }
  }
}
