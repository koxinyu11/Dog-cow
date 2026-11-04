// Motion library. Every user operation maps to a named preset in PRESETS.
// Effects are drawn in a fixed overlay with pointer-events:none so they never block input,
// and are skipped entirely when the system asks for reduced motion.

export type Anchor = Element | { x: number; y: number } | null | undefined;

type Particle = {
  emoji: string[];
  count: number;
  /** burst: radial spray · rise: float upward · fall: rain from above anchor · orbit: circle then fade · fly: straight dash to the right */
  pattern: 'burst' | 'rise' | 'fall' | 'orbit' | 'fly' | 'pop';
  spread?: number;
  size?: [number, number];
  duration?: number;
};
type Preset = {
  particles?: Particle[];
  /** CSS class from motion.css applied briefly to the anchor element. */
  host?: string;
  hostMs?: number;
  /** Large caption that pops near the anchor. */
  caption?: string;
};

// Quiet by default: everyday operations get a short reaction on the element only.
// Emoji particles and captions are kept for milestones (finish a task, clock in/out, all done).
export const PRESETS = {
  'task-create': { host: 'fx-drop-in', hostMs: 520 },
  'task-done': { particles: [{ emoji: ['🌿', '🌱', '✨'], count: 6, pattern: 'burst', spread: 70 }], host: 'fx-jelly', caption: '吃完啦' },
  'task-undo': { host: 'fx-rewind' },
  'task-delete': { host: 'fx-poof', hostMs: 380 },
  'task-move': { host: 'fx-slide-out' },
  'task-progress': {},
  'all-done': { particles: [{ emoji: ['🎉', '🐄', '⭐'], count: 16, pattern: 'fall', spread: 520 }], caption: '今天全部完成' },
  'clock-in': { particles: [{ emoji: ['☀️', '🐂'], count: 5, pattern: 'rise' }], host: 'fx-stomp', caption: '开工' },
  'offwork-finale': { particles: [{ emoji: ['🎊', '🎉', '✨', '🌸'], count: 26, pattern: 'fall', spread: 620, duration: 1200 }] },
  'clock-out': { particles: [{ emoji: ['🌙', '🎉', '✨'], count: 8, pattern: 'burst', spread: 140 }], host: 'fx-jelly', caption: '下班快乐' },
  pause: { particles: [{ emoji: ['🍱'], count: 2, pattern: 'rise' }], host: 'fx-squish', caption: '干饭时间' },
  resume: { host: 'fx-jelly', caption: '回来啦' },
  coin: {},
  'coin-big': { particles: [{ emoji: ['🪙'], count: 6, pattern: 'fall', spread: 120 }], host: 'fx-jelly', caption: '又赚了 ¥100' },
  'off-soon': { host: 'fx-wiggle' },
  'module-add': { host: 'fx-drop-in', hostMs: 520 },
  'module-remove': {},
  'module-resize': { host: 'fx-stretch', hostMs: 420 },
  'module-drop': { host: 'fx-squash', hostMs: 380 },
  'switch-on': {},
  'switch-off': {},
  check: {},
  save: { host: 'fx-nod' },
  error: { host: 'fx-shake', hostMs: 420 },
  background: {},
  title: { host: 'fx-nod' },
  bind: { host: 'fx-flip', hostMs: 520 },
  'open-panel': {},
  'pet-cow': { particles: [{ emoji: ['💕', '🥛'], count: 4, pattern: 'rise' }], host: 'fx-wiggle', caption: '哞～' },
  'pet-dog': { particles: [{ emoji: ['🦴', '💕'], count: 4, pattern: 'rise' }], host: 'fx-wiggle', caption: '汪！' },
  'week-nav': {},
  export: {},
} satisfies Record<string, Preset>;
export type FxName = keyof typeof PRESETS;

let reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
if (typeof matchMedia === 'function')
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => (reduced = e.matches));
let userEnabled = true;
export const setFxEnabled = (on: boolean) => (userEnabled = on);
export const motionAllowed = () => userEnabled && !reduced;

let layer: HTMLDivElement | null = null;
function overlay() {
  if (!layer || !layer.isConnected) {
    layer = document.createElement('div');
    layer.className = 'fx-layer';
    layer.setAttribute('aria-hidden', 'true');
    document.body.append(layer);
  }
  return layer;
}

function point(anchor: Anchor) {
  if (!anchor) return { x: innerWidth / 2, y: innerHeight / 3 };
  if ('x' in anchor && !(anchor instanceof Element)) return anchor;
  const r = (anchor as Element).getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}
const pick = <T>(list: T[]) => list[Math.floor(Math.random() * list.length)];
const rand = (a: number, b: number) => a + Math.random() * (b - a);

function spawn(origin: { x: number; y: number }, p: Particle) {
  const root = overlay();
  const spread = p.spread ?? 110;
  const [min, max] = p.size ?? [18, 30];
  for (let i = 0; i < p.count; i++) {
    const el = document.createElement('span');
    el.className = 'fx-particle';
    el.textContent = pick(p.emoji);
    el.style.fontSize = `${rand(min, max)}px`;
    let x = origin.x;
    let y = origin.y;
    let frames: Keyframe[];
    const angle = (Math.PI * 2 * i) / p.count + rand(-0.4, 0.4);
    const spin = rand(-260, 260);
    if (p.pattern === 'burst') {
      const d = rand(spread * 0.45, spread);
      frames = [
        { transform: 'translate(-50%,-50%) scale(.2)', opacity: 1 },
        { transform: `translate(calc(-50% + ${Math.cos(angle) * d}px), calc(-50% + ${Math.sin(angle) * d}px)) scale(1.1) rotate(${spin}deg)`, opacity: 1, offset: 0.55 },
        { transform: `translate(calc(-50% + ${Math.cos(angle) * d * 1.15}px), calc(-50% + ${Math.sin(angle) * d + 50}px)) scale(.6) rotate(${spin * 1.4}deg)`, opacity: 0 },
      ];
    } else if (p.pattern === 'rise') {
      x += rand(-spread / 2, spread / 2);
      frames = [
        { transform: 'translate(-50%,-50%) scale(.4)', opacity: 0 },
        { transform: `translate(-50%, -80%) scale(1)`, opacity: 1, offset: 0.2 },
        { transform: `translate(calc(-50% + ${rand(-30, 30)}px), calc(-50% - ${rand(90, 170)}px)) scale(.8) rotate(${spin / 3}deg)`, opacity: 0 },
      ];
    } else if (p.pattern === 'fall') {
      x += rand(-spread / 2, spread / 2);
      y -= rand(60, 140);
      frames = [
        { transform: `translate(-50%,-50%) rotate(0deg)`, opacity: 0 },
        { transform: `translate(-50%,-50%) rotate(${spin / 4}deg)`, opacity: 1, offset: 0.1 },
        { transform: `translate(calc(-50% + ${rand(-40, 40)}px), calc(-50% + ${rand(220, 420)}px)) rotate(${spin}deg)`, opacity: 0 },
      ];
    } else if (p.pattern === 'orbit') {
      const r = spread * 0.5;
      frames = Array.from({ length: 9 }, (_, k) => {
        const a = angle + (k / 8) * Math.PI * 1.6;
        return {
          transform: `translate(calc(-50% + ${Math.cos(a) * r}px), calc(-50% + ${Math.sin(a) * r * 0.6}px)) scale(${0.5 + k / 12})`,
          opacity: k === 8 ? 0 : 1,
        };
      });
    } else if (p.pattern === 'fly') {
      y += rand(-16, 16);
      frames = [
        { transform: 'translate(-80%,-50%) scale(.7)', opacity: 0 },
        { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: 0.15 },
        { transform: `translate(calc(-50% + ${rand(160, 300)}px), -50%) scale(1) rotate(8deg)`, opacity: 0 },
      ];
    } else {
      x += rand(-24, 24);
      y += rand(-18, 6);
      frames = [
        { transform: 'translate(-50%,-50%) scale(0)', opacity: 0 },
        { transform: 'translate(-50%,-90%) scale(1.35)', opacity: 1, offset: 0.35 },
        { transform: 'translate(-50%,-150%) scale(1)', opacity: 0 },
      ];
    }
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    root.append(el);
    const anim = el.animate(frames, {
      duration: (p.duration ?? 900) * rand(0.85, 1.35),
      delay: i * 18,
      easing: 'cubic-bezier(.2,.7,.3,1)',
      fill: 'both',
    });
    anim.onfinish = () => el.remove();
  }
}

function caption(origin: { x: number; y: number }, text: string) {
  const el = document.createElement('span');
  el.className = 'fx-caption';
  el.textContent = text;
  el.style.left = `${origin.x}px`;
  el.style.top = `${origin.y}px`;
  overlay().append(el);
  el.addEventListener('animationend', () => el.remove());
}

/** Play a named effect at an element or point. Safe to call from any event handler. */
export function fx(name: FxName, anchor?: Anchor) {
  if (!motionAllowed() || typeof document === 'undefined') return;
  const preset: Preset = PRESETS[name];
  const origin = point(anchor);
  preset.particles?.forEach((p) => spawn(origin, p));
  if (preset.caption) caption(origin, preset.caption);
  if (preset.host && anchor instanceof Element) {
    const host = anchor as HTMLElement;
    host.classList.remove(preset.host);
    void host.offsetWidth;
    host.classList.add(preset.host);
    setTimeout(() => host.classList.remove(preset.host!), preset.hostMs ?? 600);
  }
}

/** Convenience: anchor to the element that triggered a React event. */
export const fxFrom = (name: FxName) => (event: { currentTarget: Element }) => fx(name, event.currentTarget);
