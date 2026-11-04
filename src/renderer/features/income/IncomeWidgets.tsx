import { type IncomeState } from '../../../shared/contracts';
import { money, duration, labels } from '../../format';

export function IncomeWidgets({
  kind,
  income,
  openSettings,
}: {
  kind: string;
  income: IncomeState;
  openSettings: () => void;
}) {
  const s = income.snapshot;
  const enabled = income.settings?.stealMode;
  return (
    <>
      <h2>
        {kind === 'income' ? '实时收入' : kind === 'work-time' ? '工时与下班倒计时' : '偷出金额'}
      </h2>
      {kind === 'income' ? (
        <>
          <p>今日已赚</p>
          <p className="big-number">¥{money(s?.earnedToday)}</p>
          <p>本月已赚</p>
          <p className="big-number">¥{money(s?.earnedMonth)}</p>
          <p>
            秒薪 {s && typeof s.perSecond === 'number' ? s.perSecond.toFixed(6) : '—'} 元 · 本月预计
            ¥{money(s?.expectedMonthIncome)}
          </p>
        </>
      ) : kind === 'work-time' ? (
        <>
          <p>{labels[String(s?.status)] || '待设置'}</p>
          <p>距离规定下班</p>
          <p className="big-number">
            {s?.status === 'rest-day'
              ? '今日休息'
              : s?.fullDayLeave
                ? '今日无需上班'
                : duration(s?.remainingSeconds)}
          </p>
          <p>今日已工作 {duration(s?.elapsedSeconds)}</p>
          <p>实际午休 {duration(s?.actualBreakSeconds)}</p>
        </>
      ) : (
        <>
          <p>今日合计</p>
          <p className="big-number">{enabled ? money(s?.stolenAmount) : '—'}</p>
          <p>本月合计 ¥{enabled ? money(s?.stolenMonthAmount) : '—'}</p>
          {[
            ['lunchStolenAmount', '午休'],
            ['lateAmount', '上班晚'],
            ['earlyAmount', '下班早'],
          ].map(([key, label]) => (
            <p key={key}>
              {label} ¥{enabled ? money(s?.[key]) : '—'}
            </p>
          ))}
          <p className="muted">仅拆分时间价值，不额外加到工资。</p>
          {!enabled && <p>尚未开启偷时间模式。</p>}
          {s?.pendingClockIn && (
            <p className="notice">上班卡待补，当前晚到金额是暂估，补卡后重算。</p>
          )}
        </>
      )}
      {!income.settings && <p>请先设置工资与排班。</p>}
      {income.calculationError && <p className="notice">{income.calculationError.message}</p>}
      <button onClick={openSettings}>计价设置</button>
    </>
  );
}
