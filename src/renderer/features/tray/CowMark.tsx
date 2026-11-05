/** Shares the exact silhouette used by the native template icon. */
export function CowMark({ size = 28 }: { size?: number }) {
  return <span className="cow-mark" style={{ width: size, height: size * 18 / 28 }} aria-hidden="true" />;
}
