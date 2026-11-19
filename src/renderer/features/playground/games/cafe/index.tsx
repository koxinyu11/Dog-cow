import { useCallback, useEffect, useState } from 'react';
import { BookOpen, ClipboardList, Coffee, Store } from 'lucide-react';
import { cafeContent, defaultPlan, item, CAMPAIGN_WEEKS } from '../../../../../shared/cafe/content';
import { yuan } from '../../../../../shared/cafe/finance';
import type { WeekPlan } from '../../../../../shared/cafe/types';
import type { GameProps } from '../../registry';
import { useCafe } from './useCafe';
import { useServiceClock } from './useServiceClock';
import { CafeSetup } from './Setup';
import { CafePlan } from './Plan';
import { CafeReport } from './Report';
import { CafeOffice } from './Office';
import { Interior } from './interior/Interior';
import { ManagementDrawer } from './ManagementDrawer';
import { ServiceToolbar } from './ServiceToolbar';
import './cafe.css';
import './interior.css';
type Panel = 'plan' | 'report' | 'office' | null;
export default function CafeGame(props: GameProps) {
  const game = useCafe({ ...props, onActivity: undefined });
  const [panel, setPanel] = useState<Panel>(null);
  const [plan, setPlan] = useState<WeekPlan>(() => defaultPlan());
  const [ready, setReady] = useState(false);
  const state = game.view?.state;
  const finished = useCallback(() => setPanel('report'), []);
  const close = useCallback(() => setPanel(null), []);
  const clock = useServiceClock({
    run: state?.run,
    timeline: game.view?.timeline,
    paused: props.paused || panel !== null,
    blocked: game.disabled || !!game.error,
    send: game.send,
    finished,
  });
  useEffect(() => {
    if (!ready && state) {
      setPlan(state.run?.plan ?? state.reports.at(-1)?.plan ?? defaultPlan());
      setReady(true);
    }
  }, [state, ready]);
  useEffect(() => {
    props.onActivity?.(
      game.error || !state
        ? 'blocked'
        : (clock.playing && state.run) || game.busy
          ? 'progressing'
          : 'decision',
    );
  }, [props.onActivity, game.error, state, clock.playing, game.busy]);
  const open = async () => {
    if (await game.send({ action: 'open', plan, runId: crypto.randomUUID() })) setPanel(null);
  };
  const location = state?.setup ? item(cafeContent.locations, state.setup.location) : null;
  return (
    <div className="cf-app cf-live-app">
      {game.error && (
        <div className="cf-error" role="alert">
          <div>
            <strong>{game.error}</strong>
            {game.correlation && <small>问题编号：{game.correlation}</small>}
          </div>
          <button disabled={game.busy || props.paused} onClick={() => void game.retry()}>
            {game.view?.pending ? '重试保存' : '重试 / 重新载入'}
          </button>
        </div>
      )}
      {!state ? (
        <div className="cf-empty">
          <Coffee size={32} />
          <h2>{game.busy ? '正在打开咖啡馆…' : '咖啡馆尚未载入'}</h2>
        </div>
      ) : !state.setup ? (
        <CafeSetup disabled={game.disabled} open={(setup) => void game.send({ action: 'setup', setup })} />
      ) : (
        <>
          <header className="cf-shop-heading">
            <div>
              <span className="cf-eyebrow">DOGCOW CAFÉ / {location!.district}</span>
              <h1>
                狗牛咖啡馆<span>{state.phase === 'closed' ? '已停业' : `第 ${state.week} 周`}</span>
              </h1>
              <span className="cf-address">
                {location!.name} · {state.setup.positioning === 'express' ? '快取咖啡' : '社区休闲'} ·{' '}
                {state.setup.seats} 席
              </span>
            </div>
            <div className="cf-live-finance">
              <span>
                账面现金<strong>{yuan(state.finance.cash)}</strong>
              </span>
              <span>
                口碑
                <strong>
                  {state.reputation}
                  <small> / 100</small>
                </strong>
              </span>
              <span>
                经营手记
                <strong>
                  {Math.min(state.week - 1, CAMPAIGN_WEEKS)
                    .toString()
                    .padStart(2, '0')}
                  <small> / 08 周</small>
                </strong>
              </span>
            </div>
          </header>
          <nav className="cf-main-nav" aria-label="咖啡馆经营">
            <button
              disabled={!!state.run || state.phase === 'closed' || game.disabled}
              onClick={() => setPanel('plan')}
            >
              <ClipboardList size={17} />
              本周计划
            </button>
            <button onClick={() => setPanel('report')}>
              <BookOpen size={17} />
              经营手记
            </button>
            <button
              disabled={!!state.run || state.phase === 'closed' || game.disabled}
              onClick={() => setPanel('office')}
            >
              <Store size={17} />
              店务
            </button>
            <span>
              {state.run ? '营业进度自动保存' : '经营进度已保存'}
              {game.view?.pending ? ' · 待保存' : ''}
            </span>
          </nav>
          <div className="cf-live-stage">
            <ServiceToolbar
              timeline={game.view?.timeline}
              cursor={clock.cursor}
              playing={clock.playing}
              speed={clock.speed}
              disabled={game.disabled || !!game.error}
              toggle={clock.toggle}
              setSpeed={clock.setSpeed}
              finish={() => void clock.finish()}
            />
            <Interior
              state={state}
              timeline={game.view?.timeline}
              cursor={clock.cursor}
              playing={clock.playing}
            />
            {!state.run && state.phase !== 'closed' && (
              <div className="cf-live-start">
                <span>
                  {state.reports.length
                    ? `第 ${state.week - 1} 周已打烊 · 利润 ${yuan(state.reports.at(-1)!.profit)}`
                    : '菜单、原料和排班就绪后，客人会陆续进店。'}
                </span>
                <button className="cf-primary" disabled={game.disabled} onClick={() => setPanel('plan')}>
                  制定计划，开门营业 →
                </button>
              </div>
            )}
            {state.phase === 'closed' && (
              <div className="cf-live-start">
                <span>
                  小店已停业 · 现金 {yuan(state.finance.cash)} · 未偿债务 {yuan(state.finance.debt)}
                </span>
                <button onClick={() => setPanel('report')}>查看经营手记</button>
              </div>
            )}
          </div>
          <details className="cf-help">
            <summary>营业与结算规则</summary>
            <p>
              顾客进店、制作、取餐和占座来自同一次经营模拟。每周计划锁定后开始营业，资金在完成本周时统一结算。可暂停、加速或直接完成；离开窗口不会继续推进。营业进度每三秒保存，异常关闭后可能回退少量画面，不会重复收款。库存与设备等规则沿用经营手记。
            </p>
          </details>
          {panel && (
            <ManagementDrawer
              title={{ plan: '本周计划', report: '经营手记', office: '店务' }[panel]}
              close={close}
            >
              {panel === 'plan' ? (
                <CafePlan
                  state={state}
                  plan={plan}
                  change={setPlan}
                  disabled={game.disabled || !!state.run}
                  run={() => void open()}
                />
              ) : panel === 'report' ? (
                <CafeReport
                  state={state}
                  next={() => setPanel(state.run || state.phase === 'closed' ? null : 'plan')}
                />
              ) : (
                <CafeOffice
                  state={state}
                  disabled={game.disabled || !!state.run}
                  send={(action) => void game.send(action)}
                />
              )}
            </ManagementDrawer>
          )}
        </>
      )}
    </div>
  );
}
