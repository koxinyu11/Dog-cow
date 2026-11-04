import test from 'node:test';
import assert from 'node:assert/strict';
import {buildFlexDay,validFlexDay} from '../../app/income/src/flex.js';
import {calculateSnapshot,validateSettings,DEFAULT_SETTINGS} from '../../app/income/src/calculator.js';
import {createAttendance,setModeDay,setAttendanceTimes,validateAttendance,applyAttendanceAction} from '../../app/income/src/attendance.js';
import {saveSettings,loadSettings} from '../../app/income/src/storage.js';
const date='2026-11-05';
const at=t=>new Date(`${date}T${t}`);
const settings=(extra={})=>{
 const checked=validateSettings({...DEFAULT_SETTINGS,payBasis:'daily',dailySalary:240,calendarMode:'weekly',workdays:[0,1,2,3,4,5,6],stealMode:true,clockMode:true,flexEnabled:true,flexMode:'shift',lunchCountsAsWork:false,...extra});
 assert.equal(checked.valid,true,JSON.stringify(checked.errors));return checked.settings;
};
function clock(s,actual='10:00:00',flexible=true){
 let a=setModeDay(createAttendance(at('00:00:00')),s,at(actual)).attendance;
 const flex=flexible?buildFlexDay(s,date,at(actual).getTime()).flex:undefined;
 const result=setAttendanceTimes(a,{date,startAt:at(actual).getTime(),endAt:null,source:'recorded',...(flex?{flex}:{})},at(actual));
 assert.equal(result.ok,true,JSON.stringify(result));return result.attendance;
}
const snapshot=(s,a,t,leaves=[])=>calculateSnapshot(s,at(t),undefined,leaves,a);
test('old settings default to disabled elastic clock; invalid mode and boolean are rejected',()=>{
 const old={...DEFAULT_SETTINGS,payBasis:'daily',dailySalary:240};delete old.flexEnabled;delete old.flexMode;
 const parsed=validateSettings(old);assert.equal(parsed.valid,true);assert.equal(parsed.settings.flexEnabled,false);assert.equal(parsed.settings.flexMode,'shift');
 assert.equal(validateSettings({...old,flexMode:'unknown'}).valid,false);
 assert.equal(validateSettings({...old,flexEnabled:'true'}).valid,false);
});
test('late arrival shifts end equally; early arrival never moves end earlier; seconds are preserved',()=>{
 const s=settings();
 const late=buildFlexDay(s,date,at('10:00:15').getTime());assert.equal(late.flex.endAt,at('19:00:15').getTime());assert.equal(late.flex.startAt,at('10:00:15').getTime());
 const early=buildFlexDay(s,date,at('08:00:00').getTime());assert.equal(early.flex.startAt,at('09:00:00').getTime());assert.equal(early.flex.endAt,at('18:00:00').getTime());
 assert.equal(buildFlexDay(s,date,at('16:00:00').getTime()).code,'flex-cross-day');
 assert.equal(validFlexDay({...late.flex,endAt:at('20:00:00').getTime()},date,at('10:00:15').getTime()),false);
});
test('elastic schedule drives countdown/status without increasing daily pay; normal clock retains lateness',()=>{
 const s=settings();const a=clock(s);
 const elastic=snapshot(s,a,'18:30:00');assert.equal(elastic.status,'working');assert.equal(elastic.remainingSeconds,1800);assert.equal(elastic.scheduledEndAt,at('19:00:00').getTime());assert.equal(elastic.lateAmount,0);
 const finished=setAttendanceTimes(a,{date,startAt:at('10:00:00').getTime(),endAt:at('19:00:00').getTime(),source:'recorded'},at('19:00:00'));
 assert.equal(finished.ok,true);assert.equal(snapshot(s,finished.attendance,'20:00:00').earnedToday,240);
 const ordinary=snapshot(s,clock(s,'10:00:00',false),'18:30:00');assert.equal(ordinary.scheduledEndAt,at('18:00:00').getTime());assert.ok(ordinary.lateAmount>0);
});
test('exempt arrival keeps original end and suppresses late income while preserving leave deductions',()=>{
 const s=settings({flexMode:'exempt'});const a=clock(s);
 const result=snapshot(s,a,'18:00:00');assert.equal(result.scheduledEndAt,at('18:00:00').getTime());assert.equal(result.lateSeconds,0);assert.equal(result.earnedToday,240);
 const leaves=[{id:'unpaid',date,fullDay:false,startTime:'09:00',endTime:'10:00',paid:false}];
 assert.equal(snapshot(s,a,'18:00:00',leaves).earnedToday,210);
 const shifted=settings();assert.equal(snapshot(shifted,clock(shifted),'19:00:00',leaves).earnedToday,210);
});
test('lunch stays at original clock time, daily denominator stays fixed even after lunch arrival',()=>{
 const s=settings();const a=clock(s);
 const before=snapshot(s,a,'12:00:00').earnedToday;
 const paused=applyAttendanceAction(a,'pause',at('12:00:00'));assert.equal(paused.ok,true);
 assert.equal(snapshot(s,paused.attendance,'13:00:00').earnedToday,before);
 const afternoon=clock(s,'14:00:00');const end=snapshot(s,afternoon,'23:00:00');assert.equal(end.dailyIncome,240);assert.equal(end.earnedToday,240);assert.equal(end.scheduledEndAt,at('23:00:00').getTime());
});
test('disabling elastic mode or choosing a different future mode preserves frozen day; edits rebuild that rule',()=>{
 const s=settings();let a=clock(s);
 const changed=settings({flexEnabled:false,flexMode:'exempt',startTime:'08:00',endTime:'17:00'});
 assert.equal(snapshot(changed,a,'18:30:00').scheduledEndAt,at('19:00:00').getTime());
 const edited=setAttendanceTimes(a,{date,startAt:at('11:00:00').getTime(),endAt:null,source:'backfill'},at('12:00:00'));
 assert.equal(edited.ok,true);assert.equal(edited.attendance.days[0].flex.mode,'shift');assert.equal(edited.attendance.days[0].flex.endAt,at('20:00:00').getTime());
 const invalid=setAttendanceTimes(a,{date,startAt:at('16:00:00').getTime(),endAt:null,source:'backfill'},at('17:00:00'));assert.equal(invalid.ok,false);assert.equal(a.days[0].clockIn.at,at('10:00:00').getTime());
});
test('frozen schedule survives save/load and tampered schedules are rejected without touching source',()=>{
 const s=settings();const a=clock(s);let raw=null;const storage={getItem:()=>raw,setItem:(_key,value)=>raw=value};
 assert.equal(saveSettings(s,[],a,storage).ok,true);
 const loaded=loadSettings(storage,at('12:00:00'));assert.deepEqual(loaded.attendance.days[0].flex,a.days[0].flex);assert.equal(loaded.settings.flexEnabled,true);
 const bad=structuredClone(a);bad.days[0].flex.endAt++;assert.equal(validateAttendance(bad).valid,false);
 assert.equal(a.days[0].flex.endAt,at('19:00:00').getTime());
});
