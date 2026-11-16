import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, mkdir, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DesktopNotesStore } from '../../dist-electron/src/main/desktop-notes-store.js';
import { DesktopNotesPreferences } from '../../dist-electron/src/main/desktop-notes-preferences.js';
import { Repository } from '../../dist-electron/src/main/repository.js';
import { DESKTOP_NOTES_KEY, parseDesktopNotes, projectTasks } from '../../dist-electron/src/shared/desktop-notes.js';
import { parseTasks } from '../../dist-electron/src/domain/tasks/model.js';
import { collectLegacy, createTransfer, parseTransfer, beginRestore } from '../../src/migration/transfer.js';
const taskKey = 'work-todolist-generic-v1';
const tasks = parseTasks(JSON.stringify({tasks:[{id:'a',title:'实际任务 A',date:'2026-11-16'},{id:'b',title:'实际任务 B',date:'2026-11-16'}]}),()=> 'tag').tasks;
const memory = () => {
 const values = new Map();
 return { values, getItem:key=>values.get(key)??null, setItem:(key,value)=>values.set(key,value), removeItem:key=>values.delete(key), get length(){return values.size}, key:i=>[...values.keys()][i] };
};
const setup = () => { const storage=memory(); const store=new DesktopNotesStore(storage); store.load(); return {storage,store,run:p=>store.execute({...p,expectedNotesRevision:store.view().revision},tasks)}; };
const temp = async t => { const dir=await mkdtemp(path.join(tmpdir(),'dogcow-notes-test-'));t.after(()=>rm(dir,{recursive:true,force:true}));return dir; };

test('single pin deduplicates, list membership is ordered, visibility/removal never modifies tasks',()=>{
 const {store,run}=setup(); const before=structuredClone(tasks);
 const id=run({action:'pin',taskIds:['a']});assert.equal(run({action:'pin',taskIds:['a']}),id);assert.equal(store.view().notes.length,1);
 const list=run({action:'create',title:'收尾',taskIds:['b','a']});assert.equal(store.get(list).kind,'list');
 run({action:'update',id:list,title:'重新排列',taskIds:['a','b']});assert.deepEqual(store.get(list).taskIds,['a','b']);
 run({action:'visible',id,visible:false});assert.equal(store.get(id).visible,false);run({action:'pin',taskIds:['a']});assert.equal(store.get(id).visible,true);
 run({action:'remove',id:list});assert.equal(store.get(list),undefined);assert.deepEqual(tasks,before);
});
test('bad revision, duplicate members, stale tasks and invalid single cardinality reject without writing',()=>{
 const {store,storage,run}=setup();const id=run({action:'pin',taskIds:['a']});const raw=storage.getItem(DESKTOP_NOTES_KEY);
 assert.throws(()=>store.execute({action:'remove',id,expectedNotesRevision:0},tasks),/变化/);
 for(const p of [{action:'create',taskIds:['a','a']},{action:'pin',taskIds:['a','b']},{action:'create',taskIds:['missing']}]) assert.throws(()=>run(p));
 assert.equal(storage.getItem(DESKTOP_NOTES_KEY),raw);
});
test('projections share live task state; deletion drops single notes and preserves empty named lists',()=>{
 const {store,run}=setup(); const single=run({action:'pin',taskIds:['a']});const list=run({action:'create',title:'保留标题',taskIds:['a']});
 const updated=structuredClone(tasks);updated[0].done=true;updated[0].progress=100;updated[0].title='新标题';
 for(const id of [single,list]) assert.deepEqual(projectTasks(store.get(id),updated).map(t=>[t.title,t.done,t.progress]),[['新标题',true,100]]);
 store.prune([updated[1]]);assert.equal(store.get(single),undefined);assert.deepEqual(store.get(list).taskIds,[]);assert.equal(store.get(list).title,'保留标题');
});
test('corrupt note data remains untouched and locked; malicious reserved ids are rejected',()=>{
 const storage=memory();storage.setItem(DESKTOP_NOTES_KEY,'{broken');const store=new DesktopNotesStore(storage);store.load();assert.ok(store.view().error);
 assert.throws(()=>store.execute({action:'pin',taskIds:['a'],expectedNotesRevision:0},tasks));assert.equal(storage.getItem(DESKTOP_NOTES_KEY),'{broken');
 assert.throws(()=>parseDesktopNotes(JSON.stringify({version:1,revision:0,lineVisible:true,notes:[{id:'__proto__',kind:'single',title:'',taskIds:['a'],visible:true}]})));
});
test('failed disk save retains note candidate; retry/restart saves the same identities',async t=>{
 const dir=await temp(t);const repo=new Repository(dir);await repo.load();repo.storage.setItem(taskKey,JSON.stringify({tasks}));await repo.flush();
 const store=new DesktopNotesStore(repo.storage);store.load();const id=store.execute({action:'create',title:'重试',taskIds:['a','b'],expectedNotesRevision:0},tasks);
 await rm(repo.file);await mkdir(repo.file);assert.equal(await repo.flush(),false);assert.equal(store.view().notes[0].id,id);
 await rm(repo.file,{recursive:true});assert.equal(await repo.flush(),true);const reloaded=new Repository(dir);await reloaded.load();const notes=new DesktopNotesStore(reloaded.storage);notes.load();assert.equal(notes.view().notes[0].id,id);
});
test('portable backup round-trip carries membership and rejects missing-task references; old restore clears notes',async()=>{
 const {store,storage,run}=setup();storage.setItem(taskKey,JSON.stringify({tasks}));const id=run({action:'create',title:'备份',taskIds:['b','a']});
 const pack=await createTransfer(storage,{app:'dogcow-test'},new Date('2026-11-16T00:00:00Z'));
 const parsed=await parseTransfer(JSON.stringify(pack));assert.equal(parseDesktopNotes(parsed.pack.values[DESKTOP_NOTES_KEY]).notes[0].id,id);
 const broken={...collectLegacy(storage),[taskKey]:JSON.stringify({tasks:[]})};assert.throws(()=>beginRestore(memory(),broken),/不存在/);
 const old={...collectLegacy(storage)};delete old[DESKTOP_NOTES_KEY];beginRestore(storage,old);assert.equal(storage.getItem(DESKTOP_NOTES_KEY),null);
});
test('placement survives restart, failed write retries, and corrupted coordinates require explicit backup/reset',async t=>{
 const dir=await temp(t);const prefs=new DesktopNotesPreferences(dir);await prefs.load();
 const rect={x:-700,y:200,width:324,height:354};const placement={bounds:rect,desktop:rect,displayId:'2',hanging:true,expanded:false,anchor:.35};
 prefs.update({note:placement},'2');assert.equal(await prefs.flush(),true);const reload=new DesktopNotesPreferences(dir);await reload.load();assert.deepEqual(reload.value.notes.note,placement);
 const file=path.join(dir,'desktop-notes-preferences.json');await rm(file);await mkdir(file);prefs.update({note:{...placement,anchor:.6}},'2');assert.equal(await prefs.flush(),false);await rm(file,{recursive:true});assert.equal(await prefs.flush(),true);
 await writeFile(file,'{bad');const damaged=new DesktopNotesPreferences(dir);await damaged.load();damaged.update({},'1');assert.equal(await damaged.flush(),false);assert.equal(await readFile(file,'utf8'),'{bad');assert.equal(await damaged.reset(),true);assert.ok((await readdir(dir)).some(name=>name.includes('.invalid-')));
});

test('a corrupt notes domain cannot replace the last valid repository backup', async t => {
 const dir=await temp(t);const repo=new Repository(dir);await repo.load();repo.storage.setItem(taskKey,JSON.stringify({tasks}));
 const store=new DesktopNotesStore(repo.storage);store.load();store.execute({action:'pin',taskIds:['a'],expectedNotesRevision:0},tasks);await repo.flush();
 repo.storage.setItem('dogcow.home.v1',JSON.stringify({version:1,order:[],enabled:[]}));await repo.flush();
 const backup=await readFile(`${repo.file}.bak`,'utf8');const data=JSON.parse(await readFile(repo.file,'utf8'));data.values[DESKTOP_NOTES_KEY]='{broken notes';await writeFile(repo.file,JSON.stringify(data));
 const reload=new Repository(dir);await reload.load();reload.storage.setItem('dogcow.home.v1','{"version":1,"order":[],"enabled":["tasks"]}');await reload.flush();
 assert.equal(await readFile(`${repo.file}.bak`,'utf8'),backup);assert.equal(reload.storage.getItem(DESKTOP_NOTES_KEY),'{broken notes');
});

test('legacy placement preferences default to non-topmost; new layer and height settings survive updates/reset',async t=>{
 const dir=await temp(t);const file=path.join(dir,'desktop-notes-preferences.json');
 await writeFile(file,JSON.stringify({version:1,displayId:'7',notes:{}}));
 const prefs=new DesktopNotesPreferences(dir);await prefs.load();assert.equal(prefs.value.alwaysOnTop,false);assert.equal(prefs.value.lineOffset,48);
 prefs.setAlwaysOnTop(false);prefs.update({},'7',180);assert.equal(await prefs.flush(),true);
 const next=new DesktopNotesPreferences(dir);await next.load();assert.equal(next.value.alwaysOnTop,false);assert.equal(next.value.lineOffset,180);
 await next.reset();assert.equal(next.value.alwaysOnTop,false);assert.equal(next.value.lineOffset,48);
});
