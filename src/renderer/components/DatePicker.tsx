import { useEffect, useId, useRef, useState, type InputHTMLAttributes } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { addDays, localDate } from '../../domain/tasks/model';
import { validPickerDate } from '../../shared/form-values';
import { Button } from '../ui';
import { PickerPopover, focusPicker } from './PickerPopover';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange' | 'min' | 'max'> & {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  clearable?: boolean;
};

export function DatePicker({ value, onChange, min, max, clearable = false, disabled, readOnly, id, ...props }: Props) {
  const generatedId = useId();
  const popupId = `${generatedId}-panel`;
  const errorId = `${generatedId}-error`;
  const anchor = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(value);
  const [draft, setDraft] = useState(localDate());
  const [month, setMonth] = useState(localDate().slice(0, 7));
  const [error, setError] = useState('');
  useEffect(() => { setText(value); setError(''); input.current?.setCustomValidity(''); }, [value]);
  useEffect(() => { if (disabled || readOnly) setOpen(false); }, [disabled, readOnly]);
  const apply = (next: string) => {
    const normalized = next.trim();
    if (!(normalized === '' && !props.required) && !validPickerDate(normalized, min, max)) {
      const message = `请输入有效日期（YYYY-MM-DD）${min || max ? `，范围：${min || '不限'} 至 ${max || '不限'}` : ''}。`;
      setError(message);
      input.current?.setCustomValidity(message);
      return false;
    }
    setText(normalized); setError(''); input.current?.setCustomValidity('');
    if (normalized !== value) onChange(normalized);
    return true;
  };
  const choose = () => {
    if (disabled || readOnly) return;
    let next = validPickerDate(text, min, max) ? text : localDate();
    if (min && next < min) next = min;
    if (max && next > max) next = max;
    setDraft(next); setMonth(next.slice(0, 7)); setOpen(true);
  };
  const first = new Date(`${month}-01T12:00:00`);
  const gridStart = addDays(`${month}-01`, -(first.getDay() + 6) % 7);
  const adjacentMonth = (delta: number) => {
    const date = new Date(first);
    date.setMonth(date.getMonth() + delta);
    return localDate(date).slice(0, 7);
  };
  const monthAllowed = (next: string) => validPickerDate(`${next}-01`) && (!min || next >= min.slice(0, 7)) && (!max || next <= max.slice(0, 7));
  const finish = (next: string) => { if (apply(next)) { setOpen(false); focusPicker(anchor); } };
  return <div ref={anchor} className={`picker-control date-picker ${error ? 'is-invalid' : ''}`}>
    <div className="picker-input-wrap">
      <CalendarDays size={16} aria-hidden="true" />
      <input {...props} id={id} ref={input} data-picker-trigger type="text" inputMode="numeric" autoComplete="off" placeholder="YYYY-MM-DD" value={text} disabled={disabled} readOnly={readOnly}
        aria-invalid={!!error || props['aria-invalid']} aria-describedby={[props['aria-describedby'], error ? errorId : ''].filter(Boolean).join(' ') || undefined}
        aria-expanded={open} aria-controls={popupId} aria-haspopup="dialog"
        onChange={(e) => { setText(e.target.value); setError(''); input.current?.setCustomValidity(''); }}
        onBlur={(e) => { if (!disabled && !readOnly && !anchor.current?.contains(e.relatedTarget as Node | null)) apply(text); props.onBlur?.(e); }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); choose(); }
          if (e.key === 'Enter') { e.preventDefault(); if (apply(text)) setOpen(false); }
          if (e.key === 'Escape' && !open) { setText(value); setError(''); input.current?.setCustomValidity(''); }
          props.onKeyDown?.(e);
        }} />
      <button className="picker-open" type="button" aria-label="选择日期" aria-expanded={open} disabled={disabled || readOnly} onClick={() => open ? setOpen(false) : choose()}><CalendarDays size={15} /></button>
    </div>
    {error && <span id={errorId} className="field-error" role="alert">{error}</span>}
    <PickerPopover id={popupId} open={open} anchor={anchor} onClose={() => setOpen(false)} label="选择日期" className="date-panel">
      <div className="picker-heading">
        <Button variant="ghost" size="sm" aria-label="上个月" disabled={!monthAllowed(adjacentMonth(-1))} onClick={() => setMonth(adjacentMonth(-1))}><ChevronLeft size={16} /></Button>
        <b aria-live="polite">{first.getFullYear()} 年 {first.getMonth() + 1} 月</b>
        <Button variant="ghost" size="sm" aria-label="下个月" disabled={!monthAllowed(adjacentMonth(1))} onClick={() => setMonth(adjacentMonth(1))}><ChevronRight size={16} /></Button>
      </div>
      <div className="date-weekdays" aria-hidden="true">{['一', '二', '三', '四', '五', '六', '日'].map((day) => <span key={day}>{day}</span>)}</div>
      <div className="date-grid" role="group" aria-label="选择日期" onKeyDown={(e) => {
        const offset = ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 } as Record<string, number>)[e.key];
        const current = (e.target as HTMLElement).closest<HTMLElement>('[data-date]')?.dataset.date;
        if (offset === undefined || !current) return;
        e.preventDefault();
        const next = addDays(current, offset);
        if (!validPickerDate(next, min, max)) return;
        setDraft(next); setMonth(next.slice(0, 7));
        requestAnimationFrame(() => anchor.current?.querySelector<HTMLButtonElement>(`[data-date="${next}"]`)?.focus());
      }}>
        {Array.from({ length: 42 }, (_, i) => {
          const date = addDays(gridStart, i);
          return <button key={date} type="button" data-date={date} data-autofocus={date === draft ? '' : undefined} tabIndex={date === draft ? 0 : -1} aria-label={date} aria-pressed={date === draft} aria-current={date === localDate() ? 'date' : undefined} disabled={!validPickerDate(date, min, max)} className={date.slice(0, 7) !== month ? 'outside' : ''} onClick={() => setDraft(date)}>{Number(date.slice(-2))}</button>;
        })}
      </div>
      <div className="picker-actions">
        <Button size="sm" variant="ghost" disabled={!validPickerDate(localDate(), min, max)} onClick={() => { setDraft(localDate()); setMonth(localDate().slice(0, 7)); }}>今天</Button>
        {clearable && !props.required && <Button size="sm" variant="ghost" onClick={() => finish('')}>清空</Button>}
        <Button size="sm" variant="ghost" onClick={() => { setOpen(false); focusPicker(anchor); }}>取消</Button>
        <Button size="sm" variant="primary" onClick={() => finish(draft)}>确定</Button>
      </div>
    </PickerPopover>
  </div>;
}
