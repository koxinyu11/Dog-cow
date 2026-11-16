import test from 'node:test';
import assert from 'node:assert/strict';
import { PokerExchangeClient, EXCHANGE_OUTBOX_KEY } from '../../dist-electron/src/shared/poker-exchange.js';
import { Poker } from '../../dist-electron/src/main/poker.js';
import { Coins } from '../../dist-electron/src/main/coins.js';
import { COINS_KEY,emptyCoins } from '../../dist-electron/src/shared/coins.js';
function fixture(){
 const data=new Map([[COINS_KEY,JSON.stringify({...emptyCoins(),balance:100})]]);
 const storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 const coins=new Coins(storage,()=>({}));coins.load();const poker=new Poker(storage,coins);let flush=true,loseReply=false;const calls=[];
 const invoke=async r=>{calls.push({...r});if(r.action==='exchangeStatus')return {view:poker.view(),exchangeStatus:poker.exchangeStatus(r)};
   if(r.action!=='retry')poker.execute(r);if(flush){coins.confirmSaved();poker.confirmSaved();}
   const reply={view:poker.view(),...(r.action.startsWith('exchange')?{exchangeStatus:poker.exchangeStatus(r)}:{})};
   if(loseReply){loseReply=false;throw Error('IPC response lost');}return reply;
 };
 return {storage,coins,poker,calls,invoke,client:new PokerExchangeClient(storage,invoke),setFlush:v=>flush=v,lose:()=>loseReply=true};
}
test('lost success response survives game remount: query reconciles without a second debit',async()=>{
 const f=fixture();f.lose();await assert.rejects(()=>f.client.submit('exchangeCoins',10));assert.equal(f.coins.view().balance,90);assert.ok(f.client.pending());
 await assert.rejects(()=>f.client.submit('exchangeCoins',10));
 const reopened=new PokerExchangeClient(f.storage,f.invoke);const reply=await reopened.reconcile(true);
 assert.equal(reply.exchangeStatus,'applied');assert.equal(f.coins.view().balance,90);assert.equal(f.poker.view().reserve,1000);assert.equal(reopened.pending(),null);
 assert.equal(f.calls.filter(r=>r.action==='exchangeCoins').length,1);
});
test('lost unsent request retries the same ID and amount after checking status',async()=>{
 const f=fixture();let drop=true;
 const client=new PokerExchangeClient(f.storage,async r=>{if(drop){drop=false;throw Error('before delivery');}return f.invoke(r);});
 await assert.rejects(()=>client.submit('exchangeCoins',10));const original=client.pending();
 const pending=await client.reconcile();assert.equal(pending.exchangeStatus,'notFound');assert.ok(client.pending());
 await client.reconcile(true);assert.equal(f.calls.find(r=>r.action==='exchangeCoins').requestId,original.requestId);assert.equal(f.coins.view().balance,90);assert.equal(client.pending(),null);
});
test('disk failure retries saving the original candidate and queries its receipt',async()=>{
 const f=fixture();f.setFlush(false);await f.client.submit('exchangeCoins',10);assert.equal(f.poker.view().pending,true);assert.equal(f.coins.view().balance,100);
 f.setFlush(true);await f.client.reconcile(true);assert.equal(f.coins.view().balance,90);assert.equal(f.poker.view().reserve,1000);assert.equal(f.client.pending(),null);assert.equal(f.calls.filter(r=>r.action==='exchangeCoins').length,1);
});
test('expired operation never resubmits, and can only be dismissed after balance reconciliation',async()=>{
 const f=fixture();f.storage.setItem(EXCHANGE_OUTBOX_KEY,JSON.stringify({action:'exchangeCoins',amount:10,requestId:'expired',createdAt:Date.now()-2*86400000}));
 const result=await f.client.reconcile(true);assert.equal(result.exchangeStatus,'expired');assert.ok(f.client.pending());assert.equal(f.coins.view().balance,100);
 await f.client.dismissExpired();assert.equal(f.client.pending(),null);assert.equal(f.calls.every(r=>r.action==='exchangeStatus'),true);
});
test('server dedupes across reload; changed parameters and retired receipts are refused',async()=>{
 const f=fixture();await f.client.submit('exchangeCoins',10);const original=f.calls[0];
 const reloaded=new Poker(f.storage,f.coins);reloaded.execute(original);assert.equal(f.coins.view().balance,90);
 assert.throws(()=>reloaded.execute({...original,amount:20}));
 // A compacted receipt is no longer retryable, even when its ID has left the ordinary action list.
 const state=JSON.parse(f.storage.getItem('dogcow.poker.v1'));state.exchangeFloor=original.createdAt;state.exchanges=[];state.requests=[];
 f.storage.setItem('dogcow.poker.v1',JSON.stringify(state));assert.equal(reloaded.exchangeStatus(original),'expired');assert.throws(()=>reloaded.execute(original));assert.equal(f.coins.view().balance,90);
});
test('outbox write failure prevents sending a financial operation',async()=>{
 let calls=0;const client=new PokerExchangeClient({getItem:()=>null,setItem:()=>{throw Error('storage unavailable');},removeItem:()=>{}},async()=>{calls++;return {};});
 await assert.rejects(()=>client.submit('exchangeCoins',10));assert.equal(calls,0);
});
test('confirmed rejection is checked before unlocking, allowing corrected input without a 24-hour lock',async()=>{
 const f=fixture();const client=new PokerExchangeClient(f.storage,async r=>{
  try{return await f.invoke(r);}catch(e){return {view:f.poker.view(),errorCode:'POKER_RULE',error:e.message};}
 });
 const failed=await client.submit('exchangeCoins',101);assert.equal(failed.errorCode,'POKER_RULE');assert.equal(client.pending(),null);assert.equal(f.coins.view().balance,100);
 await client.submit('exchangeCoins',10);assert.equal(f.coins.view().balance,90);assert.equal(client.pending(),null);
});
