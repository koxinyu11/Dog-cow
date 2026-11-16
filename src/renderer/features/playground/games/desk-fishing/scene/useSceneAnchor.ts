import { useLayoutEffect, useRef, useState } from 'react';
const W = 900, H = 400;
/** Horizontal band (viewBox units) that must stay visible: angler to bobber. */
const KEEP: [number, number] = [190, 640];
interface View { x: number; y: number; w: number; h: number; scale: number }
/**
 * Fills any container with the 900×400 scene ("cover"), but picks the crop so the angler
 * and bobber stay in view, and maps scene coordinates to pixels for HTML overlays.
 */
export function useSceneAnchor() {
  const ref = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>({ x: 0, y: 0, w: W, h: H, scale: 1 });
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const fit = () => {
      const { width, height } = node.getBoundingClientRect();
      if (!width || !height) return;
      const scale = Math.max(width / W, height / H);
      const w = width / scale, h = height / scale;
      const centre = Math.min(Math.max((KEEP[0] + KEEP[1]) / 2, w / 2), W - w / 2);
      // Wide windows trim mostly sky, keeping the water and dock.
      setView({ x: centre - w / 2, y: (H - h) * .65, w, h, scale });
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const at = (x: number, y: number) => ({ left: `${(x - view.x) * view.scale}px`, top: `${(y - view.y) * view.scale}px` });
  return { ref, viewBox: `${view.x} ${view.y} ${view.w} ${view.h}`, at };
}
