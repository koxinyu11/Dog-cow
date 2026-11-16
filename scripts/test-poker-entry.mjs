/** Focused layout geometry check with fixture data. No screenshots or user data. */
import { build } from 'esbuild';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import electron from 'electron';
import net from 'node:net';
const running = await new Promise(resolve => {const s=net.connect(5180,'127.0.0.1');s.once('connect',()=>{s.destroy();resolve(true);});s.once('error',()=>resolve(false));});
if(running) throw Error('先结束本项目开发实例，避免并行实例。');
const dir=await mkdtemp(path.join(tmpdir(),'dogcow-poker-entry-'));
try {
 await build({stdin:{contents:`import React from 'react'; import {createRoot} from 'react-dom/client'; import Game from './src/renderer/features/playground/games/poker'; import './src/renderer/features/playground/playground.css';
 window.playground={poker:async()=>({view:{balance:900,reserve:12000,table:null,pending:false,leaving:false,lastSession:{brought:1000,returned:1500}}})};
 createRoot(document.getElementById('root')).render(<Game paused={false} diagnostics={{}}/>);`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,outfile:path.join(dir,'fixture.js'),platform:'browser',format:'iife',logLevel:'silent'});
 await writeFile(path.join(dir,'fixture.html'),`<!doctype html><html><head><link rel="stylesheet" href="fixture.css"></head><body><div class="pg-app is-playing"><section class="pg-game"><header class="pg-titlebar">几何检查 · 模拟数据</header><div class="pg-stage" id="root"></div></section></div><script src="fixture.js"></script></body></html>`);
 const runner=path.join(dir,'runner.cjs');
 await writeFile(runner,`const {app,BrowserWindow}=require('electron');const assert=require('node:assert/strict');app.setPath('userData',${JSON.stringify(path.join(dir,'profile'))});app.disableHardwareAcceleration();
 app.whenReady().then(async()=>{console.log('ENTRY_CHECK_READY');let win;try{win=new BrowserWindow({show:false,useContentSize:true,width:720,height:520,webPreferences:{contextIsolation:true,backgroundThrottling:false}});await win.loadFile(${JSON.stringify(path.join(dir,'fixture.html'))});
 console.log('ENTRY_FIXTURE_LOADED');for(const [width,height] of [[720,520],[960,680]]){win.setContentSize(width,height);await new Promise(r=>setTimeout(r,200));const data=await win.webContents.executeJavaScript(\`(()=>{const root=document.querySelector('.pk-root');const nodes=[...document.querySelectorAll('.pk-entry h1,.pk-entry button,.pk-entry input,.pk-session,.pk-top,.pk-top button')];return {width:innerWidth,height:innerHeight,scroll:root.scrollHeight-root.clientHeight,bounds:nodes.map(el=>{const r=el.getBoundingClientRect();return {text:el.textContent||el.ariaLabel,x:r.x,y:r.y,right:r.right,bottom:r.bottom}}),balanceCount:document.querySelectorAll('.pk-header-chips').length,entryText:document.querySelector('.pk-entry').textContent};})()\`);
 assert.ok(data.scroll<=1,JSON.stringify(data));for(const b of data.bounds)assert.ok(b.x>=-1&&b.y>=-1&&b.right<=data.width+1&&b.bottom<=data.height+1,JSON.stringify(b));assert.equal(data.balanceCount,1);assert.ok(!data.entryText.includes('可用筹码'));assert.ok(!data.entryText.includes('兑换筹码'));console.log('ENTRY_BOUNDS_OK',width,height);}
 }catch(e){console.error(e);process.exitCode=1;}finally{win?.destroy();app.quit();}});`);
 const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
 const code=await new Promise((resolve,reject)=>{const child=spawn(electron,[runner],{stdio:'inherit',env});const timer=setTimeout(()=>{child.kill();reject(Error('布局检查超时'));},20000);child.once('error',reject);child.once('exit',code=>{clearTimeout(timer);resolve(code);});});
 if(code!==0)throw Error(`布局检查失败：${code}`);
}finally{await rm(dir,{recursive:true,force:true});}
