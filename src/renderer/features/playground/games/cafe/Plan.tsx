import { useState } from 'react';
import { ArrowRight, Coffee, Package, Users, Megaphone } from 'lucide-react';
import { cafeContent as content, SHIFTS, SHIFT_NAMES } from '../../../../../shared/cafe/content';
import { weekBudget } from '../../../../../shared/cafe/operations';
import { stock } from '../../../../../shared/cafe/inventory';
import { yuan } from '../../../../../shared/cafe/finance';
import type { CafeState, WeekPlan } from '../../../../../shared/cafe/types';
export function CafePlan({
  state,
  plan,
  change,
  disabled,
  run,
}: {
  state: CafeState;
  plan: WeekPlan;
  change(plan: WeekPlan): void;
  disabled: boolean;
  run(): void;
}) {
  const [tab, setTab] = useState('menu');
  const budget = weekBudget(state, plan);
  const staffColumns = {
    gridTemplateColumns: `minmax(100px,1.7fr) .7fr .7fr repeat(${content.roles.length}, minmax(65px,1fr))`,
  };
  const ownerHours = SHIFTS.filter((s) => plan.shifts[s].open && plan.shifts[s].owner).length * 28;
  const valid =
    ownerHours <= 56 &&
    SHIFTS.some((s) => plan.shifts[s].open) &&
    SHIFTS.every(
      (s) =>
        !plan.shifts[s].open ||
        plan.shifts[s].owner ||
        content.roles.some((r) => r.brewPerHour && plan.shifts[s].staff[r.id] > 0),
    );
  const tabs = [
    { id: 'menu', name: '菜单定价', Icon: Coffee },
    { id: 'staff', name: '营业与排班', Icon: Users },
    { id: 'stock', name: '采购', Icon: Package },
    { id: 'marketing', name: '推广', Icon: Megaphone },
  ];
  return (
    <div className="cf-plan-layout">
      <section className="cf-panel">
        <div className="cf-panel-heading">
          <div>
            <span className="cf-eyebrow">第 {state.week} 周 / 营业计划</span>
            <h2>这周，怎样经营？</h2>
          </div>
          <span className="cf-pill">{SHIFTS.filter((s) => plan.shifts[s].open).length * 4} 小时 / 天</span>
        </div>
        <div className="cf-tabs" role="tablist" aria-label="经营计划">
          {tabs.map(({ id, name, Icon }) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              id={`cf-tab-${id}`}
              aria-controls={`cf-tabpanel-${id}`}
              onClick={() => setTab(id)}
            >
              <Icon size={15} />
              {name}
            </button>
          ))}
        </div>
        <fieldset
          disabled={disabled}
          className="cf-fields"
          role="tabpanel"
          id={`cf-tabpanel-${tab}`}
          aria-labelledby={`cf-tab-${tab}`}
        >
          {tab === 'menu' && (
            <>
              <div className="cf-section-label">
                <span>饮品</span>
                <span>售价 / 杯</span>
              </div>
              {content.drinks.map((drink) => (
                <div className="cf-menu-row" key={drink.id}>
                  <span className="cf-cup">{drink.short}</span>
                  <div>
                    <b>{drink.name}</b>
                    <small>
                      参考价 {yuan(drink.price)} · 制作 {drink.minutes} 分钟
                    </small>
                  </div>
                  <label className="cf-price">
                    <span>¥</span>
                    <input
                      aria-label={`${drink.name}售价，元`}
                      type="number"
                      min="5"
                      max="60"
                      step="1"
                      value={plan.prices[drink.id] / 100}
                      onChange={(e) =>
                        change({
                          ...plan,
                          prices: { ...plan.prices, [drink.id]: Math.round(Number(e.target.value) * 100) },
                        })
                      }
                    />
                  </label>
                </div>
              ))}
              <label className="cf-inline-setting">
                咖啡豆品质
                <select
                  value={plan.quality}
                  onChange={(e) => change({ ...plan, quality: e.target.value as WeekPlan['quality'] })}
                >
                  <option value="house">日常拼配</option>
                  <option value="specialty">精品拼配 · 豆价 +40%</option>
                </select>
              </label>
              <small className="cf-note">品质选项用于本周新采购；旧豆按实际库存先入先出。</small>
            </>
          )}
          {tab === 'staff' && (
            <>
              <div className="cf-staff-table">
                <div className="cf-staff-head" style={staffColumns}>
                  <span>班次</span>
                  <span>营业</span>
                  <span>店主</span>
                  {content.roles.map((r) => (
                    <span key={r.id}>{r.name}</span>
                  ))}
                </div>
                {SHIFTS.map((shift) => {
                  const s = plan.shifts[shift];
                  return (
                    <div className="cf-staff-row" key={shift} style={staffColumns}>
                      <b>{SHIFT_NAMES[shift]}</b>
                      <input
                        aria-label={`${SHIFT_NAMES[shift]}营业`}
                        type="checkbox"
                        checked={s.open}
                        onChange={(e) =>
                          change({
                            ...plan,
                            shifts: { ...plan.shifts, [shift]: { ...s, open: e.target.checked } },
                          })
                        }
                      />
                      <input
                        aria-label={`${SHIFT_NAMES[shift]}店主上班`}
                        disabled={!s.open}
                        type="checkbox"
                        checked={s.owner}
                        onChange={(e) =>
                          change({
                            ...plan,
                            shifts: { ...plan.shifts, [shift]: { ...s, owner: e.target.checked } },
                          })
                        }
                      />
                      {content.roles.map((r) => (
                        <input
                          key={r.id}
                          aria-label={`${SHIFT_NAMES[shift]}${r.name}人数`}
                          disabled={!s.open}
                          type="number"
                          min="0"
                          max="4"
                          value={s.staff[r.id]}
                          onChange={(e) =>
                            change({
                              ...plan,
                              shifts: {
                                ...plan.shifts,
                                [shift]: {
                                  ...s,
                                  staff: {
                                    ...s.staff,
                                    [r.id]: Math.max(0, Math.min(4, Math.round(Number(e.target.value)))),
                                  },
                                },
                              },
                            })
                          }
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
              <label className="cf-inline-setting">
                员工时薪上浮
                <select
                  value={plan.wagePremium}
                  onChange={(e) => change({ ...plan, wagePremium: Number(e.target.value) })}
                >
                  {[0, 10, 20, 30, 40].map((n) => (
                    <option key={n} value={n}>
                      +{n}%
                    </option>
                  ))}
                </select>
              </label>
              <div className="cf-mini-facts">
                {content.roles.map((role) => (
                  <span key={role.id}>
                    {role.name} {yuan(role.wage)} / 时
                  </span>
                ))}
                <span className={ownerHours > 56 ? 'cf-danger' : ''}>店主 {ownerHours} / 56 小时</span>
              </div>
              <small className="cf-note">
                每天重复此排班，连续营业七天。店主不领工资，每日最多两班；无人制作的班次不能营业。
              </small>
            </>
          )}
          {tab === 'stock' && (
            <>
              <div className="cf-section-label">
                <span>原料 / 当前库存</span>
                <span>采购包数</span>
              </div>
              {content.ingredients.map((i) => (
                <div className="cf-stock-row" key={i.id}>
                  <div>
                    <b>
                      {i.name}{' '}
                      <em>
                        {stock(state.inventory, i.id, (state.week - 1) * 7)} {i.unit}
                      </em>
                    </b>
                    <small>
                      {i.pack} {i.unit}/包 ·{' '}
                      {yuan(
                        Math.round(i.price * (i.id === 'beans' && plan.quality === 'specialty' ? 1.4 : 1)),
                      )}
                      {i.shelfDays ? ` · 保鲜 ${i.shelfDays} 天` : ' · 长期保存'}
                    </small>
                  </div>
                  <input
                    aria-label={`${i.name}采购包数`}
                    type="number"
                    min="0"
                    max="100"
                    value={plan.purchases[i.id]}
                    onChange={(e) =>
                      change({
                        ...plan,
                        purchases: {
                          ...plan.purchases,
                          [i.id]: Math.max(0, Math.min(100, Math.round(Number(e.target.value)))),
                        },
                      })
                    }
                  />
                </div>
              ))}
              <label className="cf-inline-setting">
                临时补货预留 / 元
                <input
                  aria-label="临时补货预算，元"
                  type="number"
                  min="0"
                  max="2000"
                  step="50"
                  value={plan.emergencyBudget / 100}
                  onChange={(e) =>
                    change({
                      ...plan,
                      emergencyBudget: Math.max(
                        0,
                        Math.min(200000, Math.round(Number(e.target.value) * 100)),
                      ),
                    })
                  }
                />
              </label>
              <small className="cf-note">
                缺货时可在预留内自动订购，加价 50%，次日到货；未用预留不扣款。
              </small>
              <small className="cf-note">
                下单即付款。分三批于周二、周四、周六到货，首日使用现有库存；鲜奶按到货日计算保鲜期。
              </small>
            </>
          )}
          {tab === 'marketing' && (
            <>
              <div className="cf-marketing">
                <Megaphone size={32} />
                <h3>让街坊知道这间小店</h3>
                <label>
                  本周推广预算 · 元
                  <input
                    type="number"
                    min="0"
                    max="2000"
                    step="50"
                    value={plan.marketing / 100}
                    onChange={(e) =>
                      change({
                        ...plan,
                        marketing: Math.max(0, Math.min(200000, Math.round(Number(e.target.value) * 100))),
                      })
                    }
                  />
                </label>
                <small>影响本周触达，投入效果递减。服务能力不足时，新增客流也可能排队流失。</small>
              </div>
            </>
          )}
        </fieldset>
      </section>
      <aside className="cf-budget">
        <span className="cf-eyebrow">周转金安排</span>
        <h2>{yuan(budget.total)}</h2>
        <small>本周支出准备金</small>
        <dl>
          {(
            [
              ['purchases', '原料采购'],
              ['wages', '员工工资'],
              ['rent', '租金'],
              ['utilities', '水电'],
              ['marketing', '推广'],
              ['interest', '贷款利息'],
              ['emergencyBudget', '临时补货预留'],
            ] as const
          ).map(([id, label]) => (
            <div key={id}>
              <dt>{label}</dt>
              <dd>{yuan(budget[id])}</dd>
            </div>
          ))}
        </dl>
        <div className="cf-budget-left">
          <span>预留后现金</span>
          <strong className={state.finance.cash < budget.total ? 'cf-danger' : ''}>
            {yuan(state.finance.cash - budget.total)}
          </strong>
        </div>
        <button
          className="cf-primary"
          disabled={disabled || !valid || budget.total > state.finance.cash || !state.machineOwned}
          onClick={run}
        >
          营业一周 <ArrowRight size={16} />
        </button>
        {!valid && (
          <small role="status" className="cf-danger">
            请检查营业班次、制作人员与店主工时。
          </small>
        )}
        {budget.total > state.finance.cash && (
          <small className="cf-danger">现金不足，请调整支出或到「店务」申请周转。</small>
        )}
        <small className="cf-note">结算推进七天。工资、租金与水电照常发生；营业收入不计入准备金。</small>
      </aside>
    </div>
  );
}
