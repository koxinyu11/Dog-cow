import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,readFile,writeFile,mkdir,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Repository } from '../../dist-electron/src/main/repository.js';
import { parseTasks, normalizeTask, addDays, matchesDate, weekDates } from '../../dist-electron/src/domain/tasks/model.js';
const setup=async t=>{const dir=await mkdtemp(path.join(tmpdir(),'dogcow-repository-test-'));t.after(()=>rm(dir,{recursive:true,force:true}));const repo=new Repository(dir);await repo.load();return repo;};
const taskKey='work-todolist-generic-v1';const homeKey='dogcow.home.v1';
const home={version:1,order:['progress','next-task','tasks','calendar','week-summary','income','work-time','clock','stolen'],enabled:[]};
test('serialized writes retain latest complete domains and recover after restart',async t=>{
 const repo=await setup(t);repo.storage.setItem(taskKey,JSON.stringify({tasks:[]}));const first=repo.flush();repo.storage.setItem(homeKey,JSON.stringify(home));const second=repo.flush();await Promise.all([first,second]);assert.equal(repo.dirty,false);
 const reload=new Repository(repo.directory);await reload.load();assert.equal(reload.storage.getItem(homeKey),JSON.stringify(home));assert.equal(reload.storage.getItem(taskKey),'{"tasks":[]}');
});
test('unreadable root snapshot is never replaced by empty startup data',async t=>{
 const repo=await setup(t);await writeFile(repo.file,'{broken');await repo.load();assert.ok(repo.readError);assert.throws(()=>repo.storage.setItem(taskKey,'{"tasks":[]}'));assert.equal(await readFile(repo.file,'utf8'),'{broken');
});
test('bad task payload is preserved when valid layout saves, without replacing last valid backup',async t=>{
 const repo=await setup(t);repo.storage.setItem(taskKey,'{"tasks":[]}');assert.equal(await repo.flush(),true);repo.storage.setItem(homeKey,JSON.stringify(home));await repo.flush();const backup=await readFile(`${repo.file}.bak`,'utf8');
 const raw=JSON.parse(await readFile(repo.file,'utf8'));raw.values[taskKey]='{bad tasks';await writeFile(repo.file,JSON.stringify(raw));const reload=new Repository(repo.directory);await reload.load();reload.storage.setItem(homeKey,JSON.stringify({...home,enabled:['tasks']}));assert.equal(await reload.flush(),true);assert.equal(reload.storage.getItem(taskKey),'{bad tasks');assert.equal(await readFile(`${repo.file}.bak`,'utf8'),backup);
});
test('failed replacement keeps dirty state and retry saves latest memory',async t=>{
 const repo=await setup(t);await mkdir(repo.file);repo.storage.setItem(taskKey,'{"tasks":[]}');assert.equal(await repo.flush(),false);assert.equal(repo.dirty,true);await rm(repo.file,{recursive:true});repo.storage.setItem(homeKey,JSON.stringify(home));assert.equal(await repo.flush(),true);assert.equal(repo.dirty,false);assert.equal(JSON.parse(await readFile(repo.file,'utf8')).values[homeKey],JSON.stringify(home));
});
test('task migration retains ids and extension values, moving date leaves deadline intact',()=>{
 const state=parseTasks(JSON.stringify({tasks:[{id:'original',date:'2026-11-04',dueDate:'2026-11-06',title:'synthetic',extension:{a:1}}]}),()=> 'new-tag');assert.equal(state.tasks[0].id,'original');assert.deepEqual(state.tasks[0].extension,{a:1});state.tasks[0].date=addDays(state.tasks[0].date,1);assert.equal(state.tasks[0].dueDate,'2026-11-06');assert.equal(matchesDate(state.tasks[0],'2026-11-06'),true);
});
test('task validation rejects duplicate identities and impossible dates',()=>{
 const raw={id:'same',date:'2026-02-30',title:'synthetic'};assert.throws(()=>normalizeTask(raw,()=> 'tag'));raw.date='2026-11-04';assert.throws(()=>parseTasks(JSON.stringify({tasks:[raw,raw]}),()=> 'tag'));assert.deepEqual(weekDates('2026-11-04'),['2026-11-02','2026-11-03','2026-11-04','2026-11-05','2026-11-06','2026-11-07','2026-11-08']);
});

test('personalized titles survive save and restart, old settings gain module defaults', async t => {
 const repo = await setup(t);
 const old = parseTasks(JSON.stringify({tasks: [], settings: {appTitle: '我的桌面'}}), () => 'id');
 assert.equal(old.settings.appTitle, '我的桌面');
 assert.equal(old.settings.incomeTitle, '实时收入');
 assert.equal(old.settings.calendarTitle, '');
 const settings = Object.fromEntries(Object.keys(old.settings).map(key => [key, `自定义-${key}`]));
 settings.dateLine = '';
 settings.tasksTitle = '';
 settings.calendarTitle = '';
 repo.storage.setItem(taskKey, JSON.stringify({...old, settings}));
 assert.equal(await repo.flush(), true);
 const reload = new Repository(repo.directory);
 await reload.load();
 assert.deepEqual(parseTasks(reload.storage.getItem(taskKey), () => 'id').settings, settings);
});

test('paid toilet and attendance candidate survive failed flush and a single retry together', async t => {
 const repo = await setup(t);
 const key = 'dogcow.paid-toilet.v1';
 const activity = JSON.stringify({version:1,records:[{id:'synthetic',startAt:100,endAt:200,status:'completed',endReason:'lunch'}]});
 repo.storage.setItem(key,activity);
 repo.storage.setItem('niuma-calculator.settings.v4','{"candidate":"same-commit"}');
 await mkdir(repo.file);
 assert.equal(await repo.flush(),false);
 assert.equal(repo.storage.getItem(key),activity);
 await rm(repo.file,{recursive:true});
 assert.equal(await repo.flush(),true);
 const reload = new Repository(repo.directory); await reload.load();
 assert.equal(reload.storage.getItem(key),activity);
 assert.equal(reload.storage.getItem('niuma-calculator.settings.v4'),'{"candidate":"same-commit"}');
});
