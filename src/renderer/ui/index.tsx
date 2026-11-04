// 狗牛 component library. All screens compose these primitives; styling lives in ui/components.css.
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import type { LucideIcon } from 'lucide-react';
import { fx, type FxName } from '../motion/fx';

/* ---------- Button ---------- */
type Variant = 'primary' | 'soft' | 'ghost' | 'danger' | 'accent';
export function Button({
  variant = 'soft',
  size = 'md',
  icon,
  effect,
  className = '',
  onClick,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
  /** Motion preset played on click. */
  effect?: FxName;
}) {
  return (
    <button
      type="button"
      {...rest}
      className={`ui-btn ui-btn-${variant} ui-btn-${size} ${className}`}
      onClick={(event) => {
        const target = event.currentTarget;
        target.classList.remove('ui-pressed');
        void target.offsetWidth;
        target.classList.add('ui-pressed');
        if (effect) fx(effect, target);
        onClick?.(event);
      }}
    >
      {icon && <span className="ui-btn-icon" aria-hidden="true">{icon}</span>}
      {children !== undefined && <span className="ui-btn-label">{children}</span>}
    </button>
  );
}

export function IconButton({
  label,
  children,
  className = '',
  ...rest
}: Omit<Parameters<typeof Button>[0], 'icon'> & { label: string }) {
  return (
    <Button {...rest} aria-label={label} title={label} className={`ui-icon-btn ${className}`} icon={children} />
  );
}

/* ---------- Switch: a setting that is ON or OFF, takes effect immediately ---------- */
export function Switch({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: ReactNode;
  hint?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <label className={`ui-switch-row ${disabled ? 'is-disabled' : ''}`}>
      <span className="ui-switch-text">
        <span>{label}</span>
        {hint && <small>{hint}</small>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        className="ui-switch"
        onClick={() => onChange(!checked)}
      >
        <span className="ui-switch-thumb" aria-hidden="true" />
      </button>
    </label>
  );
}

/* ---------- Check: tick an item (done / selected in a set) ---------- */
export function Check({
  checked,
  onChange,
  label,
  disabled,
  round,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: ReactNode;
  disabled?: boolean;
  /** Round checks mark task completion; square checks select items in a set. */
  round?: boolean;
}) {
  return (
    <label className={`ui-check ${round ? 'is-round' : ''} ${disabled ? 'is-disabled' : ''}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="ui-check-box" aria-hidden="true">
        <svg viewBox="0 0 16 16">
          <path d="M3.5 8.5l3 3 6-7" />
        </svg>
      </span>
      {label !== '' && <span className="ui-check-label">{label}</span>}
    </label>
  );
}

/* ---------- Segmented control ---------- */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: Array<[T, ReactNode]>;
  onChange: (value: T) => void;
  label: string;
}) {
  const index = Math.max(0, options.findIndex(([v]) => v === value));
  return (
    <div
      className="ui-segmented"
      role="tablist"
      aria-label={label}
      style={{ '--count': options.length, '--index': index } as CSSProperties}
    >
      <span className="ui-segmented-thumb" aria-hidden="true" />
      {options.map(([v, text]) => (
        <button key={v} type="button" role="tab" aria-selected={v === value} onClick={() => onChange(v)}>
          {text}
        </button>
      ))}
    </div>
  );
}

/* ---------- Chip ---------- */
export function Chip({ color, children, tone }: { color?: string; tone?: 'high' | 'mid' | 'low' | 'ok' | 'warn'; children: ReactNode }) {
  return (
    <span className={`ui-chip ${tone ? `tone-${tone}` : ''}`} style={color ? ({ '--chip': color } as CSSProperties) : undefined}>
      {children}
    </span>
  );
}

/* ---------- Animated emoji ---------- */
/** idle-* loops run on their own but rest most of the cycle; the others play on hover. */
export type EmojiMotion = 'bob' | 'wiggle' | 'spin' | 'bounce' | 'pulse' | 'run' | 'chew' | 'float' | 'none' | 'idle-peek' | 'idle-chew' | 'idle-walk';
export function Emoji({
  children,
  motion = 'none',
  label,
  onClick,
  size,
}: {
  children: string;
  motion?: EmojiMotion;
  label?: string;
  onClick?: (el: HTMLElement) => void;
  size?: number;
}) {
  return (
    <span
      className={`ui-emoji m-${motion} ${onClick ? 'is-clickable' : ''}`}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={size ? { fontSize: size } : undefined}
      onClick={onClick ? (e) => onClick(e.currentTarget) : undefined}
    >
      {children}
    </span>
  );
}

/* ---------- Progress ring ---------- */
export function Ring({ value, size = 120, stroke = 12, children, color }: { value: number; size?: number; stroke?: number; children?: ReactNode; color?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="ui-ring" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="ui-ring-track" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          className="ui-ring-value"
          style={{ strokeDasharray: c, strokeDashoffset: c * (1 - v), stroke: color }}
        />
      </svg>
      <div className="ui-ring-center">{children}</div>
    </div>
  );
}

/* ---------- Rolling number: digits slide when they change ---------- */
export function Rolling({ text, className = '' }: { text: string; className?: string }) {
  return (
    <span className={`ui-rolling ${className}`} aria-label={text}>
      {[...text].map((ch, i) =>
        /\d/.test(ch) ? (
          <span className="ui-digit" key={i} aria-hidden="true">
            <span style={{ transform: `translateY(-${Number(ch) * 10}%)` }}>
              {'0123456789'.split('').map((d) => (
                <span key={d}>{d}</span>
              ))}
            </span>
          </span>
        ) : (
          <span key={i} aria-hidden="true">
            {ch}
          </span>
        ),
      )}
    </span>
  );
}

/* ---------- Context menu ---------- */
export type MenuItem = { label: ReactNode; icon?: ReactNode; onSelect: () => void; active?: boolean } | 'divider';
const MenuContext = createContext<(x: number, y: number, items: MenuItem[]) => void>(() => {});
export const useContextMenu = () => useContext(MenuContext);
export function MenuProvider({ children }: { children: ReactNode }) {
  const [menu, setMenu] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  useLayoutEffect(() => {
    if (!menu || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setPos({ x: Math.min(menu.x, innerWidth - r.width - 8), y: Math.min(menu.y, innerHeight - r.height - 8) });
    ref.current.querySelector<HTMLButtonElement>('button')?.focus();
  }, [menu]);
  useEffect(() => {
    if (!menu) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== 'Escape') return;
      if (e.type === 'pointerdown' && ref.current?.contains(e.target as Node)) return;
      setMenu(null);
    };
    addEventListener('pointerdown', close, true);
    addEventListener('keydown', close);
    addEventListener('blur', close);
    return () => {
      removeEventListener('pointerdown', close, true);
      removeEventListener('keydown', close);
      removeEventListener('blur', close);
    };
  }, [menu]);
  return (
    <MenuContext.Provider value={(x, y, items) => setMenu({ x, y, items })}>
      {children}
      {menu &&
        createPortal(
          <div ref={ref} className="ui-menu" role="menu" style={{ left: pos.x, top: pos.y }}>
            {menu.items.map((item, i) =>
              item === 'divider' ? (
                <hr key={i} />
              ) : (
                <button
                  key={i}
                  role="menuitem"
                  className={item.active ? 'is-active' : ''}
                  onClick={() => {
                    setMenu(null);
                    item.onSelect();
                  }}
                >
                  <span aria-hidden="true">{item.icon || ''}</span>
                  {item.label}
                </button>
              ),
            )}
          </div>,
          document.body,
        )}
    </MenuContext.Provider>
  );
}

/* ---------- Toast ---------- */
export function Toast({ message, tone }: { message: string; tone?: 'ok' | 'error' }) {
  return (
    <div role="status" aria-live="polite" className={`ui-toast ${message ? 'is-open' : ''} ${tone === 'error' ? 'is-error' : ''}`}>
      {message && <span key={message}>{message}</span>}
    </div>
  );
}

/* ---------- Stat ---------- */
export function Stat({ label, value, icon: Icon }: { label: ReactNode; value: ReactNode; icon?: LucideIcon }) {
  return (
    <div className="ui-stat">
      <span className="ui-stat-label">
        {Icon && <Icon size={14} strokeWidth={2.2} aria-hidden="true" />}
        {label}
      </span>
      <span className="ui-stat-value">{value}</span>
    </div>
  );
}

/* ---------- Icon badge: tinted rounded square that identifies a module or section ---------- */
export function Badge({ icon: Icon, color, size = 'md' }: { icon: LucideIcon; color: string; size?: 'sm' | 'md' | 'lg' }) {
  const px = { sm: 14, md: 16, lg: 22 }[size];
  return (
    <span className={`ui-badge ui-badge-${size}`} style={{ '--accent': color } as CSSProperties} aria-hidden="true">
      <Icon size={px} strokeWidth={2.2} />
    </span>
  );
}

/** Small breathing dot that marks something as live (money accruing, clock running). */
export function LiveDot({ color }: { color?: string }) {
  return <span className="ui-live-dot" style={color ? ({ '--dot': color } as CSSProperties) : undefined} aria-hidden="true" />;
}
