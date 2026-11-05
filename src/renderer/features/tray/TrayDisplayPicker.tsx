import { useId, type CSSProperties, type KeyboardEvent } from 'react';
import { TRAY_DISPLAYS, type TrayDisplay } from '../../../shared/tray';
const options = Object.keys(TRAY_DISPLAYS) as TrayDisplay[];
export function TrayDisplayPicker({ value, busy, onChange }: { value: TrayDisplay; busy: boolean; onChange(value: TrayDisplay): void }) {
  const id = useId();
  const selectByKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = index;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % options.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index + options.length - 1) % options.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = options.length - 1;
    else return;
    event.preventDefault();
    document.getElementById(`${id}-${next}`)?.focus();
    onChange(options[next]);
  };
  return <section className="tray-picker" aria-busy={busy}>
    <span id={id} className="tray-section-label">菜单栏显示</span>
    <div className="tray-segments" role="radiogroup" aria-labelledby={id} style={{ '--tray-index': options.indexOf(value) } as CSSProperties}>
      <span className="tray-selection" aria-hidden="true" />
      {options.map((option, index) => <button id={`${id}-${index}`} key={option} type="button" role="radio" aria-checked={option === value}
        disabled={busy} tabIndex={option === value ? 0 : -1} onKeyDown={event => selectByKey(event, index)} onClick={() => onChange(option)}>
        {option === 'icon' ? '图标' : option === 'income-today' ? '收入' : '倒计时'}
      </button>)}
    </div>
  </section>;
}
