import { useState } from 'react';
import { cafeContent as content, LOAN_LIMIT } from '../../../../../shared/cafe/content';
import { yuan } from '../../../../../shared/cafe/finance';
import { stock } from '../../../../../shared/cafe/inventory';
import type { CafeAction, CafeState } from '../../../../../shared/cafe/types';
export function CafeOffice({
  state,
  disabled,
  send,
}: {
  state: CafeState;
  disabled: boolean;
  send(action: CafeAction): void;
}) {
  const [amount, setAmount] = useState(5000);
  const [confirm, setConfirm] = useState<'sellMachine' | 'liquidate' | null>(null);
  const f = state.finance;
  return (
    <div className="cf-office">
      <section className="cf-panel">
        <span className="cf-eyebrow">资产与资金来源</span>
        <h2>小店的家底</h2>
        <dl>
          {(
            [
              ['cash', '现金'],
              ['inventory', '原料库存（含在途）'],
              ['deposit', '租赁押金'],
              ['equipment', '装修设备净值'],
              ['debt', '贷款余额'],
              ['capital', '初始投入'],
              ['retained', '累计损益'],
            ] as const
          ).map(([id, name]) => (
            <div key={id}>
              <dt>{name}</dt>
              <dd>{yuan(f[id])}</dd>
            </div>
          ))}
        </dl>
        <details className="cf-help">
          <summary>库存批次与保鲜期</summary>
          {content.ingredients.map((i) => (
            <p key={i.id}>
              {i.name}：现货 {stock(state.inventory, i.id, (state.week - 1) * 7)} / 总量{' '}
              {stock(state.inventory, i.id)} {i.unit}
            </p>
          ))}
          <small>现货数量包含尚未在下次营业检查中报废的到期批次；实际制作前先执行保鲜检查。</small>
        </details>
      </section>
      <section className="cf-panel">
        <span className="cf-eyebrow">周转贷款</span>
        <h2>把现金留在安全范围</h2>
        <div className="cf-mini-facts">
          <span>可借 {yuan(LOAN_LIMIT - f.debt)}</span>
          <span>周利率 0.15%</span>
        </div>
        <label className="cf-loan-input">
          金额 / 元
          <input
            disabled={disabled}
            type="number"
            min="1"
            max="30000"
            step="1000"
            value={amount}
            onChange={(e) => setAmount(Math.max(0, Math.min(30000, Math.round(Number(e.target.value)))))}
          />
        </label>
        <div className="cf-actions">
          <button
            disabled={disabled || amount < 1 || amount * 100 + f.debt > LOAN_LIMIT}
            onClick={() => send({ action: 'loan', amount: amount * 100 })}
          >
            借入周转金
          </button>
          <button
            disabled={disabled || amount < 1 || amount * 100 > Math.min(f.cash, f.debt)}
            onClick={() => send({ action: 'repay', amount: amount * 100 })}
          >
            偿还本金
          </button>
        </div>
        <small className="cf-note">借款增加负债，本金偿还不计费用；按结算时的贷款余额计提本周利息。</small>
      </section>
      <section className="cf-panel">
        <span className="cf-eyebrow">设备</span>
        <h2>让产能跟上客流</h2>
        {content.machines.map((m) => (
          <div className="cf-stock-row" key={m.id}>
            <div>
              <b>{m.name}</b>
              <small>
                {m.cupsPerHour} 杯/时 · {yuan(m.price)}
              </small>
            </div>
            <button
              disabled={disabled || (state.machineOwned && state.setup?.machine === m.id)}
              onClick={() => send({ action: 'machine', machine: m.id })}
            >
              {state.machineOwned && state.setup?.machine === m.id ? '使用中' : '购买 / 更换'}
            </button>
          </div>
        ))}
        <small className="cf-note">更换时旧机按账面净值的 60% 出售，差额计处置损失。</small>
      </section>
      <section className="cf-panel cf-exit">
        <span className="cf-eyebrow">经营调整</span>
        <h2>收缩，也是一种决策</h2>
        <div className="cf-actions">
          <button disabled={disabled || !state.machineOwned} onClick={() => setConfirm('sellMachine')}>
            出售咖啡机
          </button>
          <button disabled={disabled} onClick={() => setConfirm('liquidate')}>
            停业清算
          </button>
        </div>
        {confirm && (
          <div className="cf-confirm" role="alert">
            <strong>
              {confirm === 'sellMachine'
                ? '出售后须重新购机才能营业。'
                : '清算后本店永久停业，保留经营记录。'}
            </strong>
            <p>
              {confirm === 'liquidate'
                ? '装修设备按净值 35% 变现，押金全额返还，原料报废，现金优先偿还贷款；不足部分保留为未偿债务。'
                : '咖啡机按净值 60% 变现，差额计入损失。'}
            </p>
            <div className="cf-actions">
              <button onClick={() => setConfirm(null)}>取消</button>
              <button
                disabled={disabled}
                onClick={() => {
                  send({ action: confirm });
                  setConfirm(null);
                }}
              >
                确认{confirm === 'liquidate' ? '清算' : '出售'}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
