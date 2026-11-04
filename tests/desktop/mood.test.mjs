import test from 'node:test';
import assert from 'node:assert/strict';
import { addDays } from '../../dist-electron/src/domain/tasks/model.js';
import { defaultFun, updateFun, validFun } from '../../dist-electron/src/shared/fun.js';
import { moodData, moodStreak, MOOD_REWARDS } from '../../dist-electron/src/shared/mood.js';
const day = d=>new Date(`${d}T12:00:00`);
const act=(f,p,d='2026-11-05')=>updateFun(f,p,day(d));
const select=(f,d,id='mood-1')=>act(f,{action:'mood',id},d);
test('legacy dated selection migrates only its real date, not fabricated history',()=>{
 const old={...defaultFun(),mood:{date:'2026-11-03',value:1}};
 assert.equal(validFun(old),true);
 assert.deepEqual(moodData(old).moodHistory,{'2026-11-03':'mood-1'});
 const next=select(old,'2026-11-05');
 assert.equal(moodStreak(moodData(next),'2026-11-05').days,1);
 assert.equal(Object.keys(next.moodHistory).length,2);
});
test('same-day edits replace that day, keep previous days and cannot repeat rewards',()=>{
 let f=defaultFun();
 for(const d of ['2026-11-03','2026-11-04','2026-11-05'])f=select(f,d);
 assert.deepEqual(f.wallpapers,['cloud-rest']);
 f=select(f,'2026-11-05');assert.equal(f.wallpapers.length,1);
 f=select(f,'2026-11-05','mood-0');
 assert.equal(moodStreak(moodData(f),'2026-11-05').days,1);
 assert.equal(f.moodHistory['2026-11-04'],'mood-1');
 assert.deepEqual(f.wallpapers,['cloud-rest']);
});
test('calendar streak crosses months, unlocks at 3/7/14 and stays after a gap',()=>{
 let f=defaultFun();
 for(let i=0;i<14;i++){
   f=select(f,addDays('2026-10-28',i));
   assert.equal(f.wallpapers.length,MOOD_REWARDS.filter(r=>r.days<=i+1).length);
 }
 assert.equal(moodStreak(moodData(f),'2026-11-11').days,14);
 assert.equal(moodStreak(moodData(f),'2026-11-11').selectedToday,false);
 assert.equal(moodStreak(moodData(f),'2026-11-12').days,0);
 f=select(f,'2026-11-13'); assert.equal(moodStreak(moodData(f),'2026-11-13').days,1);
 assert.equal(f.wallpapers.length,3);
});
test('custom stable ID survives rename/archive and history survives JSON roundtrip',()=>{
 let f=act(defaultFun(),{action:'save-mood',id:'custom-a',name:'灵魂出走',emoji:'🫠',color:'#687ed0'});
 f=select(f,'2026-11-03','custom-a');f=select(f,'2026-11-04','custom-a');
 f=act(f,{action:'save-mood',id:'custom-a',name:'正在充电',emoji:'😴',color:'#429caa'});
 f=select(f,'2026-11-05','custom-a');
 assert.equal(moodStreak(moodData(f),'2026-11-05').days,3);
 f=act(f,{action:'archive-mood',id:'custom-a'});
 assert.throws(()=>select(f,'2026-11-06','custom-a'));
 assert.equal(f.moodHistory['2026-11-05'],'custom-a');
 const restored=JSON.parse(JSON.stringify(f));assert.equal(validFun(restored),true);
 assert.equal(moodData(restored).moods.find(m=>m.id==='custom-a').archived,true);
 f=act(restored,{action:'archive-mood',id:'custom-a'});f=select(f,'2026-11-06','custom-a');
 assert.equal(moodStreak(moodData(f),'2026-11-06').days,4);
});
test('invalid options and orphaned history never enter persisted state',()=>{
 for(const patch of [{name:''},{name:'a'.repeat(13)},{emoji:'invalid'},{color:'red'},{id:'bad/id'}]){
   assert.throws(()=>act(defaultFun(),{action:'save-mood',id:'valid',name:'开心',emoji:'😎',color:'#629c71',...patch}));
 }
 const f=select(defaultFun(),'2026-11-05');
 assert.equal(validFun({...f,moodHistory:{'2026-02-30':'mood-0'}}),false);
 assert.equal(validFun({...f,moodHistory:{'2026-11-05':'missing'}}),false);
 assert.equal(validFun({...f,wallpapers:['missing']}),false);
 assert.equal(validFun({...f,moods:undefined}),false);
});
