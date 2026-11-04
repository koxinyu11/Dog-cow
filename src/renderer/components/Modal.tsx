import { cloneElement, isValidElement, useEffect, useId, useRef, type ReactNode } from 'react';

export function Modal({
  open,
  title,
  onClose,
  children,
  className,
}: {
  className?: string;
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={className}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={() => {
        if (open) onClose();
      }}
    >
      <div className="dialog-heading">
        <h2>{title}</h2>
        <button onClick={onClose} aria-label="关闭">
          关闭
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Field({ label, children, hint, error }: { label: string; children: ReactNode; hint?: string; error?: string }) {
  const generatedId = useId();
  const child = isValidElement<{ id?: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }>(children) ? children : null;
  const id = child?.props.id || generatedId;
  const description = [child?.props['aria-describedby'], hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ');
  return (
    <div className={`field ${error ? 'has-error' : ''}`}>
      <label className="field-label" htmlFor={id}>{label}</label>
      {child ? cloneElement(child, { id, 'aria-describedby': description || undefined, 'aria-invalid': error ? true : child.props['aria-invalid'] }) : children}
      {hint && <span id={`${id}-hint`} className="field-hint">{hint}</span>}
      {error && <span id={`${id}-error`} className="field-error" role="alert">{error}</span>}
    </div>
  );
}
