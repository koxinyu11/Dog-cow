// Scenes for the wallpapers bought with 狗牛币. Drawn with CSS shapes (no emoji) in
// far / mid / near layers; sizes use container units so the swatch and the full window share them.
import './coin-scenes.css';

/** The CSS calf shared by both coin scenes. `pose` adds scene-specific motion. */
const Calf = ({ pose }: { pose: string }) => (
  <i className={`calf ${pose}`}>
    <b className="calf-tail" />
    <b className="calf-body"><b className="calf-spot s1" /><b className="calf-spot s2" /><b className="calf-badge" /></b>
    <b className="calf-head">
      <b className="calf-horn l" /><b className="calf-horn r" />
      <b className="calf-ear l" /><b className="calf-ear r" />
      <b className="calf-patch" />
      <b className="calf-eye l" /><b className="calf-eye r" />
      <b className="calf-muzzle"><b className="calf-nostril l" /><b className="calf-nostril r" /></b>
    </b>
  </i>
);

const Bill = ({ n }: { n: number }) => <i className={`mf-bill b${n}`}><b>¥</b></i>;

export const mintFactory = (
  <>
    <i className="mf-stars" />
    <i className="mf-moon" />
    <i className="mf-city"><b className="mf-win w1" /><b className="mf-win w2" /><b className="mf-win w3" /><b className="mf-win w4" /></i>
    <i className="mf-floor" />
    <i className="mf-press">
      <b className="mf-press-top" /><b className="mf-press-light" /><b className="mf-press-gauge" /><b className="mf-press-slot" />
    </i>
    <i className="mf-belt"><b className="mf-roller r1" /><b className="mf-roller r2" /><b className="mf-roller r3" /></i>
    <Bill n={1} /><Bill n={2} /><Bill n={3} />
    <i className="mf-pig"><b className="mf-pig-ear" /><b className="mf-pig-slot" /><b className="mf-pig-snout" /><b className="mf-pig-leg l" /><b className="mf-pig-leg r" /></i>
    <i className="mf-chair" />
    <Calf pose="is-lounging" />
    <i className="mf-dust" />
    <i className="mf-neon">小金库 · 24h 印钞</i>
  </>
);

const Note = ({ n, text, sub }: { n: number; text: string; sub: string }) => <i className={`iou-note n${n}`}><b className="iou-pin" /><strong>{text}</strong><small>{sub}</small></i>;

export const bossIou = (
  <>
    <i className="iou-paper" />
    <i className="iou-light" />
    <i className="iou-lamp"><b /></i>
    <i className="iou-board">
      <Note n={1} text="欠 ¥128" sub="周三加班 3h" />
      <Note n={2} text="欠 ¥520" sub="周末救火" />
      <Note n={3} text="欠 ¥66" sub="早到 40 分钟" />
      <Note n={4} text="欠 ¥1,024" sub="上线通宵" />
      <Note n={5} text="欠 ¥233" sub="会议拖堂" />
    </i>
    <i className="iou-stamp"><b>已记账</b></i>
    <i className="iou-ink" />
    <i className="iou-counter"><b className="iou-digits"><span>¥ 1,971</span><span>¥ 1,972</span><span>¥ 1,973</span></b></i>
    <i className="iou-floor" />
    <i className="iou-walker"><Calf pose="is-walking" /><b className="iou-sign">还钱</b></i>
  </>
);
