import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
export function ManagementDrawer({
  title,
  close,
  children,
}: {
  title: string;
  close(): void;
  children: ReactNode;
}) {
  const root = useRef<HTMLElement>(null);
  const dismiss = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dismiss.current?.focus();
    return () => {
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return (
    <div className="cf-drawer-overlay" onClick={close}>
      <aside
        className="cf-drawer"
        ref={root}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') close();
          if (e.key === 'Tab') {
            const items = Array.from(
              root.current?.querySelectorAll<HTMLElement>(
                'button:not(:disabled),input:not(:disabled),select:not(:disabled),summary,[tabindex="0"]',
              ) ?? [],
            );
            const first = items[0],
              last = items.at(-1);
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last?.focus();
            }
            if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <header>
          <span className="cf-eyebrow">DOGCOW CAFÉ</span>
          <h2>{title}</h2>
          <button ref={dismiss} aria-label="关闭经营面板" onClick={close}>
            <X size={18} />
          </button>
        </header>
        <div className="cf-drawer-content">{children}</div>
      </aside>
    </div>
  );
}
