import test from 'node:test';
import assert from 'node:assert/strict';
import { act, startTable, score, handName, pot, legal, assertTable } from '../../dist-electron/src/shared/poker/engine.js';
import { Poker } from '../../dist-electron/src/main/poker.js';
import { Coins } from '../../dist-electron/src/main/coins.js';
import { COINS_KEY, emptyCoins } from '../../dist-electron/src/shared/coins.js';
const deck=()=>Array.from({length:52},(_,i)=>i);
const card=(r,s=0)=>s*13+r-2;
test('hand evaluation: wheel, flush, full house, kickers and shared board',()=>{
 const wheel=[14,2,3,4,5].map((r,i)=>card(r,i%4));
 assert.equal(handName(wheel),'顺子');
 assert.ok(score([2,3,4,5,6].map((r,i)=>card(r,i%4)))>score(wheel));
 assert.equal(handName([card(14),card(14,1),card(14,2),card(13),card(13,1),card(2),card(3)]),'葫芦');
 assert.ok(score([card(14),card(14,1),card(13),card(8),card(4)])>score([card(14),card(14,1),card(12),card(8),card(4)]));
 assert.equal(handName([10,11,12,13,14].map(r=>card(r,2))),'同花顺');
});
test('random legal hands terminate and conserve every chip',()=>{
 let seed=71;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/2**32;};
 for(let round=0;round<160;round++){
  const cards=deck();for(let i=51;i>0;i--){const j=Math.floor(random()*(i+1));[cards[i],cards[j]]=[cards[j],cards[i]];}
  let t=startTable([1000,30+round,100,400,900],round%5,cards,`r${round}`);let steps=0;
  while(!t.done&&steps++<180){const l=legal(t),r=random();t=act(t,r<.13?'fold':r<.35&&l.raise?'raise':l.call?'call':'check',r<.35&&l.raise?l.max:undefined);assertTable(t);}
  assert.ok(t.done,`round ${round} must terminate`);assert.equal(pot(t),0);assert.equal(t.seats.reduce((n,s)=>n+s.chips,0),t.initial);
 }
});
test('short all-in does not reopen raising; cumulative full increment does',()=>{
 let t=startTable([1000,25,1000,1000,1000],0,deck(),'short');
 t=act(t,'call');t=act(t,'call');t=act(t,'raise',20);t=act(t,'raise',25);t=act(t,'call');
 assert.equal(t.turn,3);assert.equal(legal(t).raise,true);t=act(t,'call');t=act(t,'call');assert.equal(t.turn,0);assert.equal(legal(t).raise,false);
});
function service(){const data=new Map([[COINS_KEY,JSON.stringify({...emptyCoins(),balance:100})]]);const store={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};const coins=new Coins(store,()=>({}));coins.load();return {data,store,coins,poker:new Poker(store,coins)};}
const req=(action,extra={})=>({action,createdAt:Date.now(),requestId:crypto.randomUUID(),...extra});
test('exchange and join are separate; candidates, duplicate requests and reload are safe',()=>{
 const {coins,poker,store}=service();const exchange=req('exchangeCoins',{amount:20});poker.execute(exchange);
 assert.equal(coins.view().balance,100);assert.equal(poker.view().reserve,0);assert.equal(poker.view().table,null);assert.equal(poker.view().pending,true);assert.throws(()=>poker.execute(req('join',{amount:2000})));
 coins.confirmSaved();poker.confirmSaved();assert.equal(coins.view().balance,80);assert.equal(poker.view().reserve,2000);
 poker.execute(exchange);assert.equal(coins.view().balance,80);assert.equal(poker.view().reserve,2000);
 const join=req('join',{amount:1600});poker.execute(join);coins.confirmSaved();poker.confirmSaved();poker.execute(join);
 assert.equal(coins.view().balance,80);assert.equal(poker.view().reserve,400);
 const view=new Poker(store,coins).view();assert.equal(view.table.deck.length,0);assert.equal(view.table.seats[0].chips,1600);assert.equal(view.table.seats[0].hand.length,2);assert.equal(view.table.seats[1].hand.length,0);
});
function fundAndJoin(poker,coins){poker.execute(req('exchangeCoins',{amount:10}));coins.confirmSaved();poker.confirmSaved();poker.execute(req('join',{amount:1000}));coins.confirmSaved();poker.confirmSaved();}
test('fold, cash out, duplicate leave and fresh service cannot duplicate payout',()=>{
 const {coins,poker,store}=service();const save=()=>{coins.confirmSaved();poker.confirmSaved();};fundAndJoin(poker,coins);
 let t=poker.view().table;
 // Other players fold until human wins; all requests pass the same authoritative path.
 while(!t.done){poker.execute(req(t.turn===0?'act':'bot',{tableId:t.id,revision:t.revision,move:'fold'}),{move:'fold'});save();t=poker.view().table;}
 const leave=req('leave');poker.execute(leave);save();const balance=coins.view().balance;assert.equal(poker.view().table,null);
 poker.execute(leave);assert.equal(coins.view().balance,balance);assert.equal(new Poker(store,coins).view().table,null);
});
test('stale requests refused and AI worker produces a legal action',async()=>{
 const {coins,poker}=service();fundAndJoin(poker,coins);const t=poker.view().table;
 assert.throws(()=>poker.execute(req('act',{tableId:t.id,revision:999,move:'fold'})));
 const decision=await poker.decision(req('bot',{tableId:t.id,revision:t.revision}));
 assert.ok(['fold','check','call','raise'].includes(decision.move));poker.execute(req('bot',{tableId:t.id,revision:t.revision}),decision);
});
test('three unequal all-ins: main pot, side pot and uncalled refund have exact winners',()=>{
 let t=startTable([100,200,301,0,0],0,deck(),'side');
 t.board=[card(2),card(3,1),card(7,2),card(8,3),card(9)];t.street=3;t.current=0;t.turn=2;
 const hands=[[card(14),card(14,1)],[card(13),card(13,1)],[card(12),card(12,1)],[],[]];
 t.seats.forEach((s,i)=>{s.hand=hands[i];s.chips=i===2?1:0;s.bet=0;s.invested=[100,200,300,0,0][i];s.folded=i>2;s.acted=false;});
 t.deck=deck().filter(c=>![...t.board,...hands.flat()].includes(c)).slice(3);t=act(t,'check');
 assert.equal(t.done,true);assert.deepEqual(t.seats.map(s=>s.chips),[300,200,101,0,0]);
 assert.deepEqual(t.settlement.awards.map(a=>({amount:a.amount,refund:a.refund,recipients:a.recipients})),[
 {amount:300,refund:false,recipients:[{seat:0,amount:300}]},
 {amount:200,refund:false,recipients:[{seat:1,amount:200}]},
 {amount:100,refund:true,recipients:[{seat:2,amount:100}]}]);
 assert.deepEqual(t.settlement.balancesBefore,[0,0,1,0,0]);assert.equal(t.settlement.winningCards[0].length,5);
});
test('real repository write failure retains candidate; retry and reload preserve one debit',async()=>{
 const { Repository }=await import('../../dist-electron/src/main/repository.js');
 const {mkdtemp,rm,mkdir}=await import('node:fs/promises');const {tmpdir}=await import('node:os');const {join}=await import('node:path');
 const dir=await mkdtemp(join(tmpdir(),'dogcow-poker-'));
 try{
  const repo=new Repository(dir);await repo.load();repo.storage.setItem(COINS_KEY,JSON.stringify({...emptyCoins(),balance:100}));assert.equal(await repo.flush(),true);
  const coins=new Coins(repo.storage,()=>({}));coins.load();const poker=new Poker(repo.storage,coins);poker.execute(req('exchangeCoins',{amount:10}));
  await rm(repo.file);await mkdir(repo.file);assert.equal(await repo.flush(),false);assert.equal(poker.view().pending,true);assert.equal(coins.view().balance,100);
  await rm(repo.file,{recursive:true});assert.equal(await repo.flush(),true);coins.confirmSaved();poker.confirmSaved();
  const reloaded=new Repository(dir);await reloaded.load();const wallet=new Coins(reloaded.storage,()=>({}));wallet.load();assert.equal(wallet.view().balance,90);assert.equal(new Poker(reloaded.storage,wallet).view().reserve,1000);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('double direction exchange validates source amounts, retains remainder and does not touch seated chips',()=>{
 const {poker,coins}=service();const save=()=>{coins.confirmSaved();poker.confirmSaved();};
 for(const amount of [0,-1,1.2,NaN,Infinity,101])assert.throws(()=>poker.execute(req('exchangeCoins',{amount})));
 poker.execute(req('exchangeCoins',{amount:15}));save();assert.equal(poker.view().reserve,1500);assert.equal(coins.view().balance,85);
 poker.execute(req('join',{amount:1099}));save();assert.equal(poker.view().reserve,401);assert.equal(poker.view().table.seats[0].chips,1099);
 for(const amount of [0,-100,99,101,500])assert.throws(()=>poker.execute(req('exchangeChips',{amount})));
 const cash=req('exchangeChips',{amount:400});poker.execute(cash);save();poker.execute(cash);
 assert.equal(poker.view().reserve,1);assert.equal(coins.view().balance,89);assert.equal(poker.view().table.seats[0].chips,1099);
});
test('seating never spends coins, including insufficient-chip attempts',()=>{
 const {poker,coins}=service();assert.throws(()=>poker.execute(req('join',{amount:1000})));assert.equal(coins.view().balance,100);
 poker.execute(req('exchangeCoins',{amount:10}));coins.confirmSaved();poker.confirmSaved();
 for(const amount of [99,999,0,-1,Infinity,1.5,1001])assert.throws(()=>poker.execute(req('join',{amount})));
 assert.equal(coins.view().balance,90);assert.equal(poker.view().reserve,1000);assert.equal(poker.view().table,null);
});
test('leave requested mid-hand preserves settlement until acknowledged, then returns all chips without coin conversion',()=>{
 const {poker,coins,store}=service();const save=()=>{coins.confirmSaved();poker.confirmSaved();};fundAndJoin(poker,coins);
 poker.execute(req('leave'));save();assert.equal(poker.view().leaving,true);
 let t=poker.view().table;
 while(!t.done){poker.execute(req(t.turn===0?'act':'bot',{tableId:t.id,revision:t.revision,move:'fold'}),{move:'fold'});save();t=poker.view().table;}
 assert.ok(t.settlement);assert.equal(poker.view().leaving,true);const returned=t.seats[0].chips;
 const leave=req('leave');poker.execute(leave);save();poker.execute(leave);
 assert.equal(poker.view().table,null);assert.equal(poker.view().reserve,returned);assert.equal(coins.view().balance,90);
 assert.deepEqual(new Poker(store,coins).view().lastSession,{brought:1000,returned});
});
test('legacy table and sub-100 reserve remain intact and cash out into the chip account',()=>{
 const {poker,coins,store}=service();const t=startTable([1000,1000,1000,1000,1000],0,deck(),'legacy');
 let done=t;while(!done.done)done=act(done,'fold');
 store.setItem('dogcow.poker.v1',JSON.stringify({version:1,reserve:37,table:done,requests:[],leaving:false}));
 const before=done.seats[0].chips;poker.execute(req('leave'));coins.confirmSaved();poker.confirmSaved();
 assert.equal(poker.view().reserve,before+37);assert.equal(coins.view().balance,100);
});
test('public-board tie splits pots and gives odd chip clockwise from dealer; no folded hand is exposed',()=>{
 let t=startTable([50,50,50,0,0],0,deck(),'tie');
 const board=[10,11,12,13,14].map(r=>card(r,2));const hands=[[card(2),card(3)],[card(4),card(5)],[card(6),card(7)],[],[]];
 t.board=board;t.street=3;t.current=0;t.turn=1;t.initial=16;
 t.seats.forEach((s,i)=>{s.hand=hands[i];s.chips=i===1?1:0;s.bet=0;s.invested=i<3?5:0;s.folded=i>=2;s.acted=false;});
 t.deck=deck().filter(c=>![...board,...hands.flat()].includes(c)).slice(3);t=act(t,'check');
 assert.deepEqual(t.settlement.awards[0].recipients,[{seat:1,amount:8},{seat:0,amount:7}]);assert.equal(t.settlement.winningCards[2].length,0);
 assert.deepEqual(t.seats.map(s=>s.chips),[7,9,0,0,0]);
});
test('public action history records exact contributions and per-seat observations',()=>{
 let t=startTable([1000,1000,1000,1000,1000],0,deck(),'reads');
 t=act(t,'raise',40);t=act(t,'call');t=act(t,'fold');
 assert.deepEqual(t.actions.map(a=>({seat:a.seat,action:a.action,paid:a.paid,street:a.street})),[{seat:3,action:'raise',paid:40,street:0},{seat:4,action:'call',paid:40,street:0},{seat:0,action:'fold',paid:0,street:0}]);
 assert.equal(t.reads[3].raises,1);assert.equal(t.reads[4].calls,1);assert.equal(t.reads[0].folds,1);
 assert.ok(t.actions.every(a=>!('hand' in a)));
});
test('range weights favour stronger starting hands after a public raise',async()=>{
 const {rangeWeight}=await import('../../dist-electron/src/main/poker/strategy.js');
 let t=startTable([1000,1000,1000,1000,1000],0,deck(),'ranges');t=act(t,'raise',40);
 assert.ok(rangeWeight(t,3,[card(14),card(14,1)])>rangeWeight(t,3,[card(7),card(2,1)]));
});
test('seeded AI decisions stay legal, do not depend on hidden cards, and protect the nuts',async()=>{
 const {decide}=await import('../../dist-electron/src/main/poker/strategy.js');
 const seeded=()=>{let n=19;return()=>{n=(n*1664525+1013904223)>>>0;return n/2**32;};};
 let t=startTable([1000,1000,1000,1000,1000],0,deck(),'bots');t=act(t,'raise',50);
 const first=decide(t,seeded()),other=structuredClone(t);other.deck.reverse();other.seats.forEach((s,i)=>{if(i!==t.turn)s.hand=[card(2),card(3)];});
 assert.deepEqual(decide(other,seeded()),first);
 for(let i=0;i<8&&!t.done;i++){const choice=decide(t,seeded());t=act(t,choice.move,choice.total);assertTable(t);}
 const nuts=startTable([1000,1000,1000,1000,1000],0,deck(),'nuts');nuts.street=3;nuts.board=[card(10,2),card(11,2),card(12,2),card(2),card(3,1)];nuts.turn=3;nuts.seats[3].hand=[card(13,2),card(14,2)];nuts.current=100;
 assert.notEqual(decide(nuts,seeded()).move,'fold');
});
test('settlement net gain distinguishes real wins from uncalled refunds and lost side pots',()=>{
 let t=startTable([1000,1000,1000,1000,1000],0,deck(),'net');while(!t.done)t=act(t,'fold');
 const result=t.settlement;assert.equal(result.netGains.reduce((a,b)=>a+b,0),0);
 assert.ok(result.netGains.some(n=>n>0));assert.ok(result.netGains.some(n=>n<0));
});
test('new entries require 1000; pre-existing smaller stacks are not charged or discarded',()=>{
 const {poker,coins,store}=service();poker.execute(req('exchangeCoins',{amount:10}));coins.confirmSaved();poker.confirmSaved();
 for(const amount of [100,500,999])assert.throws(()=>poker.execute(req('join',{amount})),/1,000/);
 assert.equal(poker.view().reserve,1000);assert.equal(coins.view().balance,90);
 const old=startTable([600,1000,1000,1000,1000],0,deck(),'old-small');store.setItem('dogcow.poker.v1',JSON.stringify({version:1,reserve:12,table:old,requests:[],leaving:false}));
 assert.equal(poker.view().table.seats[0].chips,600);assert.equal(poker.view().reserve,12);
});
test('dry side pot offers only call or fold when every opponent is all-in',()=>{
 let t=startTable([1000,20,0,0,0],0,deck(),'dry');t=act(t,'call');t=act(t,'raise',20);
 assert.equal(t.turn,0);assert.equal(legal(t).call,10);assert.equal(legal(t).raise,false);assert.throws(()=>act(t,'raise',30));
 const called=act(t,'call');assert.equal(called.done,true);assert.equal(called.settlement.awards.some(a=>a.refund),false);
});
test('river bluff needs a meaningful blocker and position; board-only draws do not qualify',async()=>{
 const {bluffOpportunity}=await import('../../dist-electron/src/main/poker/strategy.js');
 const t=startTable([1000,1000,1000,1000,1000],0,deck(),'bluff');t.street=3;t.turn=2;t.dealer=2;
 t.seats.forEach((s,i)=>s.folded=![0,2].includes(i));
 t.board=[card(12),card(9,1),card(6,2),card(3,3),card(2)];t.seats[2].hand=[card(14,1),card(8)];
 assert.equal(bluffOpportunity(t,.25),true);assert.equal(bluffOpportunity(t,.01),false);
 t.seats[2].hand=[card(8),card(7,1)];assert.equal(bluffOpportunity(t,.15),false);
 t.street=2;t.board=[card(2,2),card(5,2),card(9,2),card(13,2)];t.seats[2].hand=[card(7),card(3,1)];
 assert.equal(bluffOpportunity(t,.01),false);
});
test('one strict validator rejects corrupt cards, turn, phase, actions and payout metadata on load and import',async()=>{
 const {validatePokerState}=await import('../../dist-electron/src/migration/poker.js');
 const {validateLegacy,collectLegacy}=await import('../../src/migration/transfer.js');
 const {poker,coins,store}=service();fundAndJoin(poker,coins);const base=JSON.parse(store.getItem('dogcow.poker.v1'));
 for(const mutate of [s=>s.table.turn=99,s=>s.table.deck[0]=999,s=>s.table.street=5,s=>s.table.seats.pop(),s=>s.table.board.push(52),s=>s.table.actions=[{seat:7,street:0,action:'call',paid:10,total:10,potBefore:15}],s=>s.table.reads[0].folds=-1,s=>s.lastSession={brought:-1,returned:5}]){
  const candidate=structuredClone(base);mutate(candidate);assert.throws(()=>validatePokerState(candidate));
  store.setItem('dogcow.poker.v1',JSON.stringify(candidate));const raw=store.getItem('dogcow.poker.v1');assert.throws(()=>poker.view());assert.equal(store.getItem('dogcow.poker.v1'),raw);
  const values=collectLegacy({getItem:k=>store.getItem(k),length:2,key:i=>[COINS_KEY,'dogcow.poker.v1'][i]});assert.throws(()=>validateLegacy(values));
 }
 let done=base.table;while(!done.done)done=act(done,'fold');const state={...base,table:done};validatePokerState(state);
 const bad=structuredClone(state);bad.table.settlement.gains[0]++;assert.throws(()=>validatePokerState(bad));
 const old=structuredClone(state);delete old.table.settlement;delete old.table.actions;delete old.table.reads;delete old.exchanges;delete old.exchangeFloor;validatePokerState(old);
});
test('profitable river bluffs remain mixed, rather than a forced action on every weak hand',async()=>{
 const {analyzeDecision}=await import('../../dist-electron/src/main/poker/strategy.js');
 const {emptyOpponentModel}=await import('../../dist-electron/src/shared/poker/observations.js');
 const t=startTable([1000,1000,1000,1000,1000],0,deck(),'river-bluff');t.street=3;t.turn=2;t.dealer=2;t.current=0;
 t.board=[card(12),card(9,1),card(6,2),card(3,3),card(2)];t.seats[2].hand=[card(14,1),card(8)];
 t.seats.forEach((s,i)=>{s.folded=![0,2].includes(i);s.bet=0;s.invested=[0,2].includes(i)?100:0;});
 t.reads=t.seats.map(()=>({decisions:100,raises:10,calls:10,folds:80,model:emptyOpponentModel()}));
 t.reads[0].model.foldToBet[3]={hits:45,opportunities:50};
 const modes=[];
 for(let seed=1;seed<=20;seed++){
  let n=seed;const rng=()=>{n=(n*1664525+1013904223)>>>0;return n/2**32;};
  const result=analyzeDecision(t,rng,48);modes.push(result.mode);
  if(result.mode==='bluff')assert.ok(result.raiseEV>=result.baselineEV);
 }
 assert.ok(modes.includes('bluff'));assert.ok(modes.includes('check'));
});
