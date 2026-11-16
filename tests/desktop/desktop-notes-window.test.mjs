import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtemp, readFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { build } from 'esbuild';
import { sampleNotes } from '../../dist-electron/src/shared/desktop-notes-prototype.js';
const ipc = new EventEmitter();const screen = new EventEmitter();
const display={id:7,workArea:{x:-1000,y:30,width:1920,height:1050}};
let displays=[display]; let topFailureId;
let cursor={x:850,y:1000};let failLoad=false;let holdLoad;const instances=[];const shortcuts=new Set();
Object.assign(screen,{getAllDisplays:()=>displays,getPrimaryDisplay:()=>display,getDisplayMatching:r=>displays.find(d=>r.x+r.width/2>=d.workArea.x && r.x+r.width/2<d.workArea.x+d.workArea.width)??display,getDisplayNearestPoint:p=>displays.find(d=>p.x>=d.workArea.x && p.x<d.workArea.x+d.workArea.width)??display,getCursorScreenPoint:()=>cursor});
class Window extends EventEmitter {
 constructor(options){super();this.options=options;this.bounds={x:0,y:0,width:options.width,height:options.height};this.webContents=new EventEmitter();this.destroyed=false;this.resizeCount=0;this.webContents.mainFrame={url:''};Object.assign(this.webContents,{isLoadingMainFrame:()=>false,send:(_channel,value)=>{this.view=structuredClone(value)},setWindowOpenHandler(){},session:{setPermissionRequestHandler(){}}});instances.push(this)}
 async loadURL(url){if(failLoad)throw Error('load failed');this.webContents.mainFrame.url=url;if(holdLoad)await holdLoad;ipc.emit('dogcow:desktop-note',{sender:this.webContents,senderFrame:this.webContents.mainFrame},{action:'ready'})}
 setAlwaysOnTop(value){if(topFailureId && this.view?.role===topFailureId && !value){topFailureId=undefined;throw Error('native layer failed')}this.topmost=value} setIgnoreMouseEvents(value){this.ignored=value} getBounds(){return {...this.bounds}} setBounds(value){this.bounds={...value};this.resizeCount++} setPosition(x,y){this.bounds.x=x;this.bounds.y=y} moveTop(){} showInactive(){this.shown=true} isDestroyed(){return this.destroyed} destroy(){this.destroyed=true}
}
globalThis.__notesNative={BrowserWindow:Window,ipcMain:ipc,screen,globalShortcut:{register(key){shortcuts.add(key);return true},unregister(key){shortcuts.delete(key)}}};
const bundled=await build({entryPoints:['dist-electron/src/main/desktop-notes-controller.js'],bundle:true,write:false,platform:'node',format:'esm',plugins:[{name:'native-fixture',setup(b){b.onResolve({filter:/^electron$/},()=>({path:'electron',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const { BrowserWindow, ipcMain, screen, globalShortcut } = globalThis.__notesNative;'}))}}]});
const {createDesktopNotesController}=await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function setup(t){
 displays=[display];topFailureId=undefined;holdLoad=undefined;cursor={x:850,y:1000};
 const profile=await mkdtemp(path.join(tmpdir(),'dogcow-native-notes-test-'));const model={notes:sampleNotes(),lineVisible:true,revision:7,pending:false,error:''};const start=instances.length;const calls=[];let controller;
 controller=createDesktopNotesController({profile,preload:'desktop-notes.cjs',url:'dogcow://app/desktop-notes.html',data:()=>model,toggle:async(...args)=>{calls.push(args)},retry:async()=>{},hide:async id=>{if(id==='line')model.lineVisible=false;else {const note=model.notes.find(note=>note.id===id);if(note)note.visible=false}},manage:()=>{},changed:()=>controller.refresh()});
 t.after(async()=>{controller.dispose();await rm(profile,{recursive:true,force:true})});await controller.initialize();
 const own=()=>instances.slice(start).filter(win=>!win.destroyed);const note=id=>own().find(win=>win.view?.role===id);
 const send=(win,command,frame=win.webContents.mainFrame)=>ipc.emit('dogcow:desktop-note',{sender:win.webContents,senderFrame:frame},command);
 return {controller,model,calls,own,note,send,profile};
}
test('line uses display width; each surface gets only its own task projection; forged frames cannot mutate',async t=>{
 const {note,calls,send}=await setup(t);assert.equal(note('line').bounds.width,1920);assert.equal(note('line').bounds.x,-1000);assert.deepEqual(note('line').view.notes,[]);
 const single=note('single');assert.equal(single.view.notes.length,1);assert.equal(single.view.notes[0].id,'single');
 send(single,{action:'toggle',id:'contract',revision:7,requestId:'native-1'},{url:single.webContents.mainFrame.url});await wait(20);assert.equal(calls.length,0);
 send(single,{action:'toggle',id:'design',revision:7,requestId:'native-2'});await wait(20);assert.equal(calls.length,0);
 send(single,{action:'toggle',id:'contract',revision:7,requestId:'native-3'});await wait(20);assert.deepEqual(calls,[['single','contract',7,'native-3']]);
});
test('click preview never resizes native window; hover has no effect, hide/show and restart retain placement',async t=>{
 const {controller,note,send,model}=await setup(t);let single=note('single');send(single,{action:'hang'});await wait(200);assert.equal(single.view.notes[0].expanded,false);
 const count=single.resizeCount;cursor={x:single.bounds.x+single.bounds.width/2,y:single.bounds.y+45};await wait(300);assert.equal(single.view.notes[0].expanded,false);
 send(single,{action:'preview'});assert.equal(single.view.notes[0].expanded,true);assert.equal(single.resizeCount,count);
 model.lineVisible=false;controller.refresh();await wait(30);assert.equal(note('single'),undefined);
 model.lineVisible=true;controller.refresh();await wait(50);single=note('single');assert.ok(single);assert.equal(single.view.notes[0].hanging,true);assert.equal(single.bounds.width,284);
 assert.equal(await controller.flush(),true);
});
test('failed page creation cleans its window, does not block task work, and requires explicit reveal to retry',async t=>{
 failLoad=true;const context=await setup(t);failLoad=false;assert.ok(context.controller.windowError);assert.equal(context.own().length,0);
 context.controller.reveal();await wait(70);assert.equal(context.own().length,3);assert.equal(context.controller.windowError,'');
});


test('topmost switch applies immediately, new windows inherit, and native failure restores prior levels',async t=>{
 const {controller,model,own,note,profile}=await setup(t);
 assert.ok(own().every(win=>!win.topmost));await controller.setAlwaysOnTop(true);assert.equal(await controller.setAlwaysOnTop(false),true);
 assert.ok(own().every(win=>!win.topmost));assert.equal(controller.alwaysOnTop,false);
 model.notes.push({id:'late',kind:'single',title:'late',tasks:[{id:'late-task',title:'later',done:false}]});controller.refresh();await wait(50);
 const late=note('late');
 assert.ok(late,'a refresh requested before the previous finalizer must not be lost');
 assert.equal(late.topmost,false);
 const saved=JSON.parse(await readFile(path.join(profile,'desktop-notes-preferences.json'),'utf8'));assert.equal(saved.alwaysOnTop,false);
 await controller.setAlwaysOnTop(true);topFailureId='list';await assert.rejects(controller.setAlwaysOnTop(false),/置顶/);
 assert.equal(controller.alwaysOnTop,true);assert.ok(own().every(win=>win.topmost));
});
test('unsaved topmost preference keeps its live effect and is persisted by save retry',async t=>{
 const {controller,own,profile}=await setup(t);await controller.flush();
 const file=path.join(profile,'desktop-notes-preferences.json');await rm(file);await mkdir(file);
 assert.equal(await controller.setAlwaysOnTop(false),false);assert.equal(controller.layoutPending,true);assert.ok(own().every(win=>!win.topmost));
 await rm(file,{recursive:true});assert.equal(await controller.flush(),true);assert.equal(controller.layoutPending,false);
 assert.equal(JSON.parse(await readFile(file,'utf8')).alwaysOnTop,false);
});
test('dragging either endpoint carries hanging notes, leaves desktop notes, and can be cancelled',async t=>{
 const {controller,note,send}=await setup(t);const line=note('line'),single=note('single'),list=note('list');
 send(single,{action:'hang'});await wait(200);
 const before={line:line.getBounds(),single:single.getBounds(),list:list.getBounds()};
 cursor={x:before.line.x+22,y:before.line.y+33};send(line,{action:'begin',...cursor});
 cursor={x:cursor.x,y:cursor.y+100};await wait(40);
 assert.equal(line.bounds.y,before.line.y+100);assert.equal(single.bounds.y,before.single.y+100);assert.deepEqual(list.getBounds(),before.list);
 send(line,{action:'cancel'});assert.deepEqual(line.getBounds(),before.line);assert.deepEqual(single.getBounds(),before.single);
 cursor={x:before.line.x+before.line.width-22,y:before.line.y+33};send(line,{action:'begin',...cursor});
 cursor={x:cursor.x,y:cursor.y+80};send(line,{action:'end',...cursor});
 assert.equal(line.bounds.y,before.line.y+80);assert.equal(single.bounds.y,before.single.y+80);assert.deepEqual(list.getBounds(),before.list);
 assert.equal(await controller.flush(),true);
});
test('cross-display line drag keeps native width until release, then saves new width, height and anchors',async t=>{
 const {controller,note,send,profile}=await setup(t);
 const second={id:8,workArea:{x:920,y:10,width:1280,height:900}};displays=[display,second];
 const line=note('line'),single=note('single');send(single,{action:'hang'});await wait(200);
 const before=line.getBounds();const anchor=(single.bounds.x+single.bounds.width/2-before.x)/before.width;const resizes=line.resizeCount;
 cursor={x:before.x+22,y:before.y+33};send(line,{action:'begin',...cursor});
 cursor={x:1000,y:200};await wait(40);assert.equal(line.bounds.width,1920);assert.equal(line.resizeCount,resizes);
 send(line,{action:'end',...cursor});assert.equal(line.bounds.x,920);assert.equal(line.bounds.width,1280);assert.equal(line.resizeCount,resizes+1);
 assert.ok(Math.abs((single.bounds.x+single.bounds.width/2-line.bounds.x)/line.bounds.width-anchor)<.002);
 await controller.flush();const saved=JSON.parse(await readFile(path.join(profile,'desktop-notes-preferences.json'),'utf8'));
 assert.equal(saved.displayId,'8');assert.equal(saved.lineOffset,line.bounds.y-second.workArea.y);
});


test('native topmost application failure rolls back all existing windows and preserves the stored flag',async t=>{
 const {controller,own}=await setup(t);await controller.setAlwaysOnTop(true);topFailureId='list';
 await assert.rejects(controller.setAlwaysOnTop(false),/置顶/);
 assert.equal(controller.alwaysOnTop,true);assert.ok(own().every(win=>win.topmost));
});

test('idle line controls do not intercept clicks; adjustment reveals them and idle hides them again',async t=>{
 const {note,send}=await setup(t);const line=note('line');const b=line.getBounds();
 cursor={x:b.x+b.width-65,y:b.y+15};await wait(40);
 assert.equal(line.view.lineAdjusting,false);assert.equal(line.ignored,true);
 cursor={x:b.x+22,y:b.y+33};send(line,{action:'begin',...cursor});send(line,{action:'end',...cursor});
 cursor={x:b.x+b.width-65,y:b.y+15};await wait(40);assert.equal(line.view.lineAdjusting,true);assert.equal(line.ignored,false);
 await wait(2100);assert.equal(line.view.lineAdjusting,true,'hovering visible controls keeps them available');
 send(line,{action:'lineControlsFocus',focused:true});cursor={x:850,y:1000};await wait(2100);assert.equal(line.view.lineAdjusting,true);
 send(line,{action:'lineControlsFocus',focused:false});await wait(2100);assert.equal(line.view.lineAdjusting,false);
 cursor={x:b.x+b.width-65,y:b.y+15};await wait(40);assert.equal(line.ignored,true);assert.equal(line.view.lineAdjusting,false);
 cursor={x:b.x+22,y:b.y+33};send(line,{action:'begin',...cursor});assert.equal(line.view.lineAdjusting,true);
 send(line,{action:'end',...cursor});cursor={x:850,y:1000};await wait(2100);assert.equal(line.view.lineAdjusting,false);
});
test('direct hide is restricted to its own note and restores unchanged task data',async t=>{
 const {controller,model,note,send}=await setup(t);const single=note('single');const tasks=structuredClone(model.notes[0].tasks);
 send(single,{action:'hide'},{url:single.webContents.mainFrame.url});await wait(20);assert.ok(note('single'));
 send(single,{action:'hide',id:'list'});await wait(50);assert.equal(note('single'),undefined);assert.ok(note('list'));
 assert.deepEqual(model.notes[0].tasks,tasks);model.notes[0].visible=true;controller.reveal('single');await wait(50);
 assert.ok(note('single'));assert.deepEqual(note('single').view.notes[0].tasks,tasks);
});

test('renderer loss ends a note drag and releases Escape before explicit recovery',async t=>{
 const {controller,note,send}=await setup(t);const single=note('single');const b=single.getBounds();
 cursor={x:b.x+b.width/2,y:b.y+15};send(single,{action:'begin',...cursor});
 cursor={x:cursor.x+60,y:cursor.y+80};await wait(35);assert.ok(shortcuts.has('Escape'));
 single.webContents.emit('render-process-gone',{}, {reason:'crashed'});
 assert.equal(single.destroyed,true);assert.equal(shortcuts.has('Escape'),false);
 await wait(200);assert.equal(note('single'),undefined);assert.ok(controller.windowError);
 controller.reveal('single');await wait(50);assert.ok(note('single'));
});
test('renderer loss clears settling motion and safely cancels a clothesline drag',async t=>{
 const {controller,note,send}=await setup(t);const single=note('single');send(single,{action:'hang'});
 single.webContents.emit('render-process-gone',{}, {reason:'crashed'});await wait(200);assert.equal(note('single'),undefined);
 controller.reveal('single');await wait(50);const restored=note('single');const line=note('line');const b=line.getBounds();const before=restored.getBounds();
 cursor={x:b.x+22,y:b.y+33};send(line,{action:'begin',...cursor});cursor={x:cursor.x,y:cursor.y+80};await wait(35);
 line.webContents.emit('render-process-gone',{}, {reason:'crashed'});
 assert.equal(shortcuts.has('Escape'),false);assert.deepEqual(restored.getBounds(),before);await wait(50);
 assert.equal(note('line'),undefined);assert.ok(note('list'));
});
test('reset positions explicitly recreates failed windows and reports repeated failure without losing tasks',async t=>{
 const {controller,note,model}=await setup(t);const tasks=structuredClone(model.notes.map(note=>note.tasks));
 note('single').webContents.emit('render-process-gone',{}, {reason:'crashed'});
 assert.equal(await controller.resetPositions(),true);await wait(40);assert.ok(note('single'));assert.equal(controller.windowError,'');
 note('list').webContents.emit('render-process-gone',{}, {reason:'crashed'});failLoad=true;
 try { assert.equal(await controller.resetPositions(),true);await wait(40);assert.ok(controller.windowError);assert.ok(note('single')); }
 finally { failLoad=false; }
 assert.deepEqual(model.notes.map(note=>note.tasks),tasks);
 assert.equal(await controller.resetPositions(),true);await wait(40);assert.ok(note('list'));
});
test('position recovery saves preferences without waiting for a replacement page handshake',async t=>{
 const {controller,note,send,calls}=await setup(t);note('single').webContents.emit('render-process-gone',{}, {reason:'crashed'});
 let release;holdLoad=new Promise(resolve=>{release=resolve});
 try {
   assert.equal(await Promise.race([controller.resetPositions(),wait(500).then(()=> 'blocked')]),true);
   send(note('list'),{action:'toggle',id:note('list').view.notes[0].tasks[0].id,revision:7,requestId:'during-recovery'});
   await wait(20);assert.equal(calls.length,1);
 } finally { holdLoad=undefined;release(); }
 await wait(40);assert.ok(note('single'));assert.equal(controller.windowError,'');
});

test('partial recovery keeps the errors of other windows until each retry succeeds',async t=>{
 failLoad=true;const {controller,own}=await setup(t);failLoad=false;
 assert.equal(own().length,0);assert.match(controller.windowError,/3 个/);
 controller.reveal('single');assert.match(controller.windowError,/3 个/);await wait(50);
 assert.equal(own().length,1);assert.match(controller.windowError,/2 个/);
 failLoad=true;controller.reveal('list');await wait(50);failLoad=false;
 assert.equal(own().length,1);assert.match(controller.windowError,/2 个/);
 controller.reveal('list');await wait(50);assert.equal(own().length,2);assert.ok(controller.windowError);
 controller.reveal('line');await wait(50);assert.equal(own().length,3);assert.equal(controller.windowError,'');
});
test('hiding the clothesline while a hanging note loads cancels it without a window failure',async t=>{
 const {controller,note,send,model}=await setup(t);send(note('single'),{action:'hang'});await wait(200);
 model.lineVisible=false;controller.refresh();await wait(40);assert.equal(note('single'),undefined);
 let release;holdLoad=new Promise(resolve=>{release=resolve});
 model.lineVisible=true;controller.reveal();await wait(20);
 model.lineVisible=false;controller.refresh();holdLoad=undefined;release();await wait(80);
 assert.equal(controller.windowError,'');assert.equal(note('single'),undefined);assert.equal(note('line'),undefined);assert.ok(note('list'));
 model.lineVisible=true;controller.refresh();await wait(60);
 assert.ok(note('single')?.shown);assert.equal(note('single').view.notes[0].hanging,true);assert.equal(controller.windowError,'');
});
test('a cancelled page load rejection is not retained as a failure or retried by a late event',async t=>{
 const {controller,note,model,send}=await setup(t);const original=note('single');
 original.webContents.emit('render-process-gone',{}, {reason:'crashed'});
 let rejectLoad;holdLoad=new Promise((_resolve,reject)=>{rejectLoad=reject});controller.reveal('single');await wait(20);
 model.notes.find(note=>note.id==='single').visible=false;controller.refresh();holdLoad=undefined;rejectLoad(Error('cancelled load'));await wait(60);
 assert.equal(controller.windowError,'');assert.equal(note('single'),undefined);
 model.notes.find(note=>note.id==='single').visible=true;controller.reveal('single');await wait(50);const replacement=note('single');assert.ok(replacement?.shown);
 original.webContents.emit('render-process-gone',{}, {reason:'crashed'});await wait(20);
 assert.equal(note('single'),replacement);assert.equal(controller.windowError,'');
 send(replacement,{action:'hang'});await wait(200);assert.equal(replacement.view.notes[0].hanging,true);
});
