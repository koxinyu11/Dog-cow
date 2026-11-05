import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const output = await build({ entryPoints: ['src/renderer/features/capsule/window-transition.ts'], bundle: true, write: false, platform: 'node', format: 'esm' });
const { installWindowTransition } = await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].text).toString('base64')}`);
async function fixture(run) {
  const previous = Object.fromEntries(['window', 'document', 'matchMedia', 'requestAnimationFrame'].map(key => [key, globalThis[key]]));
  const classes = new Set(); let listener; const replies = []; let reduced = false; let missing = false; const durations = []; const events = [];
  const properties = new Map([['--capsule-window-surface', '#ece9df']]);
  const style = { getPropertyValue: key => properties.get(key) ?? '', setProperty: (key, value) => properties.set(key, value), removeProperty: key => properties.delete(key) };
  const classList = { add: (...names) => names.forEach(n => classes.add(n)), remove: (...names) => names.forEach(n => { if (n === 'window-morphing' && classes.has(n)) events.push('reveal'); classes.delete(n); }), contains: name => classes.has(name) };
  globalThis.document = { body: { classList, style }, documentElement: { classList: { contains: () => false } }, querySelectorAll: () => missing ? [] : [{ animate(_frames, options) { durations.push(options.duration); return { finished: Promise.resolve(), pause() { events.push('pause'); }, play() { events.push('play'); }, cancel() {} }; } }] };
  globalThis.matchMedia = () => ({ matches: reduced });
  globalThis.requestAnimationFrame = callback => setImmediate(callback);
  globalThis.window = { dogcow: { windowTransition(callback) { listener = callback; return () => { listener = undefined; }; }, async invoke(method, payload) { replies.push({ method, ...payload }); } } };
  const dispose = installWindowTransition();
  const emit = async (stage, nonce) => {
    listener({ stage, nonce, target: 'capsule' });
    for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve));
  };
  try { await run({ emit, classes, replies, durations, events, properties, setReduced: value => { reduced = value; }, setMissing: value => { missing = value; } }); }
  finally { dispose(); for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; } }
}
test('content stays hidden during native morph, then becomes visible before enter acknowledgement', () => fixture(async ({ emit, classes, replies, durations }) => {
  await emit('exit', 'out'); assert.equal(classes.has('window-morphing'), true);
  assert.equal(replies[0].ready, true); assert.equal(replies[0].nonce, 'out');
  await emit('enter', 'in'); assert.equal(classes.has('window-morphing'), false);
  assert.equal(classes.has('window-transitioning'), false);
  assert.deepEqual(durations, [70, 110]); assert.equal(replies[1].nonce, 'in');
  await emit('reset', 'clear'); assert.equal(replies.length, 2);
}));
test('reduced motion skips content animation but preserves geometry handshake', () => fixture(async ({ emit, durations, replies, setReduced }) => {
  setReduced(true); await emit('exit', 'reduced-out'); await emit('enter', 'reduced-in');
  assert.deepEqual(durations, []); assert.ok(replies.every(r => r.ready && r.reducedMotion));
}));
test('missing content reports failure and reset leaves no hidden shell', () => fixture(async ({ emit, classes, replies, setMissing }) => {
  setMissing(true); await emit('exit', 'missing');
  assert.equal(replies[0].ready, false); assert.equal(classes.has('window-morphing'), false);
  await emit('reset', 'clear'); assert.equal(classes.size, 0);
}));

test('incoming content is primed before reveal and backing color survives source unmount', () => fixture(async ({ emit, events, properties }) => {
  await emit('exit', 'out');
  assert.equal(properties.get('--window-transition-surface'), '#ece9df');
  properties.delete('--capsule-window-surface');
  assert.equal(properties.get('--window-transition-surface'), '#ece9df');
  await emit('enter', 'in');
  assert.ok(events.indexOf('pause') < events.indexOf('reveal'));
  assert.ok(events.indexOf('reveal') < events.indexOf('play'));
  assert.equal(properties.has('--window-transition-surface'), false);
}));
