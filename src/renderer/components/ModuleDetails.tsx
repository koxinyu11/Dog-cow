import { useState, type ReactNode } from 'react';
import { Modal } from './Modal';
import { Button } from '../ui';

/** Explicit access to full content from compact board layouts. Mount editors only when open. */
export function ModuleDetails({ label = '查看详情', title, children }: {
  label?: string;
  title: string;
  children: () => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button className="module-detail-trigger" variant="ghost" size="sm" onClick={() => setOpen(true)}>{label}</Button>
      <Modal open={open} title={title} onClose={() => setOpen(false)}>
        {open && <div className="module-detail-content">{children()}</div>}
      </Modal>
    </>
  );
}
