/** Decorative anchor; placement is computed by the native panel controller. */
export function TrayPanelArrow({ left }: { left: number }) {
  return <svg className="tray-panel-arrow" style={{ left }} width="28" height="12" viewBox="0 0 28 12" aria-hidden="true">
    <path d="M0 12C4 12 6 9 9 5L12 1.5Q14 -1 16 1.5L19 5C22 9 24 12 28 12Z" fill="currentColor" />
  </svg>;
}
