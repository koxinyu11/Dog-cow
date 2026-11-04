import { type IncomeState } from '../../../shared/contracts';
import { getAttendanceDay } from '../../../../app/income/src/attendance.js';
import { localDate } from '../../../domain/tasks/model';
import { time } from '../../format';
import { command } from '../../state';

export function ClockButtons({
  income,
  open,
  notify,
}: {
  income: IncomeState;
  open: (action: string, date?: string) => void;
  notify: (message: string) => void;
}) {
  const date = localDate(new Date(income.now));
  const day = income.attendance.days.find((item) => item.date === date);
  const state = getAttendanceDay(income.attendance, date, new Date(income.now));
  const enabled = !!income.settings?.stealMode;
  const clock = enabled && income.settings?.clockMode;
  const unavailable =
    !income.settings ||
    !income.snapshot ||
    income.snapshot.status === 'rest-day' ||
    !!income.snapshot.fullDayLeave;
  return (
    <>
      <p>
        {!enabled
          ? '按规定排班计费'
          : state.state === 'paused'
            ? '午休中'
            : state.state === 'finished'
              ? '已登记下班'
              : clock && !day?.clockIn
                ? '待上班打卡'
                : '工作中'}
      </p>
      <div className="actions">
        {clock && (
          <>
            <button disabled={!day?.clockIn && unavailable} onClick={() => open('start')}>
              {day?.clockIn ? '修改上班时间' : '上班打卡'}
            </button>
            {income.settings?.flexEnabled && !day?.clockIn && <button disabled={unavailable} onClick={()=>open('flex-start')}>弹性打卡</button>}
            <button disabled={!income.settings} onClick={() => open('finish')}>
              {day?.clockOut ? '修改下班时间' : '下班打卡'}
            </button>
            <button onClick={() => open('edit')}>补录其他日期</button>
          </>
        )}
        {enabled && (
          <button
            disabled={
              state.state === 'paused'
                ? !income.settings
                : unavailable || state.state === 'finished' || (!!clock && !day?.clockIn)
            }
            onClick={() =>
              void command(
                'clock',
                { action: state.state === 'paused' ? 'resume' : 'pause' },
                'income',
              ).then((r) => notify(r.message))
            }
          >
            {state.state === 'paused' ? '继续上班' : '午休'}
          </button>
        )}
      </div>
      {day && (
        <p>
          实际上班 {time(day.clockIn?.at) || '未登记'} · 下班 {time(day.clockOut?.at) || '未登记'}
        </p>
      )}
      {Array.isArray(income.snapshot?.unfinishedDates) &&
        income.snapshot.unfinishedDates.length > 0 && (
          <p className="notice">
            有 {income.snapshot.unfinishedDates.length} 天未结束，请核对实际下班时间；不会猜测早退。
          </p>
        )}
      {Array.isArray(income.snapshot?.pendingDates) && income.snapshot.pendingDates.length > 0 && (
        <p className="notice">有 {income.snapshot.pendingDates.length} 天漏上班卡待核对。</p>
      )}
    </>
  );
}
