const validTime = value => typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
const key = at => { const d = new Date(at); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const failure = (code,message) => ({ok:false,flex:null,code,message});
/** Freeze the selected day's schedule. Global settings changes cannot rewrite it. */
export function buildFlexDay(settings,date,actualStart) {
  if (!settings || !['shift','exempt'].includes(settings.flexMode)
      || !validTime(settings.startTime) || !validTime(settings.endTime) || settings.endTime<=settings.startTime
      || typeof settings.lunchCountsAsWork!=='boolean' || !validTime(settings.lunchStartTime) || !validTime(settings.lunchEndTime)
      || !Number.isInteger(actualStart) || !Number.isFinite(new Date(actualStart).getTime()) || key(actualStart)!==date)
    return failure('invalid-flex','弹性排班或实际上班时间无效，请检查后重试。');
  const baseStart = new Date(`${date}T${settings.startTime}:00`).getTime();
  const baseEnd = new Date(`${date}T${settings.endTime}:00`).getTime();
  const delay = settings.flexMode==='shift' ? Math.max(0,actualStart-baseStart) : 0;
  const startAt=baseStart+delay, endAt=baseEnd+delay;
  if (key(endAt)!==date) return failure('flex-cross-day','弹性下班时间跨到次日，暂不支持，请改用普通打卡或调整排班。');
  return {ok:true,code:'',message:'',flex:{mode:settings.flexMode,baseStartTime:settings.startTime,baseEndTime:settings.endTime,startAt,endAt,
    lunchCountsAsWork:settings.lunchCountsAsWork,lunchStartTime:settings.lunchStartTime,lunchEndTime:settings.lunchEndTime}};
}
export function flexSettings(flex) {
  return {flexMode:flex.mode,startTime:flex.baseStartTime,endTime:flex.baseEndTime,lunchCountsAsWork:flex.lunchCountsAsWork,lunchStartTime:flex.lunchStartTime,lunchEndTime:flex.lunchEndTime};
}
export function validFlexDay(flex,date,actualStart) {
  if (!flex || typeof flex!=='object' || Array.isArray(flex)) return false;
  const check=buildFlexDay(flexSettings(flex),date,actualStart);
  return !!check.flex && Object.entries(check.flex).every(([key,value])=>flex[key]===value);
}
