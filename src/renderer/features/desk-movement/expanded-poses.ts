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
  'squat', 'sideLeg', 'backLeg', 'wallPress', 'neckSide', 'standSide', 'calfStretch', 'sideStep',
  'chinDown', 'headHands', 'forwardReach', 'behindClasp', 'overheadBack', 'backCurl', 'legLift', 'hipTwist', 'farLook', 'backBend',
  'grapevine', 'heelToe', 'oneLeg', 'stepUp', 'freeCalves', 'bottleCurl', 'quadStretch', 'standTwist', 'deskPush', 'kneeHug'] as const;
export type ExtraMove = (typeof extraMoves)[number];

const lerp = (from: Point, to: Point, t: number): Point => [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t];
/** Side-view standing figure whose hip sits at x, raised by `up`. */
function sideStanding(x: number, up = 0): Limbs {
  return { head: [x + 2, 25 - up], neck: [x, 39 - up], hip: [x, 79 - up],
    arms: [[[x, 46 - up], [x + 2, 64 - up], [x + 3, 82 - up]], [[x - 2, 46 - up], [x, 64 - up], [x + 1, 82 - up]]],
    legs: [[[x, 79 - up], [x + 3, 105 - up], [x, 132 - up], [x + 12, 132 - up]], [[x - 2, 79 - up], [x + 1, 105 - up], [x - 2, 132 - up], [x + 10, 132 - up]]] };
}

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
    case 'chinDown':
      return { ...seated, head: [110, 34 + 10 * v], neck: [110, 49 + 2 * v] };
    case 'headHands':
      return { ...seated, arms: arms(s => [[110 + s * (13 + 2 * v), 55], [110 + s * (25 + 8 * v), 36 - 2 * v], [110 + s * 6, 30]]) };
    case 'forwardReach':
      return { ...seated, head: [110, 34 + 5 * v], neck: [110, 49 + 3 * v],
        arms: arms(s => [[110 + s * 13, 55 + 3 * v], [110 + s * (20 - 10 * v), 70 - 4 * v], [110 + s * (12 - 11 * v), 86 - 20 * v]]) };
    case 'behindClasp':
      return { ...seated, arms: arms(s => [[110 + s * (13 + 3 * v), 55 + 2 * v], [110 + s * (21 - 3 * v), 77], [110 + s * (17 - 13 * v), 96 + 4 * v]]) };
    case 'overheadBack':
      return { ...seated, arms: arms(s => [[110 + s * 13, 55], [110 + s * (22 - 4 * v), 76 - 49 * v], [110 + s * (18 - 18 * v), 95 - 86 * v]]) };
    case 'backCurl':
    case 'kneeHug': {
      const curl = move === 'backCurl';
      const knee: Point = [110 + side * (23 - 9 * v), 99 - 27 * v];
      const ankle: Point = [110 + side * (23 - 6 * v), 131 - (curl ? 24 : 30) * v];
      return { ...seated,
        head: curl ? [110 + side * 8 * v, 34 + 18 * v] : seated.head, neck: curl ? [110 + side * 5 * v, 49 + 12 * v] : seated.neck,
        arms: arms(s => {
          const hand = lerp([110 + s * 18, 95], [knee[0] + s * 4, knee[1] + (curl ? 14 : 6)], v);
          return [[110 + s * 13, 55 + (curl ? 8 * v : 0)], lerp([110 + s * 23, 76], [110 + s * 22, 72], v), hand];
        }),
        legs: legs(s => s === side ? [[110 + s * 9, 94], knee, ankle, [ankle[0] + s * 11, ankle[1]]] : seated.legs[s < 0 ? 0 : 1]) };
    }
    case 'legLift':
      return { ...seated, legs: legs(s => {
        const lift = side === s ? v : 0;
        return [[110 + s * 9, 94], [110 + s * 23, 99 - 3 * lift], [110 + s * 23, 131 - 13 * lift], [110 + s * 34, 131 - 15 * lift]];
      }) };
    case 'hipTwist':
      return { ...seated, head: [110 - 6 * a, 34], neck: [110 - 3 * a, 49],
        legs: legs(s => s === side
          ? [[110 + s * 9, 94], [110 + s * (23 - 31 * v), 99 - 5 * v], [110 + s * (23 - 29 * v), 131 - 7 * v], [110 + s * (34 - 40 * v), 131 - 7 * v]]
          : seated.legs[s < 0 ? 0 : 1]),
        arms: arms(s => s === -side
          ? [[110 + s * 13, 55], [110 + s * 12, 74], [110 + s * (4 - 6 * v), 96]]
          : seated.arms[s < 0 ? 0 : 1]) };
    case 'farLook':
      return { ...seated, head: [110 + 3 * v, 34 - v] };
    case 'backBend': {
      const base = sideStanding(108);
      return { ...base, neck: [108 - 9 * v, 40], head: [108 - 14 * v, 26 + v],
        arms: [[[108 - 9 * v, 47], [96 - 8 * v, 62], [104, 74]], [[106 - 9 * v, 47], [94 - 8 * v, 63], [102, 75]]],
        legs: [[[108, 79], [113 + 2 * v, 105], [108, 132], [120, 132]], [[106, 79], [111 + 2 * v, 105], [106, 132], [118, 132]]] };
    }
    case 'grapevine': {
      const shift = 18 * a;
      return { head: [110 + shift, 24], neck: [110 + shift, 39], hip: [110 + shift, 78],
        arms: arms(s => [[110 + s * 9 + shift, 44], [110 + s * 17 + shift, 62], [110 + s * 23 + shift, 75]]),
        legs: legs(s => {
          const cross = side === s ? -20 * v : 4 * v;
          return [[110 + s * 9 + shift, 78], [110 + s * (12 + cross / 2) + shift, 104],
            [110 + s * (14 + cross) + shift, 132], [110 + s * (23 + cross) + shift, 132]];
        }) };
    }
    case 'heelToe': {
      const step = 13 * a;
      return { ...sideStanding(110),
        arms: arms(s => [[110 + s * 3, 46], [110 + s * 20, 58], [110 + s * 34, 63]]),
        legs: [[[110, 79], [110 + step / 2, 105], [110 + step, 132], [121 + step, 132]], [[110, 79], [110 - step / 2, 105], [110 - step, 132], [121 - step, 132]]] };
    }
    case 'oneLeg': {
      const base = sideStanding(102);
      return { ...base, arms: [[[102, 46], [126, 49], [149, 50]], [[100, 47], [125, 52], [149, 53]]],
        legs: [[[102, 79], [104, 105], [102, 132], [114, 132]], [[100, 79], [100 + 16 * v, 105 - 14 * v], [101 + 2 * v, 132 - 24 * v], [113 + 2 * v, 132 - 24 * v]]] };
    }
    case 'stepUp': {
      const x = 98 + 22 * v;
      const base = sideStanding(x, 14 * v);
      const lead: Point = lerp([98, 132], [130, 118], Math.min(1, v * 1.6));
      const trail: Point = lerp([96, 132], [126, 118], Math.max(0, v * 1.6 - .6));
      return { ...base, head: [x + 2, 28 - 14 * v], legs: [
        [[x, 79 - 14 * v], [(x + lead[0]) / 2 + 8, (79 - 14 * v + lead[1]) / 2 - 4], lead, [lead[0] + 12, lead[1]]],
        [[x - 2, 79 - 14 * v], [(x + trail[0]) / 2 + 4, (79 - 14 * v + trail[1]) / 2], trail, [trail[0] + 12, trail[1]]],
      ] };
    }
    case 'freeCalves': {
      const up = 7 * v;
      return { ...standing, head: [110, 24 - up], neck: [110, 39 - up], hip: [110, 78 - up],
        arms: arms(s => [[110 + s * 9, 44 - up], [110 + s * 18, 63 - up], [110 + s * 24, 80 - up]]),
        legs: legs(s => [[110 + s * 9, 78 - up], [110 + s * 14, 104 - up], [110 + s * 16, 132 - up], [110 + s * 27, 132]]) };
    }
    case 'bottleCurl':
      return { ...seated, arms: arms(s => [[110 + s * 13, 55], [110 + s * 19, 77], [110 + s * (20 - 4 * v), 98 - 42 * v]]) };
    case 'quadStretch': {
      const base = sideStanding(106);
      const ankle: Point = [104 - 20 * v, 132 - 42 * v];
      return { ...base,
        arms: [[[106, 46], [124, 58], [140, 70]], [[104, 47], [100 - 6 * v, 66], [ankle[0] + 2, ankle[1] + 2]]],
        legs: [[[106, 79], [109, 105], [106, 132], [118, 132]], [[104, 79], [106 - 2 * v, 106], ankle, [ankle[0] + 10 - 4 * v, ankle[1] + 4 * v]]] };
    }
    case 'standTwist':
      return { ...standing, head: [110 + 6 * a, 24], neck: [110 + 4 * a, 39],
        arms: [[[101 + 8 * a, 44], [104 + 10 * a, 58], [119 + 6 * a, 47]], [[119 + 8 * a, 44], [116 + 10 * a, 60], [101 + 6 * a, 48]]] };
    case 'deskPush': {
      const shoulder: Point = [112 + 12 * v, 54 + 9 * v];
      const hip: Point = [92 + 6 * v, 92 + 4 * v];
      const elbow = (offset: number): Point => [(shoulder[0] + 142) / 2 - 4 * v + offset, (shoulder[1] + 72) / 2 + 12 * v];
      return { head: [shoulder[0] + 8, shoulder[1] - 12], neck: shoulder, hip,
        arms: [[shoulder, elbow(0), [142, 72]], [[shoulder[0] - 3, shoulder[1] + 2], elbow(-3), [140, 73]]],
        legs: [[hip, [82 + 3 * v, 112], [72, 132], [84, 132]], [[hip[0] - 2, hip[1]], [80 + 3 * v, 113], [69, 132], [81, 132]]] };
    }
  }
}
