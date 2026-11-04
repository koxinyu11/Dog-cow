import test from 'node:test';
import assert from 'node:assert/strict';
import { DraftSession } from '../../dist-electron/src/shared/draft-session.js';
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
const saved={applied:true,persisted:true,message:'saved'};
test('slow acknowledgement A cannot replace B while B waits in the save queue',async()=>{
  const session=new DraftSession({salary:'old'});const a=deferred(),b=deferred();const reports=[];
  session.edit({salary:'A'});const first=session.flush(()=>a.promise,()=>({}),r=>reports.push(r.message));
  await Promise.resolve();session.edit({salary:'B'});const second=session.flush(()=>b.promise,()=>({}),r=>reports.push(r.message));
  assert.equal(session.restore({salary:'A'}),false);
  assert.equal(session.value.salary,'B');assert.equal(session.dirty,true);
  a.resolve({...saved,message:'A'});await first;
  assert.equal(session.dirty,true);assert.deepEqual(reports,[]);
  assert.equal(session.restore({salary:'A'}),false);assert.equal(session.value.salary,'B');
  b.resolve({...saved,message:'B'});await second;
  assert.equal(session.dirty,false);assert.deepEqual(reports,['B']);
});
test('same generation flushes share one operation, including close and blur',async()=>{
  const s=new DraftSession('old');s.edit('new');const gate=deferred();let calls=0;
  const submit=()=>{calls++;return gate.promise;};
  const one=s.flush(submit,()=>({}),()=>{});const two=s.flush(submit,()=>({}),()=>{});
  await Promise.resolve();assert.equal(calls,1);gate.resolve(saved);await Promise.all([one,two]);assert.equal(s.dirty,false);
});
test('explicit record switch ignores the previous record receipt and restores its own fields',async()=>{
  const s=new DraftSession({id:'A',paid:true});s.edit({id:'A',paid:false});const gate=deferred();let reports=0;
  const old=s.flush(()=>gate.promise,()=>({}),()=>reports++);
  await Promise.resolve();s.reset({id:'B',paid:true});gate.resolve(saved);await old;
  assert.deepEqual(s.value,{id:'B',paid:true});assert.equal(reports,0);assert.equal(s.dirty,false);
});
test('validation and rejected commands retain draft until a successful retry',async()=>{
  const s=new DraftSession('initial');s.edit('draft');let calls=0;
  assert.equal(await s.flush(async()=>{calls++;return saved;},()=>({salary:'invalid'}),()=>{}),false);assert.equal(calls,0);
  assert.equal(await s.flush(async()=>({applied:false,persisted:false,message:'conflict'}),()=>({}),()=>{}),false);
  assert.equal(s.value,'draft');assert.equal(s.dirty,true);
  assert.equal(await s.flush(async()=>saved,()=>({}),()=>{}),true);assert.equal(s.dirty,false);
});
