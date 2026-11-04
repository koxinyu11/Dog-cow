import { Children, isValidElement, useEffect, useId, useRef, useState, type ReactNode, type SelectHTMLAttributes } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { PickerPopover, focusPicker } from './PickerPopover';

type Props = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'value' | 'multiple'> & {
  value: string | number;
  onChange: (value: string) => void;
};
type Option = { value: string; label: string; disabled: boolean };
function textOf(node: ReactNode): string {
  return Children.toArray(node).map((child) => isValidElement<{ children?: ReactNode }>(child) ? textOf(child.props.children) : String(child)).join('');
}
function optionsOf(children: ReactNode): Option[] {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement<{ children?: ReactNode; value?: string | number; disabled?: boolean }>(child)) return [];
    if (child.type !== 'option') return optionsOf(child.props.children);
    const label = textOf(child.props.children);
    return [{ value: String(child.props.value ?? label), label, disabled: !!child.props.disabled }];
  });
}

export function FormSelect({ value, onChange, children, disabled, className = '', id, name, required, ...props }: Props) {
  const generatedId = useId();
  const popupId = `${generatedId}-panel`;
  const anchor = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const options = optionsOf(children);
  const selected = options.findIndex((option) => option.value === String(value));
  const choose = () => { setActive(selected >= 0 && !options[selected].disabled ? selected : Math.max(0, options.findIndex((option) => !option.disabled))); setOpen(true); };
  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
  useEffect(() => {
    if (open) list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);
  const commit = (option: Option | undefined) => {
    if (!option || option.disabled || disabled) return;
    onChange(option.value); setOpen(false); focusPicker(anchor);
  };
  return <div ref={anchor} className={`picker-control form-select ${className}`}>
    <button id={id} type="button" data-picker-trigger role="combobox" className="form-select-trigger" disabled={disabled}
      aria-expanded={open} aria-controls={`${popupId}-list`} aria-haspopup="listbox" aria-required={required}
      aria-label={props['aria-label']} aria-labelledby={props['aria-labelledby']} aria-describedby={props['aria-describedby']} aria-invalid={props['aria-invalid']}
      title={options[selected]?.label || props.title} onClick={() => open ? setOpen(false) : choose()}
      onKeyDown={(e) => { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); choose(); } }}>
      <span>{options[selected]?.label || '请选择'}</span><ChevronDown size={15} aria-hidden="true" />
    </button>
    <input type="hidden" name={name} value={value} />
    <PickerPopover id={popupId} open={open} anchor={anchor} onClose={() => setOpen(false)} label={props['aria-label'] || '选择选项'} className="select-panel">
      <div ref={list} id={`${popupId}-list`} role="listbox" data-autofocus tabIndex={0} aria-label={props['aria-label'] || '选项'} aria-activedescendant={options[active] ? `${popupId}-${active}` : undefined} onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); commit(options[active]); return; }
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
        e.preventDefault();
        const enabled = options.map((option, i) => option.disabled ? -1 : i).filter((i) => i >= 0);
        if (!enabled.length) return;
        const current = enabled.indexOf(active);
        const index = e.key === 'Home' ? 0 : e.key === 'End' ? enabled.length - 1 : (current + (e.key === 'ArrowDown' ? 1 : -1) + enabled.length) % enabled.length;
        setActive(enabled[index]);
      }}>
        {options.map((option, i) => <button id={`${popupId}-${i}`} key={`${option.value}-${i}`} type="button" role="option" tabIndex={-1} data-index={i} aria-selected={i === selected} disabled={option.disabled} className={i === active ? 'is-active' : ''} onPointerMove={() => { if (!option.disabled) setActive(i); }} onClick={() => commit(option)}><span>{option.label}</span>{i === selected && <Check size={15} />}</button>)}
        {!options.length && <p className="muted">暂无可选项</p>}
      </div>
    </PickerPopover>
  </div>;
}
