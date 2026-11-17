import test from 'node:test';
import assert from 'node:assert/strict';
import { startTable, act, legal, assertTable } from '../../dist-electron/src/shared/poker/engine.js';
import { analyzeHand } from '../../dist-electron/src/main/poker/hand-analysis.js';
import { analyzeDecision, rangeWeight, opponentRead, bluffOpportunity } from '../../dist-electron/src/main/poker/strategy.js';
import { emptyOpponentModel, observeAction, observeRiverShowdown, observedRate } from '../../dist-electron/src/shared/poker/observations.js';
import { validatePokerState } from '../../dist-electron/src/migration/poker.js';
const card=(r,s=0)=>s*13+r-2;
const deck=()=>Array.from({length:52},(_,i)=>i);
const seeded=(seed=19)=>()=>{seed=(seed*1664525+1013904223)>>>0;return seed/2**32;};
function river({ hand=[card(12,1),card(8,1)], board=[card(12),card(9,1),card(6,2),card(3,3),card(2)], bet=100, turn=2 }={}) {
 const t=startTable([1000,1000,1000,1000,1000],0,deck(),'strategy-fixture');
 t.street=3;t.board=board;t.turn=turn;t.dealer=turn;t.current=bet;t.actions=[];
 const rest=deck().filter(c=>![...hand,...board].includes(c));
 t.seats.forEach((s,i)=>{s.hand=i===turn?hand:rest.splice(0,2);s.folded=![0,turn].includes(i);s.bet=i===0?bet:0;
  s.invested=[0,turn].includes(i)?100+s.bet:0;s.chips=1000-s.invested;s.acted=i!==turn;s.actedAt=i===0?bet:0;});
 t.deck=rest.slice(3); t.reads=t.seats.map(()=>({decisions:0,raises:0,calls:0,folds:0,model:emptyOpponentModel()}));
 if(bet)t.actions=[{seat:0,street:3,action:'raise',paid:bet,total:bet,potBefore:200,toCall:0,raiseSize:bet}];
 assertTable(t);return t;
}
function train(t, seat, style) {
 const m=t.reads[seat].model;
 for(const [key,rate] of Object.entries(style)) {
  if(key==='fold')m.foldToBet[3]={hits:rate*50,opportunities:50};
  else m[key]={hits:rate*50,opportunities:50};
 }
}
test('hand contribution distinguishes a board pair from top pair, overpair and board-only draw',()=>{
 assert.equal(analyzeHand([card(7),card(3,1)],[card(12),card(12,1),card(9,2)]).kind,'air');
 assert.equal(analyzeHand([card(14),card(12,1)],[card(12),card(9,2),card(3,1)]).kind,'strong');
 assert.equal(analyzeHand([card(14),card(14,1)],[card(12),card(9,2),card(3,1)]).kind,'strong');
 assert.equal(analyzeHand([card(7),card(3,1)],[card(2,2),card(5,2),card(9,2),card(13,2)]).outs,0);
 assert.equal(analyzeHand([card(14,2),card(7,2)],[card(2,2),card(9,2),card(12)]).outs,9);
 assert.equal(analyzeHand([card(8),card(7,1)],[card(6),card(9,2),card(13,1)]).outs,8);
 assert.equal(analyzeHand([card(2),card(3)],[10,11,12,13,14].map(r=>card(r,2))).kind,'air');
});
test('fold-to-bet denominators exclude free checks; preflop participation counts a hand once',()=>{
 const t=startTable([1000,1000,1000,1000,1000],0,deck(),'observation');
 t.turn=0;t.street=0;t.actions=[];
 observeAction(t,'check',0);
 assert.equal(t.reads[0].model.foldToBet[0].opportunities,0);
 t.actions=[{seat:0,street:0,action:'check',paid:0,total:10,potBefore:15}];
 observeAction(t,'raise',20);
 assert.equal(t.reads[0].model.vpip.opportunities,1);assert.equal(t.reads[0].model.vpip.hits,1);
 assert.equal(t.reads[0].model.preflopRaise.hits,1);
 t.actions.push({seat:0,street:0,action:'raise',paid:30,total:40,potBefore:40});
 observeAction(t,'raise',60);
 assert.equal(t.reads[0].model.vpip.hits,1);assert.equal(t.reads[0].model.preflopRaise.hits,1);
 assert.equal(t.reads[0].model.foldToBet[0].opportunities,1.98);
});
test('public profile changes range weights gradually, and older observations decay',()=>{
 const t=river();const candidate=[card(14,1),card(7,3)];
 const base=rangeWeight(t,0,candidate);
 train(t,0,{vpip:.6,preflopRaise:.5,aggression:.8,weakRiverShowdown:.8});
 const aggressive=rangeWeight(t,0,candidate);assert.ok(aggressive>base*1.5);
 const one={hits:1,opportunities:1};assert.ok(observedRate(one,.2)<.3);
 const before=opponentRead(t,0).aggression;
 t.turn=0;t.street=3;
 for(let n=0;n<100;n++)observeAction(t,'check',0);
 assert.ok(opponentRead(t,0).aggression<before*.5);
});
test('same marginal hand respects tight big river bets more than a publicly observed bluffer',()=>{
 const tight=river({hand:[card(6),card(7,1)],bet:200});
 train(tight,0,{vpip:.16,preflopRaise:.08,aggression:.08,weakRiverShowdown:0});
 const loose=structuredClone(tight);train(loose,0,{vpip:.6,preflopRaise:.5,aggression:.8,weakRiverShowdown:.9});
 const a=analyzeDecision(tight,seeded(),160),b=analyzeDecision(loose,seeded(),160);
 assert.ok(b.equity>a.equity+.06,JSON.stringify({a,b}));
 assert.notEqual(b.decision.move,'fold');
 assert.equal(a.decision.move,'fold');
});
test('free checks never become folds; premium hands still participate in unopened pots',()=>{
 const t=river({bet:0,hand:[card(7),card(4,1)]});
 for(let seed=1;seed<=5;seed++)assert.equal(analyzeDecision(t,seeded(seed),32).decision.move,'check');
 const pre=startTable([1000,1000,1000,1000,1000],0,deck(),'premium');pre.seats[pre.turn].hand=[card(14),card(14,1)];
 assert.notEqual(analyzeDecision(pre,seeded(),80).decision.move,'fold');
});
test('failed air barrels, multiway air and zero-equity board-only draws cannot bluff',()=>{
 const t=river({bet:0,hand:[card(8),card(7,1)]});
 t.actions=[{seat:t.turn,street:2,action:'raise',paid:50,total:50,potBefore:100},{seat:0,street:2,action:'call',paid:50,total:50,potBefore:150}];
 assert.equal(bluffOpportunity(t,.15),false);
 t.seats[1].folded=false;assert.equal(bluffOpportunity(t,.15),false);
});
test('legal actions and decisions ignore all private opponent cards and the future deck',()=>{
 const t=river();const a=analyzeDecision(t,seeded(),48);
 const hidden=structuredClone(t);hidden.deck.reverse();hidden.seats.forEach((s,i)=>{if(i!==t.turn)s.hand=[card(2),card(4)];});
 assert.deepEqual(analyzeDecision(hidden,seeded(),48),a);
 assertTable(act(t,a.decision.move,a.decision.total));
});
test('old saves omit new observations; invalid profile counts are rejected without coercion',()=>{
 const t=startTable([1000,1000,1000,1000,1000],0,deck(),'legacy');
 const s={version:1,reserve:0,table:t,requests:[],leaving:false};
 assert.doesNotThrow(()=>validatePokerState(s));
 t.reads=t.seats.map(()=>({decisions:0,raises:0,calls:0,folds:0,model:emptyOpponentModel()}));
 assert.doesNotThrow(()=>validatePokerState(s));
 t.reads[0].model.vpip.hits=2;assert.throws(()=>validatePokerState(s));
});
test('only actually revealed weak river aggression trains the showdown profile',()=>{
 const visible=river({hand:[card(14,1),card(8)],bet:100});
 const ended=act(visible,'call');assert.equal(ended.done,true);
 assert.equal(ended.reads[0].model.weakRiverShowdown.opportunities,1);
 const hidden=structuredClone(visible);hidden.seats[1].folded=true;
 hidden.actions.push({seat:1,street:3,action:'raise',paid:20,total:20,potBefore:100});
 const folded=act(hidden,'call');
 assert.equal(folded.reads[1].model.weakRiverShowdown.opportunities,0,'mucked private cards are never observed');
 const noShow=act(visible,'fold');
 assert.equal(noShow.reads[0].model.weakRiverShowdown.opportunities,0,'winning without a showdown reveals nothing');
});
test('context fields and observed profiles persist across hands and restore as optional data',async()=>{
 const {Poker}=await import('../../dist-electron/src/main/poker.js');
 const {Coins}=await import('../../dist-electron/src/main/coins.js');
 const {emptyCoins,COINS_KEY}=await import('../../dist-electron/src/shared/coins.js');
 const data=new Map([[COINS_KEY,JSON.stringify({...emptyCoins(),balance:100})]]);
 const store={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
 const coins=new Coins(store,()=>({}));coins.load();const poker=new Poker(store,coins);
 const req=(action,extra={})=>({action,requestId:crypto.randomUUID(),createdAt:Date.now(),...extra});
 const save=()=>{coins.confirmSaved();poker.confirmSaved();};
 poker.execute(req('exchangeCoins',{amount:10}));save();poker.execute(req('join',{amount:1000}));save();
 let t=poker.view().table;
 while(!t.done){poker.execute(req(t.turn===0?'act':'bot',{tableId:t.id,revision:t.revision,move:'fold'}),{move:'fold'});save();t=poker.view().table;}
 const prior=structuredClone(t.reads);poker.execute(req('next'));save();
 const next=new Poker(store,coins).view().table;
 assert.deepEqual(next.reads,prior);assert.notEqual(next.id,t.id);
 assert.ok(t.actions.every(a=>Number.isSafeInteger(a.toCall)&&Number.isSafeInteger(a.raiseSize)));
});
test('over a range of seeds, passive opponents reduce bluffing and no new equity randomness is injected',()=>{
 const t=river({bet:0,hand:[card(14,1),card(8)]});
 const folder=structuredClone(t);train(folder,0,{fold:.95});
 const caller=structuredClone(t);train(caller,0,{fold:.02});
 let toFolder=0,toCaller=0;
 for(let seed=1;seed<=30;seed++){
  const a=analyzeDecision(folder,seeded(seed),32),b=analyzeDecision(caller,seeded(seed),32);
  assert.equal(a.equity,b.equity,'fold tendency affects profit/selection, not dealt equity');
  toFolder+=a.mode==='bluff';toCaller+=b.mode==='bluff';
 }
 assert.ok(toFolder>toCaller,JSON.stringify({toFolder,toCaller}));
});
