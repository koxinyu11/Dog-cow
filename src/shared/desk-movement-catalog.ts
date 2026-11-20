export const deskRegions = ['手腕前臂', '手臂', '颈部', '胸肩', '背腰', '髋腿', '脚踝'] as const;
export type DeskRegion = (typeof deskRegions)[number];
export const supports = ['无额外支撑', '稳固无轮椅', '墙面', '桌面', '空地', '台阶'] as const;

const sources = {
  sitting: 'https://www.nhs.uk/live-well/exercise/sitting-exercises/',
  strength: 'https://www.nhs.uk/live-well/exercise/strength-exercises/',
  flexibility: 'https://www.nhs.uk/live-well/exercise/flexibility-exercises/',
  balance: 'https://www.nhs.uk/live-well/exercise/balance-exercises/',
  office: 'https://www.ccohs.ca/oshanswers/ergonomics/office/stretching.html',
  chair: 'https://www.uhsussex.nhs.uk/resources/chair-exercises-with-seated-arm-exercises/',
  walk: 'https://pubmed.ncbi.nlm.nih.gov/36728338/',
  mayo: 'https://www.mayoclinichealthsystem.org/hometown-health/speaking-of-health/dont-just-sit-there-exercises-for-the-office',
} as const;

export const conditioningMetSource = 'https://pacompendium.com/conditioning-exercise/';
export const walkingMetSource = 'https://pacompendium.com/walking/';
export const inactivityMetSource = 'https://pacompendium.com/inactivity/';
export const movementSourcePages = [...Object.values(sources), conditioningMetSource, walkingMetSource, inactivityMetSource];
export const metCategories = {
  stretch: { value: 2.3, code: '02101', label: '轻柔拉伸', source: conditioningMetSource },
  seated: { value: 2.5, code: '02140', label: '轻量跟练', source: conditioningMetSource },
  strength: { value: 3, code: '02056', label: '自重练习', source: conditioningMetSource },
  stroll: { value: 2.3, code: '17151', label: '平地慢走', source: walkingMetSource },
  rest: { value: 1, code: '07021', label: '安静坐姿', source: inactivityMetSource },
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
  chinDown: move('低头放松颈后', '坐直，肩膀放松。慢慢低头让下巴靠近胸口，颈后有轻微牵拉时停住，再慢慢抬头回正。', '保持 10～20 秒，正常呼吸', ['颈部'], { source: 'office' }),
  headHands: move('抱头扩胸', '双手放在脑后，手肘向两侧打开，轻轻夹紧肩胛骨，再放松。', '不用力压头，正常呼吸', ['胸肩'], { source: 'office' }),
  forwardReach: move('双臂前推伸背', '十指交握，手臂伸直向前推，背部微微拱起，感到肩胛之间轻微牵拉。', '保持 10～20 秒，不弹振', ['背腰', '胸肩'], { source: 'office' }),
  behindClasp: move('背后扣手扩胸', '双手在身后交握，手臂向后下方伸，胸口轻轻向前打开。', '保持 10～20 秒，肩膀放松', ['胸肩'], { source: 'office' }),
  overheadBack: move('双臂上举后伸', '十指交握，手臂伸直举过头顶，在舒适范围内把手臂向后推。', '手肘伸直但不锁死，正常呼吸', ['胸肩', '背腰'], { source: 'office' }),
  backCurl: move('抱腿卷背', '坐稳，双手抱住一侧小腿，把脚抬离地面。背部向前卷，额头靠近膝盖，放下后换腿。', '幅度以舒适为限，慢慢做', ['背腰', '髋腿'], { source: 'office' }),
  legLift: move('坐姿直腿抬起', '坐在椅子前部，背不靠椅背，双脚平放。一条腿伸直，把脚抬离地面几厘米，稍停后放下，再换腿。', '每次稍停，左右交替', ['髋腿'], { source: 'office', met: 'seated' }),
  hipTwist: move('坐姿跷腿转体', '一条腿搭在另一条腿上，用手臂或手肘抵住上方腿的外侧，轻轻施压，同时看向反方向，再换边。', '每侧保持 10～20 秒', ['髋腿', '背腰'], { source: 'office' }),
  farLook: move('远眺放松眼睛', '视线离开屏幕，看向远处的物体，放松眼睛、肩膀和呼吸。', '看远处约 20 秒', ['颈部'], { source: 'office', met: 'rest' }),
  backBend: move('站姿扶腰后仰', '站立，双膝微屈，双手放在后腰。手轻轻向前推，身体稍向后仰，再回正。', '幅度小，保持 10～20 秒', ['背腰'], { source: 'office', seated: false, support: '无额外支撑' }),
  grapevine: move('交叉步', '站直，右脚从左脚前方交叉跨过，左脚跟上并拢，向侧面移动，再换方向。', '每侧约 5 步，需要时用手指扶墙', ['髋腿'], { source: 'balance', anchor: 'simple-grapevine', seated: false, support: '空地', met: 'stroll' }),
  heelToe: move('脚跟接脚尖走', '站直，把右脚跟放在左脚尖正前方，再把左脚跟放到右脚尖前，视线始终朝前。', '至少 5 步，需要时用手指扶墙', ['髋腿', '脚踝'], { source: 'balance', anchor: 'heel-to-toe-walk', seated: false, support: '空地', met: 'stroll' }),
  oneLeg: move('扶墙单腿站', '面向墙站立，手臂前伸、指尖触墙。抬起一条腿，髋部保持水平，支撑腿微屈，再轻放回地面。', '每次 5～10 秒，每侧 3 次', ['髋腿', '脚踝'], { source: 'balance', anchor: 'one-leg-stand', seated: false, support: '墙面', met: 'seated' }),
  stepUp: move('台阶上下', '找一级稳固的台阶，最好有扶手或靠墙。右脚踏上，左脚跟上，再依次退下。', '每侧最多 5 次，慢慢做', ['髋腿'], { source: 'balance', anchor: 'step-up', seated: false, support: '台阶', met: 'strength' }),
  freeCalves: move('原地提踵', '不扶椅子站稳，双脚与髋同宽。缓慢抬起双脚脚跟，再慢慢落下。', '最多 5 次，身边留好可扶的墙或椅子', ['髋腿', '脚踝'], { source: 'strength', anchor: 'calf-raises', seated: false, support: '无额外支撑', met: 'seated' }),
  bottleCurl: move('水瓶屈臂', '双手各握一瓶装满水的瓶子，手臂贴在身侧。慢慢屈肘把瓶子抬向肩部，再慢慢放下。', '每侧约 5 次，慢上慢下', ['手臂'], { source: 'strength', anchor: 'biceps-curls', met: 'strength' }),
  quadStretch: move('扶桌拉伸大腿前侧', '站立，一手扶稳桌子。弯曲一条腿，用同侧手抓住脚踝，轻轻拉向臀部，再换边。', '每侧保持 15 秒左右', ['髋腿'], { source: 'mayo', seated: false, support: '桌面' }),
  standTwist: move('站姿抱臂转体', '双脚与髋同宽，双臂交叉抱在胸前。上身缓慢转向一侧，停住，再转向另一侧。', '髋部朝前，按舒适幅度转', ['背腰'], { source: 'mayo', seated: false, support: '无额外支撑' }),
  deskPush: move('扶桌俯卧撑', '双手撑在稳固的桌沿，双脚后退，身体成一条直线。屈肘让胸口靠近桌沿，再推回。', '背部保持平直，以舒适幅度慢慢做', ['胸肩', '手臂'], { source: 'mayo', seated: false, support: '桌面', met: 'strength' }),
  kneeHug: move('坐姿抱膝', '坐直，把一侧膝盖抬向胸口，双手抱住大腿后侧轻轻拉近。背保持挺直，不前倾，再换腿。', '每侧保持约 15 秒', ['髋腿', '背腰'], { source: 'mayo' }),
} as const;

export type DeskMove = keyof typeof deskMoves;
export const deskMoveIds = Object.keys(deskMoves) as DeskMove[];
export const maxMovementSeconds = deskMoveIds.reduce((total, id) => total + deskMoves[id].seconds, 0);
export const isSeated = (move: DeskMove) => deskMoves[move].seated;
export const deskMoveSource = (move: DeskMove) => deskMoves[move].source;
