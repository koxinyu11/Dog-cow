import { useState } from 'react';
import { cafeContent as content, CAMPAIGN_WEEKS } from '../../../../../shared/cafe/content';
import { yuan } from '../../../../../shared/cafe/finance';
import type { CafeState } from '../../../../../shared/cafe/types';
export function CafeReport({ state, next }: { state: CafeState; next(): void }) {
  const [selected, select] = useState(state.reports.at(-1)?.week ?? 0);
  const report = state.reports.find((r) => r.week === selected) ?? state.reports.at(-1);
  if (!report)
    return (
      <div className="cf-panel cf-empty">
        <h2>第一本经营手记，还等你写下。</h2>
        <p>完成一个营业周后，查看销售、成本和客流。</p>
        <button className="cf-primary" onClick={next}>
          制定第一周计划
        </button>
      </div>
    );
  const lost = report.hours.reduce(
    (n, h) => ({ queue: n.queue + h.queueLost, stock: n.stock + h.stockLost, seats: n.seats + h.seatLost }),
    { queue: 0, stock: 0, seats: 0 },
  );
  const machine =
    report.hours.reduce((n, h) => n + h.machineUsed, 0) /
    Math.max(
      1,
      report.hours.reduce((n, h) => n + h.machineCapacity, 0),
    );
  const labor =
    report.hours.reduce((n, h) => n + h.laborUsed, 0) /
    Math.max(
      1,
      report.hours.reduce((n, h) => n + h.laborCapacity, 0),
    );
  return (
    <div className="cf-report">
      <div className="cf-panel-heading">
        <div>
          <span className="cf-eyebrow">营业复盘 / WEEK {report.week.toString().padStart(2, '0')}</span>
          <h2>{report.week >= CAMPAIGN_WEEKS ? '八周之后，小店仍在继续。' : '每一杯，都记在这里。'}</h2>
        </div>
        <label className="cf-report-select">
          查看周次
          <select value={report.week} onChange={(e) => select(Number(e.target.value))}>
            {state.reports.map((r) => (
              <option key={r.week} value={r.week}>
                第 {r.week} 周
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="cf-report-kpis">
        <div>
          <span>营业收入</span>
          <strong>{yuan(report.revenue)}</strong>
        </div>
        <div>
          <span>经营利润</span>
          <strong className={report.profit < 0 ? 'cf-danger' : ''}>{yuan(report.profit)}</strong>
        </div>
        <div>
          <span>现金变化</span>
          <strong className={report.cashChange < 0 ? 'cf-danger' : ''}>
            {report.cashChange > 0 ? '+' : ''}
            {yuan(report.cashChange)}
          </strong>
        </div>
        <div>
          <span>顾客满意度</span>
          <strong>
            {report.satisfaction}
            <small> / 100</small>
          </strong>
        </div>
      </div>
      <div className="cf-report-grid">
        <section className="cf-panel">
          <h3>客流去向</h3>
          <div className="cf-funnel">
            <div>
              <span>购买需求</span>
              <b>{report.demand}</b>
            </div>
            <div>
              <span>完成订单</span>
              <b>{report.served}</b>
            </div>
            <div>
              <span>排队流失</span>
              <b>{lost.queue}</b>
            </div>
            <div>
              <span>缺货流失</span>
              <b>{lost.stock}</b>
            </div>
            <div>
              <span>无座流失</span>
              <b>{lost.seats}</b>
            </div>
          </div>
          <div className="cf-util">
            <label>
              咖啡机负荷 <b>{Math.round(machine * 100)}%</b>
              <progress value={machine} max="1" />
            </label>
            <label>
              员工负荷 <b>{Math.round(labor * 100)}%</b>
              <progress value={labor} max="1" />
            </label>
          </div>
          <small className="cf-note">负荷为整周平均，高峰瓶颈见下方分时记录。</small>
          <h3>七天销售</h3>
          <div className="cf-day-chart">
            {Array.from({ length: 7 }, (_, day) => {
              const hours = report.hours.filter((h) => h.day % 7 === day);
              const sales = hours.reduce((n, h) => n + h.served, 0);
              const max = Math.max(
                1,
                ...Array.from({ length: 7 }, (_, i) =>
                  report.hours.filter((h) => h.day % 7 === i).reduce((n, h) => n + h.served, 0),
                ),
              );
              return (
                <div key={day}>
                  <b>{sales}</b>
                  <i style={{ height: `${Math.max(3, (sales / max) * 90)}px` }} />
                  <span>{['一', '二', '三', '四', '五', '六', '日'][day]}</span>
                </div>
              );
            })}
          </div>
        </section>
        <section className="cf-panel cf-profit">
          <h3>利润表</h3>
          <dl>
            <div>
              <dt>营业收入</dt>
              <dd>{yuan(report.revenue)}</dd>
            </div>
            {(
              [
                ['cogs', '已消耗原料'],
                ['wages', '员工工资'],
                ['rent', '租金'],
                ['utilities', '水电'],
                ['marketing', '推广'],
                ['waste', '原料报废'],
                ['interest', '贷款利息'],
                ['depreciation', '装修设备折旧'],
              ] as const
            ).map(([id, name]) => (
              <div key={id}>
                <dt>{name}</dt>
                <dd>−{yuan(report[id])}</dd>
              </div>
            ))}
            <div className="cf-quote-total">
              <dt>经营利润</dt>
              <dd className={report.profit < 0 ? 'cf-danger' : ''}>{yuan(report.profit)}</dd>
            </div>
          </dl>
          <small className="cf-note">
            店主投入 {report.ownerHours} 小时，不计工资。设备处置损益在店务资产表中反映。
          </small>
        </section>
      </div>
      <section className="cf-panel">
        <h3>菜单表现</h3>
        <div className="cf-menu-summary">
          {content.drinks.map((d) => (
            <div key={d.id}>
              <span className="cf-cup">{d.short}</span>
              <div>
                <b>{d.name}</b>
                <small>
                  {report.sales[d.id]} 杯 · 收入 {yuan(report.sales[d.id] * report.plan.prices[d.id])}
                </small>
              </div>
            </div>
          ))}
        </div>
      </section>
      <details className="cf-panel cf-detail">
        <summary>现金流与库存</summary>
        <dl>
          <div>
            <dt>期初现金</dt>
            <dd>{yuan(report.openingCash)}</dd>
          </div>
          <div>
            <dt>销售收款</dt>
            <dd>+{yuan(report.revenue)}</dd>
          </div>
          <div>
            <dt>采购付款（含临时补货）</dt>
            <dd>−{yuan(report.purchases)}</dd>
          </div>
          <div>
            <dt>人工、租金、水电、推广及利息</dt>
            <dd>
              −{yuan(report.wages + report.rent + report.utilities + report.marketing + report.interest)}
            </dd>
          </div>
          <div>
            <dt>期末现金</dt>
            <dd>{yuan(report.closingCash)}</dd>
          </div>
        </dl>
        <p>
          本周临时补货付款 {yuan(report.emergencyPurchases)}
          。采购先减少现金、增加库存；耗用与报废计入费用。折旧减少利润，不再次扣现金。
        </p>
      </details>
      <details className="cf-panel cf-detail">
        <summary>分时经营记录 · {report.hours.length} 个时段</summary>
        <div className="cf-table-scroll">
          <table>
            <thead>
              <tr>
                {['星期 / 时段', '天气', '人流', '需求', '成交', '排队流失', '缺货', '无座', '平均等候'].map(
                  (s) => (
                    <th key={s}>{s}</th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {report.hours.map((h) => (
                <tr key={`${h.day}-${h.hour}`}>
                  <td>
                    周{['一', '二', '三', '四', '五', '六', '日'][h.day % 7]} {h.hour}:00
                  </td>
                  <td>{h.weather === 'rain' ? '雨' : '晴'}</td>
                  <td>{h.traffic}</td>
                  <td>{h.demand}</td>
                  <td>{h.served}</td>
                  <td>{h.queueLost}</td>
                  <td>{h.stockLost}</td>
                  <td>{h.seatLost}</td>
                  <td>{h.waitMinutes} 分</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <button className="cf-primary cf-next" onClick={next}>
        制定第 {state.week} 周计划 →
      </button>
    </div>
  );
}
