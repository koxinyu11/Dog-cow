import { useEffect, useState } from 'react';
import { BookOpen, ClipboardList, Coffee, Store } from 'lucide-react';
import { cafeContent, defaultPlan, item, CAMPAIGN_WEEKS } from '../../../../../shared/cafe/content';
import { yuan } from '../../../../../shared/cafe/finance';
import type { WeekPlan } from '../../../../../shared/cafe/types';
import type { GameProps } from '../../registry';
import { useCafe } from './useCafe';
import { CafeSetup } from './Setup';
import { CafeScene } from './Scene';
import { CafePlan } from './Plan';
import { CafeReport } from './Report';
import { CafeOffice } from './Office';
import './cafe.css';
export default function CafeGame(props: GameProps) {
  const game = useCafe(props);
  const [tab, setTab] = useState('plan');
  const [plan, setPlan] = useState<WeekPlan>(() => defaultPlan());
  const [ready, setReady] = useState(false);
  const state = game.view?.state;
  useEffect(() => {
    if (!ready && state) {
      setPlan(state.reports.at(-1)?.plan ?? defaultPlan());
      setReady(true);
    }
  }, [state, ready]);
  const run = async () => {
    if (await game.send({ action: 'week', plan })) setTab('report');
  };
  const location = state?.setup ? item(cafeContent.locations, state.setup.location) : null;
  return (
    <div className="cf-app" aria-busy={game.busy}>
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
            <div className="cf-chapter">
              <span>经营手记</span>
              <strong>
                {Math.min(state.week - 1, CAMPAIGN_WEEKS)
                  .toString()
                  .padStart(2, '0')}
                <small> / 08 周</small>
              </strong>
            </div>
          </header>
          <div className="cf-overview">
            <CafeScene color={location!.color} seats={state.setup.seats} compact />
            <div className="cf-overview-metrics">
              <div>
                <span>可用现金</span>
                <strong>{yuan(state.finance.cash)}</strong>
              </div>
              <div>
                <span>累计损益</span>
                <strong className={state.finance.retained < 0 ? 'cf-danger' : ''}>
                  {yuan(state.finance.retained)}
                </strong>
              </div>
              <div>
                <span>口碑 / 员工士气</span>
                <strong>
                  {state.reputation}
                  <small> / {state.morale}</small>
                </strong>
              </div>
            </div>
          </div>
          <nav className="cf-main-nav" aria-label="咖啡馆经营">
            <button
              aria-current={tab === 'plan' ? 'page' : undefined}
              disabled={state.phase === 'closed'}
              onClick={() => setTab('plan')}
            >
              <ClipboardList size={17} />
              本周计划
            </button>
            <button aria-current={tab === 'report' ? 'page' : undefined} onClick={() => setTab('report')}>
              <BookOpen size={17} />
              经营手记
            </button>
            <button
              aria-current={tab === 'office' ? 'page' : undefined}
              disabled={state.phase === 'closed'}
              onClick={() => setTab('office')}
            >
              <Store size={17} />
              店务
            </button>
            <span>自动存档 {game.view?.pending ? '· 待保存' : '· 已保存'}</span>
          </nav>
          {state.phase === 'closed' ? (
            <>
              <div className="cf-panel cf-empty">
                <h2>这间小店，告一段落。</h2>
                <p>
                  剩余现金 {yuan(state.finance.cash)} · 未偿债务 {yuan(state.finance.debt)} · 累计损益{' '}
                  {yuan(state.finance.retained)}
                </p>
              </div>
              <CafeReport state={state} next={() => setTab('report')} />
            </>
          ) : tab === 'plan' ? (
            <CafePlan
              state={state}
              plan={plan}
              change={setPlan}
              disabled={game.disabled}
              run={() => void run()}
            />
          ) : tab === 'report' ? (
            <CafeReport state={state} next={() => setTab('plan')} />
          ) : (
            <CafeOffice state={state} disabled={game.disabled} send={(action) => void game.send(action)} />
          )}
          <details className="cf-help">
            <summary>经营规则与计算口径</summary>
            <p>
              每回合推进七天，所有价格为模拟人民币。价格、客群匹配、品质、推广与口碑共同影响需求；员工、机器、库存和座位决定接待能力。采购款先付，耗用时计成本；装修设备按期折旧。营业计划必须先留足全周支出，避免用尚未发生的收入作担保。
            </p>
            <p>
              第一阶段目标为完成八周经营，之后仍可继续。街区参数和需求系数是游戏模型，未经真实市场数据校准。离开或暂停不会推进经营。
            </p>
          </details>
        </>
      )}
    </div>
  );
}
