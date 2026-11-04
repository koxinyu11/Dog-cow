import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultFun, daysUntil, estimateMealCalories, lunchOptions, rewardTask, updateFun, validFun, weekendDays, weekKey } from '../../dist-electron/src/shared/fun.js';
import { defaultBoard, validBoard, MODULE_IDS, retireReceiptModule } from '../../dist-electron/src/shared/board.js';
import { copyDefaults } from '../../dist-electron/src/domain/tasks/model.js';
import { createTransfer, parseTransfer } from '../../src/migration/transfer.js';
const now = new Date('2026-11-04T12:00:00');
const act = (s, p, time = now) => updateFun(s, p, time);
test('mood is dated, settings survive board JSON round-trip and new cards are opt-in', () => {
  const fun = act(defaultFun(), { action: 'mood', value: 2 });
  assert.equal(fun.mood.date, '2026-11-04');
  const board = JSON.parse(JSON.stringify({ ...defaultBoard(), fun }));
  assert.equal(validBoard(board, Object.keys(copyDefaults)), true);
  assert.equal(validBoard(defaultBoard(), Object.keys(copyDefaults)), true);
  for (const id of ['mood','lunch','calories','hopes','pasture','converter']) {
    assert.ok(MODULE_IDS.includes(id)); assert.equal(board.items.some(i => i.id === id), false);
  }
  assert.throws(() => act(fun, { action:'mood', value:3 }));
});
test('calorie estimates follow confirmed lunch names with a stable fallback', () => {
  assert.equal(estimateMealCalories('麻辣烫'), 900);
  assert.equal(estimateMealCalories('牛肉面'), 620);
  assert.equal(estimateMealCalories('鸡胸肉轻食沙拉'), 350);
  assert.equal(estimateMealCalories('妈妈做的饭'), 600);
});
test('drawing does not consume lunch; confirmation does, rerolls and repeats cannot consume twice', () => {
  let fun = act(defaultFun(), { action: 'meals', value: '面\n面\n饭', noRepeat: true });
  assert.deepEqual(lunchOptions(fun, '2026-11-04'), ['面','饭']);
  fun = act(fun, { action: 'lunch', value: '面' });
  assert.deepEqual(lunchOptions(fun, '2026-11-05'), ['饭']);
  assert.throws(() => act(fun, { action:'lunch', value:'面' }));
  fun = act(fun, { action:'lunch', value:'饭' });
  assert.deepEqual(lunchOptions(fun,'2026-11-04'), []);
  assert.deepEqual(lunchOptions(fun,'2026-11-09'), ['面','饭']);
  assert.deepEqual(lunchOptions(act(fun,{action:'reset-lunch'}),'2026-11-04'), ['面','饭']);
  fun = act(fun,{action:'meals',value:'',noRepeat:false});
  assert.deepEqual(lunchOptions(fun,'2026-11-04'),[]);
});
test('lunch without weekly exclusion accepts repeats without duplicating history', () => {
  let fun = act(defaultFun(),{action:'meals',value:'面',noRepeat:false});
  fun = act(act(fun,{action:'lunch',value:'面'}),{action:'lunch',value:'面'});
  assert.deepEqual(fun.lunch.used,['面']);
  assert.throws(()=>act(fun,{action:'lunch',value:'未知菜'}));
});
test('custom lunch stores servings and manual calories remain optional and adjustable', () => {
  let fun = act(defaultFun(), { action: 'custom-lunch', value: '半份牛肉面', servings: 0.5 });
  assert.equal(fun.lunch.chosen, '半份牛肉面');
  assert.equal(fun.lunch.servings, 0.5);
  assert.equal(fun.lunch.calories, undefined);
  fun = act(fun, { action: 'lunch-details', servings: 0.5, calories: 380 });
  assert.equal(fun.lunch.calories, 380);
  fun = act(fun, { action: 'lunch-details', servings: 1.5, calories: null });
  assert.equal(fun.lunch.servings, 1.5);
  assert.equal(fun.lunch.calories, undefined);
  assert.throws(() => act(fun, { action: 'custom-lunch', value: '', servings: 1 }));
  assert.throws(() => act(fun, { action: 'lunch-details', servings: 0, calories: 1 }));
  assert.equal(validFun({ ...defaultFun(), lunch: { week: '', used: [], date: '', chosen: '' } }), true);
});
test('task rewards are permanent and idempotent across undo, delete and restart', () => {
  let fun = rewardTask(defaultFun(),'task-a');
  fun = rewardTask(JSON.parse(JSON.stringify(fun)),'task-a');
  assert.deepEqual(fun.rewarded,['task-a']);
  fun = rewardTask(fun,'task-b'); assert.equal(fun.rewarded.length,2);
});
test('hopes validate real dates; removing pinned hope selects another', () => {
  let fun = act(defaultFun(),{action:'hope',id:'a',name:'旅行',date:'2026-12-01'});
  fun = act(fun,{action:'hope',id:'b',name:'发薪',date:'2026-11-10'});
  assert.equal(fun.pinned,'a');
  fun = act(fun,{action:'remove-hope',id:'a'}); assert.equal(fun.pinned,'b');
  assert.throws(()=>act(fun,{action:'hope',id:'c',name:'无效',date:'2026-02-30'}));
  assert.throws(()=>act(fun,{action:'pin',id:'missing'}));
  assert.equal(daysUntil('2026-12-31','2027-01-01'),1);
  assert.equal(daysUntil('2026-11-04','2026-11-03'),-1);
  assert.equal(weekendDays('2026-11-06'),1);
  assert.equal(weekendDays('2026-11-07'),0);
  assert.equal(weekendDays('2026-11-08'),0);
  assert.equal(weekKey('2027-01-01'),'2026-12-28');
});
test('product prices must be finite positive numbers; replacing list resets selection', () => {
  for(const price of [0,-1,NaN,Infinity,'18']) assert.throws(()=>act(defaultFun(),{action:'products',value:[{name:'奶茶',price}]}));
  let fun = act(defaultFun(),{action:'product',value:1});
  fun = act(fun,{action:'products',value:[{name:'火锅',price:100}]});
  assert.equal(fun.product,0); assert.equal(validFun(fun),true);
  assert.throws(()=>act(fun,{action:'product',value:1}));
});
test('fun configuration and permanent rewards travel through existing export and import', async () => {
  const fun = rewardTask(act(defaultFun(),{action:'mood',value:1}),'task-a');
  const raw = JSON.stringify({...defaultBoard(),fun});
  const map = new Map([['dogcow.board.v2',raw]]);
  const storage = { get length(){return map.size;}, key:i=>[...map.keys()][i], getItem:key=>map.get(key)??null };
  const pack = await createTransfer(storage,{},now,globalThis.crypto);
  const result = await parseTransfer(JSON.stringify(pack),globalThis.crypto);
  const restored = JSON.parse(result.pack.values['dogcow.board.v2']);
  assert.equal(validBoard(restored,Object.keys(copyDefaults)),true);
  assert.deepEqual(restored.fun,fun);
});

test('retired receipt card is removed while board choices and fun data survive', () => {
  const board = { ...defaultBoard(), items: [...defaultBoard().items, {id:'receipt',size:'m'}], colors: {receipt:'#ffffff',income:'#000000'}, fun: defaultFun() };
  const restored = retireReceiptModule(board);
  assert.equal(validBoard(restored,Object.keys(copyDefaults)),true);
  assert.equal(restored.items.some(i=>i.id==='receipt'),false);
  assert.deepEqual(restored.colors,{income:'#000000'});
  assert.deepEqual(restored.fun,board.fun);
  assert.equal(MODULE_IDS.includes('receipt'),false);
});
