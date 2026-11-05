import { useEffect, useRef, useState } from 'react';
import { Check, Dices, Ellipsis, Gift, ListPlus, Loader, Pencil, RefreshCw, RotateCcw } from 'lucide-react';
import type { ModuleCtx } from '../../board/modules';
import type { Fields, Result } from '../../../shared/contracts';
import { MAX_MEALS, defaultFun, estimateMealCalories, lunchOptions, weekKey } from '../../../shared/fun';
import { MEAL_CATALOG, MEAL_CATEGORIES, mealCategory, mealEmoji, mealQuip, type MealCategoryId } from '../../../shared/meals';
import { Button, IconButton } from '../../ui';
import { Modal, Field } from '../../components/Modal';
import { useReducedMotion } from '../../hooks/useReducedMotion';

const ROLL_MS = 1000;
const TICK_MS = 80;
const CATALOG_NAMES = MEAL_CATALOG.map(meal => meal.name);
const pick = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)];
const lines = (value: string) => value.split('\n').map(x => x.trim()).filter(Boolean);

interface Props { ctx: ModuleCtx; busy: boolean; error: string; setError: (message: string) => void; run: (p: Fields) => Promise<Result | null> }

/** Lunch picker. One state machine, five size layouts (s / m / tall / l / wide). */
export function LunchCard({ ctx, busy, error, setError, run }: Props) {
  const { state, today, size, notify } = ctx;
  const fun = state.board.fun ?? defaultFun();
  const reduced = useReducedMotion();
  const options = lunchOptions(fun, today);
  const recorded = fun.lunch.date === today ? fun.lunch : null;

  const [choice, setChoice] = useState('');
  const [blind, setBlind] = useState(false);
  const [quip, setQuip] = useState('');
  const [rolling, setRolling] = useState(false);
  const [reel, setReel] = useState<[string, string, string]>(['', '', '']);
  const [scope, setScope] = useState<MealCategoryId | null>(null);
  const [more, setMore] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [noRepeat, setNoRepeat] = useState(fun.noRepeat);
  const [pickCategory, setPickCategory] = useState<MealCategoryId>('noodle');
  const [recordOpen, setRecordOpen] = useState(false);
  const [customMeal, setCustomMeal] = useState('');
  const [servings, setServings] = useState(1);
  const [saved, setSaved] = useState(false);
  const tick = useRef(0);
  const stop = useRef(0);
  const savedTimer = useRef(0);
  const clearTimers = () => { window.clearInterval(tick.current); window.clearTimeout(stop.current); };
  useEffect(() => () => { clearTimers(); window.clearTimeout(savedTimer.current); }, []);

  const activeScope = size === 'l' ? scope : null;
  const scoped = activeScope ? options.filter(name => mealCategory(name) === activeScope) : options;
  const locked = busy || rolling;

  const roll = (isBlind: boolean) => {
    const names = isBlind ? CATALOG_NAMES : scoped;
    if (locked || !names.length) return;
    const final = pick(names.length > 1 ? names.filter(name => name !== choice) : names);
    const finish = () => {
      setReel([pick(names), final, pick(names)]);
      setChoice(final); setBlind(isBlind); setQuip(mealQuip(final)); setRolling(false);
    };
    setError(''); setSaved(false);
    if (reduced || document.documentElement.classList.contains('no-fx')) { finish(); return; }
    setRolling(true);
    tick.current = window.setInterval(() => setReel([pick(names), pick(names), pick(names)]), TICK_MS);
    stop.current = window.setTimeout(() => { clearTimers(); finish(); }, ROLL_MS);
  };
  const choose = (name: string) => { setReel(['', name, '']); setChoice(name); setBlind(false); setQuip(mealQuip(name)); setError(''); };
  const confirm = async () => {
    if (!choice || locked) return;
    const done = options.includes(choice)
      ? await run({ action: 'lunch', value: choice })
      : await run({ action: 'custom-lunch', value: choice, servings: 1 });
    if (done) {
      setChoice(''); setBlind(false); setSaved(true); notify('午饭有着落啦！');
      window.clearTimeout(savedTimer.current);
      savedTimer.current = window.setTimeout(() => setSaved(false), 1400);
    }
  };
  const openMenu = () => { setError(''); setNoRepeat(fun.noRepeat); setDraft(fun.meals.join('\n')); setMenuOpen(true); };
  const openRecord = () => {
    setError(''); setCustomMeal(recorded?.chosen || ''); setServings(recorded?.servings ?? 1); setRecordOpen(true);
  };
  const toggleDish = (name: string) => {
    const current = lines(draft);
    if (current.includes(name)) { setDraft(current.filter(x => x !== name).join('\n')); setError(''); return; }
    if (current.length >= MAX_MEALS) { setError(`菜单最多 ${MAX_MEALS} 道。`); return; }
    setDraft([...current, name].join('\n')); setError('');
  };
  const addCategory = (id: MealCategoryId) => {
    const current = lines(draft);
    const merged = [...new Set([...current, ...MEAL_CATALOG.filter(meal => meal.category === id).map(meal => meal.name)])];
    if (merged.length > MAX_MEALS) { setError(`菜单最多 ${MAX_MEALS} 道。`); return; }
    setDraft(merged.join('\n')); setError('');
  };

  const shown = choice || recorded?.chosen || '';
  const centre = rolling ? reel[1] : shown;
  const name = centre || '今天吃什么？';
  const emoji = centre ? mealEmoji(centre) : '🍜';
  const servingsText = !choice && !rolling && recorded ? ` · ${recorded.servings ?? 1} 份` : '';
  const remain = !fun.meals.length ? '先加几道菜' : fun.noRepeat ? `本周还可选 ${options.length} 道` : '随心抽，不设限';
  const exhausted = !options.length && fun.meals.length > 0;
  const hasResult = !!choice && !rolling;
  const subline = hasResult ? quip : saved ? '已记下' : remain;
  const slot = size === 'tall' || size === 'l';

  const rollButton = (variant: 'primary' | 'soft' = 'primary', label?: string) => (
    <Button size="sm" variant={variant} className={`lunch-roll${rolling ? ' is-rolling' : ''}`} icon={rolling ? <Loader size={14} /> : <Dices size={14} />} disabled={locked || !scoped.length} onClick={() => roll(false)}>
      {rolling ? '选择中…' : label ?? (choice && !blind ? '再抽一次' : slot ? '拉一把' : '帮我选')}
    </Button>
  );
  const rerollIcon = <IconButton label="换一个" size="sm" variant="ghost" disabled={locked || !scoped.length} onClick={() => roll(false)}><RefreshCw size={14} /></IconButton>;
  const blindButton = <Button size="sm" className="lunch-blind" icon={<Gift size={14} />} disabled={locked} onClick={() => roll(true)}>盲盒</Button>;
  const blindIcon = <IconButton label="盲盒" size="sm" className="lunch-blind" disabled={locked} onClick={() => roll(true)}><Gift size={14} /></IconButton>;
  const confirmButton = <Button size="sm" variant="primary" className="lunch-confirm" icon={<Check size={14} />} disabled={locked} onClick={() => void confirm()}>{busy ? '记录中…' : '今天就吃它'}</Button>;
  const recordIcon = <IconButton label={recorded ? '修改记录' : '自己填写'} size="sm" variant="ghost" onClick={openRecord}><Pencil size={14} /></IconButton>;
  const menuIcon = <IconButton label="菜单" size="sm" variant="ghost" onClick={openMenu}><ListPlus size={14} /></IconButton>;
  const resetButton = exhausted ? <Button size="sm" className="lunch-reset" icon={<RotateCcw size={14} />} disabled={busy} onClick={() => void run({ action: 'reset-lunch' })}>重置本周</Button> : null;
  const primary = hasResult ? confirmButton : rollButton();
  const title = <strong>{name}{saved && ' ✓'}{servingsText && <small>{servingsText}</small>}{blind && hasResult && <small> · 盲盒</small>}</strong>;
  const reelView = (
    <div className={`lunch-reel${rolling ? ' is-rolling' : ''}${blind && hasResult ? ' is-blind' : ''}`} role="status" aria-label={centre ? `结果：${centre}` : '尚未抽选'}>
      <span aria-hidden="true">{rolling || choice ? reel[0] : ''}</span>
      <b><i aria-hidden="true">{emoji}</i>{name}{saved && <em aria-hidden="true"> ✓</em>}</b>
      <span aria-hidden="true">{rolling || choice ? reel[2] : ''}</span>
    </div>
  );
  const kcal = hasResult ? ` · 约 ${Math.round(estimateMealCalories(choice))} kcal` : '';
  const reelBody = (tools: boolean) => (
    <div className="lunch-slot">
      {reelView}
      <small className="lunch-sub">{subline}{kcal}</small>
      <div className="lunch-bar lunch-bar-wide">{primary}</div>
      <div className="lunch-bar">
        {hasResult && rollButton('soft', '再抽')}{blindButton}
        {tools && <>{recordIcon}{menuIcon}</>}{resetButton}
      </div>
    </div>
  );

  let body;
  if (size === 's') {
    body = (
      <div className={`lunch-s${hasResult ? ' has-result' : ''}`}>
        <button type="button" className="lunch-s-main" disabled={locked || (!choice && !scoped.length && !!fun.meals.length)} onClick={() => (!fun.meals.length ? openMenu() : choice ? void confirm() : roll(false))} title={choice ? '确认今天就吃它' : '帮我选'}>
          <i aria-hidden="true">{emoji}</i><strong>{name}{(hasResult || saved) && ' ✓'}</strong>
        </button>
        {rerollIcon}
      </div>
    );
  } else if (size === 'tall') {
    body = <>{reelBody(true)}</>;
  } else if (size === 'l') {
    body = (
      <div className="lunch-split">
        {reelBody(false)}
        <div className="lunch-side">
          <div className="lunch-chips" role="group" aria-label="范围">
            <button type="button" aria-pressed={!scope} onClick={() => setScope(null)}>全部</button>
            {MEAL_CATEGORIES.map(c => <button key={c.id} type="button" aria-pressed={scope === c.id} onClick={() => setScope(c.id)}>{c.emoji} {c.name}</button>)}
          </div>
          <h3>本周已选</h3>
          <div className="lunch-used">
            {(fun.lunch.week === weekKey(today) ? fun.lunch.used : []).map(item => <span key={item}><i aria-hidden="true">{mealEmoji(item)}</i>{item}</span>)}
            {(fun.lunch.week !== weekKey(today) || !fun.lunch.used.length) && <small>还没决定第一顿</small>}
          </div>
          <div className="lunch-bar lunch-bar-end">{recordIcon}{menuIcon}</div>
        </div>
      </div>
    );
  } else if (size === 'wide') {
    body = (
      <div className="lunch-wide">
        <div className="lunch-wide-main">
          <div className="fun-main"><span className="fun-symbol">{emoji}</span><div>{title}<small>{subline}</small></div></div>
          <div className="lunch-bar">{primary}{hasResult && rerollIcon}{blindButton}{resetButton}</div>
        </div>
        <div className="lunch-strip" role="list" aria-label="候选菜">
          {options.slice(0, 40).map(item => <button key={item} type="button" role="listitem" aria-pressed={choice === item} disabled={locked} onClick={() => choose(item)}><i aria-hidden="true">{mealEmoji(item)}</i>{item}</button>)}
          {!options.length && <small>{fun.meals.length ? '本周的菜都吃过啦' : '先加几道菜'}</small>}
        </div>
        <div className="lunch-wide-tools">{recordIcon}{menuIcon}</div>
      </div>
    );
  } else {
    body = (
      <div className="lunch-m">
        <div className="fun-main"><span className="fun-symbol">{emoji}</span><div>{title}<small>{subline}</small></div></div>
        <div className="lunch-bar">
          <div className="lunch-main">{primary}</div>
          {hasResult && rerollIcon}{blindIcon}
          <IconButton label="更多" size="sm" variant="ghost" aria-expanded={more} onClick={() => setMore(v => !v)}><Ellipsis size={14} /></IconButton>
        </div>
        {more && <div className="lunch-bar">{recordIcon}{menuIcon}{resetButton}</div>}
      </div>
    );
  }

  return <>
    <div className={`lunch-body lunch-${size}${saved ? ' is-saved' : ''}`}>{body}</div>
    {!menuOpen && !recordOpen && error && <p className="error" role="alert">{error}</p>}
    <Modal open={recordOpen} title="记录今天吃了什么" onClose={() => { if (!busy) setRecordOpen(false); }}>
      <form onSubmit={async e => {
        e.preventDefault();
        if (await run({ action: 'custom-lunch', value: customMeal, servings })) {
          setChoice(''); setRecordOpen(false); notify('今天这顿记下来啦！');
        }
      }}>
        <Field label="今天吃了什么"><input value={customMeal} maxLength={100} required placeholder="例如：牛肉面" onChange={e => setCustomMeal(e.target.value)} /></Field>
        <Field label="吃了多少份"><input type="number" min="0.1" max="20" step="0.1" required value={servings} onChange={e => setServings(Number(e.target.value))} /></Field>
        <p className="muted">可以填写 0.5 份、1 份、1.5 份等，热量爆表会按份量自动换算。</p>
        <p className="error" role="alert">{error}</p>
        <div className="dialog-actions"><Button disabled={busy} onClick={() => setRecordOpen(false)}>取消</Button><Button type="submit" variant="primary" disabled={busy}>保存这顿</Button></div>
      </form>
    </Modal>
    <Modal open={menuOpen} title="午餐菜单" onClose={() => { if (!busy) setMenuOpen(false); }}>
      <form onSubmit={async e => {
        e.preventDefault();
        if (await run({ action: 'meals', value: lines(draft).join('\n'), noRepeat })) setMenuOpen(false);
      }}>
        <div className="lunch-chips" role="group" aria-label="菜库分类">
          {MEAL_CATEGORIES.map(c => <button key={c.id} type="button" aria-pressed={pickCategory === c.id} onClick={() => setPickCategory(c.id)}>{c.emoji} {c.name}</button>)}
        </div>
        <div className="lunch-picker">
          {MEAL_CATALOG.filter(meal => meal.category === pickCategory).map(meal => <button key={meal.name} type="button" aria-pressed={lines(draft).includes(meal.name)} onClick={() => toggleDish(meal.name)}>{meal.emoji} {meal.name}</button>)}
          <Button size="sm" variant="ghost" onClick={() => addCategory(pickCategory)}>整类加入</Button>
        </div>
        <details className="lunch-advanced"><summary>高级：手动编辑</summary>
          <Field label="每行一道"><textarea rows={6} value={draft} onChange={e => setDraft(e.target.value)} /></Field>
        </details>
        <p className="lunch-count" aria-live="polite">已选 {lines(draft).length} / {MAX_MEALS}</p>
        <label className="fun-checkbox"><input type="checkbox" checked={noRepeat} onChange={e => setNoRepeat(e.target.checked)} />本周不重复</label>
        <p className="error" role="alert">{error}</p>
        <div className="dialog-actions"><Button disabled={busy} onClick={() => setMenuOpen(false)}>取消</Button><Button type="submit" variant="primary" disabled={busy}>保存</Button></div>
      </form>
    </Modal>
  </>;
}
