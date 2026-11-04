import test from 'node:test';
import assert from 'node:assert/strict';
import { createDmgImage } from '../../scripts/make-dmg.mjs';
const options = { contents: '/test/contents', image: '/test/candidate.dmg', name: '狗牛' };
const busy = () => Object.assign(Error('create failed'), { code: 1, stderr: 'hdiutil: create failed - Resource busy\n' });

test('DMG creation retries transient busy errors and succeeds without changing its output path', async () => {
  const calls = [], waits = [];
  await createDmgImage(options, async (file, args, settings) => {
    calls.push({ file, args, settings });
    if (calls.length < 3) throw busy();
  }, async (milliseconds) => waits.push(milliseconds));
  assert.equal(calls.length, 3);
  assert.deepEqual(waits, [2000, 5000]);
  assert.equal(calls[0].file, '/usr/bin/hdiutil');
  assert.equal(calls[0].args[calls[0].args.indexOf('-fs') + 1], 'HFS+');
  assert.ok(calls[0].args.includes('-ov'));
  assert.equal(calls[0].args.at(-1), options.image);
  assert.deepEqual(calls[0], calls[2]);
});

test('DMG busy retries stop after exactly three attempts and propagate the last error', async () => {
  let attempts = 0; const waits = []; let last;
  await assert.rejects(createDmgImage(options, async () => { attempts++; last = busy(); throw last; }, async (ms) => waits.push(ms)), (error) => error === last);
  assert.equal(attempts, 3);
  assert.equal(waits.length, 2);
});

test('DMG permission, filesystem and timeout failures are never retried', async () => {
  for (const error of [Object.assign(Error('permissions'), { stderr: 'hdiutil: create failed - Permission denied' }),
    Object.assign(busy(), { killed: true }), Object.assign(busy(), { signal: 'SIGTERM' }), Error('ENOENT')]) {
    let attempts = 0;
    await assert.rejects(createDmgImage(options, async () => { attempts++; throw error; }, async () => assert.fail('must not wait')), (actual) => actual === error);
    assert.equal(attempts, 1);
  }
});
