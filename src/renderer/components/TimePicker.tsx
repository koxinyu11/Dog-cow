import { useEffect, useId, useRef, useState, type InputHTMLAttributes, type KeyboardEvent } from 'react';
import { Clock, ChevronDown } from 'lucide-react';
import { normalizeTime } from '../../shared/form-values';
import { Button } from '../ui';
import { PickerPopover, focusPicker } from './PickerPopover';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange' | 'step'> & {
  value: string;
  onChange: (value: string) => void;
  seconds?: boolean;
};
const pad = (value: number) => String(value).padStart(2, '0');

function TimeColumn({ label, value, count, onChange }: { label: string; value: number; count: number; onChange: (value: number) => void }) {
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [value]);
  const navigate = (event: KeyboardEvent<HTMLDivElement>) => {
    const next = event.key === 'ArrowDown' ? (value + 1) % count
      : event.key === 'ArrowUp' ? (value + count - 1) % count
      : event.key === 'Home' ? 0 : event.key === 'End' ? count - 1 : null;
    if (next === null) return;
    event.preventDefault();
    onChange(next);
    list.current?.querySelector<HTMLButtonElement>(`[data-value="${next}"]`)?.focus();
  };
  return <div className="time-column"><span>{label}</span>
    <div ref={list} role="listbox" aria-label={label} onKeyDown={navigate}>
      {Array.from({ length: count }, (_, i) => <button key={i} type="button" role="option" aria-selected={i === value} tabIndex={i === value ? 0 : -1} data-value={i} data-autofocus={label === '小时' && i === value ? '' : undefined} onClick={() => onChange(i)}>{pad(i)}</button>)}
    </div>
  </div>;
}

export function TimePicker({ value, onChange, seconds = false, disabled, readOnly, id, ...props }: Props) {
  const generatedId = useId();
  const popupId = `${generatedId}-panel`;
  const errorId = `${generatedId}-error`;
  const anchor = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(value);
  const [draft, setDraft] = useState('09:00:00');
  const [error, setError] = useState('');
  useEffect(() => { setText(value); setError(''); input.current?.setCustomValidity(''); }, [value]);
  useEffect(() => { if (disabled || readOnly) setOpen(false); }, [disabled, readOnly]);
  const apply = (next: string) => {
    const normalized = next === '' && !props.required ? '' : normalizeTime(next, seconds);
    if (normalized === null) {
      const message = seconds ? '请输入有效时间，例如 09:30:00。' : '请输入有效时间，例如 09:30。';
      setError(message);
      input.current?.setCustomValidity(message);
      return false;
    }
    setText(normalized);
    setError('');
    input.current?.setCustomValidity('');
    if (normalized !== value) onChange(normalized);
    return true;
  };
  const choose = () => {
    if (disabled || readOnly) return;
    const next = normalizeTime(text, seconds) || normalizeTime(value, seconds) || (seconds ? '09:00:00' : '09:00');
    setDraft(next.length === 5 ? `${next}:00` : next);
    setOpen(true);
  };
  const parts = draft.split(':').map(Number);
  const change = (index: number, next: number) => setDraft(parts.map((v, i) => pad(i === index ? next : v)).join(':'));
  return <div ref={anchor} className={`picker-control time-picker ${error ? 'is-invalid' : ''}`}>
    <div className="picker-input-wrap">
      <Clock size={16} aria-hidden="true" />
      <input {...props} id={id} ref={input} data-picker-trigger type="text" inputMode="numeric" autoComplete="off" placeholder={seconds ? 'HH:mm:ss' : 'HH:mm'} value={text} disabled={disabled} readOnly={readOnly}
        aria-invalid={!!error || props['aria-invalid']} aria-describedby={[props['aria-describedby'], error ? errorId : ''].filter(Boolean).join(' ') || undefined}
        aria-expanded={open} aria-controls={popupId} aria-haspopup="dialog"
        onChange={(e) => { setText(e.target.value); setError(''); input.current?.setCustomValidity(''); }}
        onBlur={(e) => {
          if (!disabled && !readOnly && !anchor.current?.contains(e.relatedTarget as Node | null)) apply(text);
          props.onBlur?.(e);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); choose(); }
          if (e.key === 'Enter') { e.preventDefault(); if (apply(text)) setOpen(false); }
          if (e.key === 'Escape' && !open) { setText(value); setError(''); input.current?.setCustomValidity(''); }
          props.onKeyDown?.(e);
        }} />
      <button className="picker-open" type="button" aria-label="选择时间" aria-expanded={open} disabled={disabled || readOnly} onClick={() => open ? setOpen(false) : choose()}><ChevronDown size={15} /></button>
    </div>
    {error && <span id={errorId} className="field-error" role="alert">{error}</span>}
    <PickerPopover id={popupId} open={open} anchor={anchor} onClose={() => setOpen(false)} label="选择时间" className="time-panel">
      <div className="picker-heading"><Clock size={16} /><b>选择时间</b><output>{seconds ? draft : draft.slice(0, 5)}</output></div>
      <div className="time-columns">
        <TimeColumn label="小时" count={24} value={parts[0]} onChange={(next) => change(0, next)} />
        <TimeColumn label="分钟" count={60} value={parts[1]} onChange={(next) => change(1, next)} />
        {seconds && <TimeColumn label="秒" count={60} value={parts[2]} onChange={(next) => change(2, next)} />}
      </div>
      <div className="time-presets">{[0, 15, 30, 45].map((minute) => <button type="button" key={minute} onClick={() => change(1, minute)}>{pad(minute)} 分</button>)}</div>
      <div className="picker-actions"><Button size="sm" variant="ghost" onClick={() => { setOpen(false); focusPicker(anchor); }}>取消</Button><Button size="sm" variant="primary" onClick={() => { if (apply(seconds ? draft : draft.slice(0, 5))) { setOpen(false); focusPicker(anchor); } }}>确定</Button></div>
    </PickerPopover>
  </div>;
}
