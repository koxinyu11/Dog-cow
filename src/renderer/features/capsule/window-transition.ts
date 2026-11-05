import type { WindowTransition } from '../../../shared/capsule';

const EXIT_MS = 70;
const ENTER_MS = 110;
const EASING = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
const BACKING_COLOR = '--window-transition-surface';
const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

/** Content choreography only; native geometry belongs to the main process. */
export function installWindowTransition() {
  let generation = 0;
  let animations: Animation[] = [];
  const clearAnimations = () => { animations.forEach(animation => animation.cancel()); animations = []; };
  const reset = () => {
    clearAnimations();
    document.body.classList.remove('window-morphing', 'window-transitioning');
    document.body.style.removeProperty(BACKING_COLOR);
  };
  const elements = (target: WindowTransition['target']) => Array.from(document.querySelectorAll<HTMLElement>(
    target === 'capsule' ? '.capsule:not(.capsule-preview)' : '.app-shell, .app-bg',
  ));
  const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('no-fx');
  const unsubscribe = window.dogcow.windowTransition(transition => {
    const token = ++generation;
    clearAnimations();
    if (transition.stage === 'reset') { reset(); return; }
    const reduced = reducedMotion();
    const run = async () => {
      const arriving = transition.stage === 'enter';
      if (!arriving) {
        // Keep one opaque backing color for the entire morph, independent of React mode changes.
        const surface = document.body.style.getPropertyValue('--capsule-window-surface').trim()
          || getComputedStyle(document.body).backgroundColor;
        document.body.style.setProperty(BACKING_COLOR, surface);
      }
      document.body.classList.add('window-transitioning');
      if (arriving) {
        // Wait for the committed mode while the target is still hidden.
        await nextFrame();
        await nextFrame();
        if (token !== generation) return;
      }
      const source = transition.target === 'capsule' ? 'expanded' : 'capsule';
      const nodes = elements(arriving ? transition.target : source);
      if (!nodes.length || (arriving && nodes.some(node => node.hidden))) throw Error('window transition content unavailable');
      if (!reduced) {
        animations = nodes.map(node => {
          const animation = node.animate(
            arriving
              ? [{ opacity: 0, transform: 'translateY(4px) scale(0.985)' }, { opacity: 1, transform: 'none' }]
              : [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(2px) scale(0.985)' }],
            { duration: arriving ? ENTER_MS : EXIT_MS, easing: EASING, fill: 'both' },
          );
          // Install opacity=0 before removing the display gate. Never reveal an unprepared frame.
          if (arriving) { animation.pause(); animation.currentTime = 0; }
          return animation;
        });
      }
      if (arriving) {
        document.body.classList.remove('window-morphing');
        if (!reduced) {
          await nextFrame();
          if (token !== generation) return;
          animations.forEach(animation => animation.play());
        }
      }
      if (!reduced) await Promise.all(animations.map(animation => animation.finished));
      if (token !== generation) return;
      if (arriving) reset();
      else { document.body.classList.add('window-morphing'); clearAnimations(); }
      await window.dogcow.invoke('windowTransitionReady', { nonce: transition.nonce, ready: true, reducedMotion: reduced });
    };
    void run().catch(() => {
      if (token !== generation) return;
      reset();
      void window.dogcow.invoke('windowTransitionReady', { nonce: transition.nonce, ready: false, reducedMotion: true });
    });
  });
  return () => { generation++; reset(); unsubscribe(); };
}
