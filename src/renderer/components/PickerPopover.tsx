import { useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react';

export function focusPicker(anchor: RefObject<HTMLDivElement | null>) {
  requestAnimationFrame(() => anchor.current?.querySelector<HTMLElement>('[data-picker-trigger]')?.focus());
}

/** Native top layer keeps the panel above dialogs and outside scrolling card clips. */
export function PickerPopover({ id, open, anchor, onClose, children, label, className = '' }: {
  id: string;
  open: boolean;
  anchor: RefObject<HTMLDivElement | null>;
  onClose: () => void;
  children: ReactNode;
  label: string;
  className?: string;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useLayoutEffect(() => {
    const popup = panel.current;
    const control = anchor.current;
    if (!open || !popup || !control) return;
    popup.showPopover();
    const position = () => {
      const rect = control.getBoundingClientRect();
      const width = popup.offsetWidth;
      const height = popup.offsetHeight;
      popup.dataset.side = rect.bottom + height + 8 <= innerHeight ? 'bottom' : 'top';
      popup.style.left = `${Math.max(8, Math.min(rect.left, innerWidth - width - 8))}px`;
      popup.style.top = `${Math.max(8, rect.bottom + height + 8 <= innerHeight ? rect.bottom + 6 : rect.top - height - 6)}px`;
    };
    position();
    popup.querySelector<HTMLElement>('[data-autofocus]')?.focus({ preventScroll: true });
    const outside = (event: Event) => {
      if (event.target instanceof Node && !control.contains(event.target)) closeRef.current();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      closeRef.current();
      focusPicker(anchor);
    };
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('focusin', outside, true);
    document.addEventListener('keydown', escape, true);
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    return () => {
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('focusin', outside, true);
      document.removeEventListener('keydown', escape, true);
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
      if (popup.matches(':popover-open')) popup.hidePopover();
    };
  }, [open, anchor]);
  return <div ref={panel} id={id} popover="manual" className={`form-popover ${className}`} role="dialog" aria-label={label}>{children}</div>;
}
