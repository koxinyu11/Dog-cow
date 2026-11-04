import type { Fields } from './contracts.js';
const validTime = (value: unknown) =>
  typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value);
/** Shared UI/main validation. Historical edit deliberately retains optional empty facts. */
export function clockCommandError(
  input: Fields,
  settings: { stealMode: boolean; clockMode: boolean; flexEnabled?: boolean } | null,
): string {
  if (!settings?.stealMode) return '请先开启偷时间模式。';
  const action = String(input.action);
  if (!['pause', 'resume', 'start', 'flex-start', 'finish', 'edit'].includes(action))
    return '打卡操作无效，请重新打开确认弹窗。';
  if (['start', 'flex-start', 'finish', 'edit'].includes(action) && !settings.clockMode)
    return '请先开启上下班模式。';
  if (action === 'flex-start' && !settings.flexEnabled) return '请先开启弹性打卡。';
  if (['start','flex-start'].includes(action) && !validTime(input.startTime)) return '请填写有效的实际上班时间。';
  if (action === 'finish' && (!validTime(input.startTime) || !validTime(input.endTime)))
    return '请同时填写有效的实际上班和下班时间。';
  return '';
}
