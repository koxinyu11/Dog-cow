export const deskRegions = ['手腕前臂', '手臂', '颈部', '胸肩', '背腰', '髋腿', '脚踝'] as const;
export type DeskRegion = (typeof deskRegions)[number];
export const supports = ['无额外支撑', '稳固无轮椅', '墙面', '桌面', '空地'] as const;

const sources = {
  sitting: 'https://www.nhs.uk/live-well/exercise/sitting-exercises/',
  strength: 'https://www.nhs.uk/live-well/exercise/strength-exercises/',
  flexibility: 'https://www.nhs.uk/live-well/exercise/flexibility-exercises/',
  balance: 'https://www.nhs.uk/live-well/exercise/balance-exercises/',
  office: 'https://www.ccohs.ca/oshanswers/ergonomics/office/stretching.html',
  chair: 'https://www.uhsussex.nhs.uk/resources/chair-exercises-with-seated-arm-exercises/',
  walk: 'https://pubmed.ncbi.nlm.nih.gov/36728338/',
} as const;

export const conditioningMetSource = 'https://pacompendium.com/conditioning-exercise/';
export const walkingMetSource = 'https://pacompendium.com/walking/';
export const movementSourcePages = [...Object.values(sources), conditioningMetSource, walkingMetSource];
export const metCategories = {
  stretch: { value: 2.3, code: '02101', label: '轻柔拉伸', source: conditioningMetSource },
  seated: { value: 2.5, code: '02140', label: '轻量跟练', source: conditioningMetSource },
  strength: { value: 3, code: '02056', label: '自重练习', source: conditioningMetSource },
  stroll: { value: 2.3, code: '17151', label: '平地慢走', source: walkingMetSource },
} as const;

type MoveOptions = {
  source: keyof typeof sources;
  anchor?: string;
  seated?: boolean;
  support?: (typeof supports)[number];
  met?: keyof typeof metCategories;
  seconds?: number;
};

function move(label: string, cue: string, dose: string, regions: readonly DeskRegion[], options: MoveOptions) {
  const { source, anchor, seated = true, support = '稳固无轮椅', met = 'stretch', seconds = 30 } = options;
  return {
    label, cue, dose, regions, seated, support, seconds,
    source: sources[source] + (anchor ? '#' + anchor : ''),
    met: metCategories[met],
  };
}

export const deskMoves = {
  march: move('坐姿交替抬膝', '坐直，双手扶椅侧。屈膝抬起一侧腿到舒服的高度，慢慢放下再换边。', '每侧最多 5 次', ['髋腿'], { source: 'sitting', anchor: 'hip-marching', met: 'seated' }),
  chest: move('坐姿扩胸', '坐直，双肩向后下方放松，双臂打开，轻轻将胸口向前上方伸展。', '每次保持 5～10 秒', ['胸肩'], { source: 'sitting', anchor: 'chest-stretch' }),
  ankle: move('坐姿踝关节屈伸', '扶住椅侧，一腿伸直、脚离地。脚尖向前伸，再向自己勾回，放下换边。', '按舒适幅度活动', ['脚踝'], { source: 'sitting', anchor: 'ankle-stretch' }),
  twist: move('坐姿转上身', '双脚踩地，双臂交叉扶肩。髋部朝前，上身缓慢转向一侧，再回正换边。', '每侧保持 5 秒', ['背腰'], { source: 'sitting', anchor: 'upper-body-twist' }),
  neck: move('坐姿转头', '坐直，放松肩膀。缓慢转头看向一侧肩膀，到舒服的位置停住，回正换边。', '每侧保持 5 秒，每侧最多 3 次', ['颈部'], { source: 'sitting', anchor: 'neck-rotation' }),
  rise: move('椅子起坐', '坐在椅子前缘，双脚与髋同宽。稍向前倾，用腿慢慢站起，目视前方，再慢慢坐回。', '最多 5 次', ['髋腿'], { source: 'strength', anchor: 'sit-to-stand', seated: false, met: 'strength' }),
  calves: move('扶椅提踵', '站在椅后，双手扶椅背。缓慢抬起双脚脚跟，到舒服的高度，再慢慢落下。', '最多 5 次', ['髋腿', '脚踝'], { source: 'strength', anchor: 'calf-raises', seated: false, met: 'seated' }),
  walk: move('起身走一走', '找一段平坦、无障碍的路，按舒适的速度走。', '可提前结束', ['髋腿', '脚踝'], { source: 'walk', seated: false, support: '空地', met: 'stroll', seconds: 180 }),
  fingers: move('手指张开与屈曲', '先张开手掌，再轻握拳，拇指留在外面。随后让指尖向掌根方向滑动，最后放松张开。', '慢慢做，避免用另一只手硬掰', ['手腕前臂'], { source: 'office' }),
  wristSide: move('手腕左右摆动', '手掌朝下、手指自然张开，前臂保持稳定，让手从手腕处轻轻向两侧摆动。', '每侧停 3～5 秒', ['手腕前臂'], { source: 'office' }),
  palmTurn: move('前臂翻掌', '向前伸出手臂，缓慢把掌心转向下，再转向上，到有轻微牵拉感即可。', '每个方向停 3～5 秒', ['手腕前臂'], { source: 'office' }),
  wristAssist: move('辅助屈伸手腕', '用另一只手轻扶手指，慢慢引导手腕向下弯，放松后再向上。力度以轻微牵拉为限。', '每个姿势停 3～5 秒', ['手腕前臂'], { source: 'office' }),
  prayer: move('合掌伸腕', '坐稳，肘部放在桌面，双掌相合。保持掌心接触，缓慢将手腕向桌面方向降低。', '保持 5～7 秒，再放松', ['手腕前臂'], { source: 'office', support: '桌面' }),
  shrug: move('耸肩放松', '将双肩慢慢向耳朵方向抬起，再放回自然位置。', '停 3～5 秒，做 2～3 次', ['胸肩', '颈部'], { source: 'office' }),
  chin: move('下巴回收', '身体坐直，视线平向前方，下巴保持水平，让头部缓慢向后滑，再放松。', '保持舒适，不低头或仰头', ['颈部'], { source: 'office' }),
  roll: move('肩部绕圈', '双臂放松，缓慢向后绕动双肩，再换向前绕。', '按舒适幅度缓慢绕动', ['胸肩'], { source: 'office' }),
  cross: move('横臂拉伸', '一臂横过胸前，用另一只手轻扶其肘上方，轻轻带向对侧，再换边。', '每侧保持约 5 秒', ['胸肩', '背腰'], { source: 'office' }),
  overheadSide: move('双臂上举侧伸', '十指交握并在舒适范围内举过头顶，上身缓慢向一侧倾，再回正换边。', '保持轻微牵拉，顺畅呼吸', ['胸肩', '背腰'], { source: 'office' }),
  seatedHeels: move('坐姿提踵抬脚尖', '坐稳，脚尖贴地抬起双脚脚跟。放下后脚跟贴地抬起脚尖，再回到平放。', '两个姿势交替，缓慢做', ['脚踝'], { source: 'chair', met: 'seated' }),
  knee: move('坐姿伸膝', '坐稳，双脚起始踩地。慢慢伸直一条腿，停一下后缓慢放下，再换腿。', '伸直时停约 5 秒', ['髋腿'], { source: 'chair', met: 'seated' }),
  reach: move('坐姿前伸回正', '坐稳，双手沿大腿方向向下伸到舒服的位置，再慢慢回到坐直。', '伸到舒适位置即可', ['背腰'], { source: 'chair' }),
  armRaise: move('坐姿交替举臂', '坐稳，慢慢抬起一只手到舒适高度，缓慢放下后换手。', '用自己舒服的幅度', ['手臂', '胸肩'], { source: 'chair', met: 'seated' }),
  elbow: move('坐姿交替屈肘', '从手臂伸直开始，弯肘把手抬到肩前，再慢慢伸肘放下，换另一侧。', '肩膀放松，慢慢做', ['手臂'], { source: 'chair', met: 'seated' }),
  squat: move('扶椅浅蹲', '扶稳椅背，双脚与髋同宽。背部保持平直，膝盖朝脚尖方向慢慢微屈，再站直。', '最多 5 次，深度以舒适为限', ['髋腿'], { source: 'strength', anchor: 'mini-squats', seated: false, met: 'strength' }),
  sideLeg: move('扶椅侧抬腿', '双手扶椅背，缓慢向侧面抬起一条腿。背和髋保持正直，放下后换腿。', '每侧最多 5 次', ['髋腿'], { source: 'strength', anchor: 'sideways-leg-lift', seated: false, met: 'seated' }),
  backLeg: move('扶椅后抬腿', '双手扶椅背，身体站直，一条腿伸直并缓慢向后抬。腰背保持自然，放下后换腿。', '每次停留最多 5 秒', ['髋腿'], { source: 'strength', anchor: 'leg-extension', seated: false, met: 'seated' }),
  wallPress: move('墙壁俯卧撑', '面对稳固墙面，双手在胸口高度贴墙。背部保持平直，缓慢屈肘靠近墙，再推回。', '以舒适幅度慢慢做', ['胸肩', '手臂'], { source: 'strength', anchor: 'wall-press-up', seated: false, support: '墙面', met: 'strength' }),
  neckSide: move('坐姿颈部侧伸', '坐直，视线朝前。一手轻扶对侧肩膀，头轻轻向扶肩那只手所在的一侧倾，回正后换边。', '每侧保持 5 秒', ['颈部'], { source: 'flexibility', anchor: 'neck-stretch' }),
  standSide: move('站姿侧弯', '双脚与髋同宽，一只手沿身体侧面缓慢向下滑，身体轻轻侧弯，回正换边。', '每侧保持约 2 秒', ['背腰'], { source: 'flexibility', anchor: 'sideways-bend', seated: false, support: '无额外支撑' }),
  calfStretch: move('扶墙小腿拉伸', '双手扶墙，一脚向后迈，前膝弯曲，后腿伸直，双脚踩实。放松后换边。', '保持后脚跟贴地，做到轻微牵拉即可', ['髋腿', '脚踝'], { source: 'flexibility', anchor: 'calf-stretch', seated: false, support: '墙面' }),
  sideStep: move('侧步走', '在平坦空地上，双膝微屈。一脚缓慢向侧面迈，另一脚跟上并拢，再换方向。', '缓慢移动，附近可有墙面作支撑', ['髋腿'], { source: 'balance', anchor: 'sideways-walking', seated: false, support: '空地', met: 'stroll' }),
} as const;

export type DeskMove = keyof typeof deskMoves;
export const deskMoveIds = Object.keys(deskMoves) as DeskMove[];
export const maxMovementSeconds = deskMoveIds.reduce((total, id) => total + deskMoves[id].seconds, 0);
export const isSeated = (move: DeskMove) => deskMoves[move].seated;
export const deskMoveSource = (move: DeskMove) => deskMoves[move].source;
