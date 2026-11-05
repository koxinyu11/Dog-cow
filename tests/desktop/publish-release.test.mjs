import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { publishRelease } from '../../scripts/publish-release.mjs';
const sha = 'a'.repeat(40);
async function fixture(run) {
  const directory = await mkdtemp(path.join(tmpdir(), 'dogcow-publish-test-'));
  const version = '3.0.5';
  await writeFile(path.join(directory, `DogCow-arm64-${version}.dmg`), 'dmg');
  await writeFile(path.join(directory, `DogCow-darwin-arm64-${version}.zip`), 'zip');
  const calls = [];
  let release;
  const api = async (method, endpoint, payload) => {
    calls.push({ method, endpoint, payload });
    if (method === 'GET' && endpoint.includes('?per_page=')) return release ? [release] : [];
    if (method === 'POST') return release = { ...payload, id: 123, assets: [] };
    if (method === 'PATCH') { release = { ...release, ...payload }; return release; }
    if (endpoint.includes('/tags/') && release.draft) throw Error('tag API cannot read draft');
    return release;
  };
  const upload = async (id, name, file) => {
    assert.equal(id, 123);
    const data = await readFile(file);
    release.assets.push({ name, size: data.length, digest: `sha256:${createHash('sha256').update(data).digest('hex')}`, state: 'uploaded' });
  };
  const options = { directory, version, sha, repo: 'owner/repo', api, upload };
  try { await run({ options, calls, setRelease: value => { release = value; } }); }
  finally { await rm(directory, { recursive: true, force: true }); }
}
test('draft is verified by ID before publishing; tag lookup only happens after publication', () => fixture(async ({ options, calls }) => {
  const release = await publishRelease(options);
  assert.equal(release.draft, false);
  const publishIndex = calls.findIndex(c => c.method === 'PATCH');
  assert.ok(calls.slice(0, publishIndex).some(c => c.endpoint.endsWith('/releases/123')));
  assert.ok(calls.findIndex(c => c.endpoint.includes('/tags/')) > publishIndex);
  assert.equal(release.assets.length, 3);
  // A successful rerun verifies the same release without duplicate assets.
  await publishRelease(options);
  assert.equal(release.assets.length, 3);
}));
test('mismatched digest prevents publishing and preserves the draft', () => fixture(async ({ options, calls }) => {
  const upload = options.upload;
  options.upload = async (...args) => { await upload(...args); const r = await options.api('GET', 'repos/owner/repo/releases/123'); r.assets.at(-1).digest = 'sha256:bad'; };
  await assert.rejects(publishRelease(options), /verification failed/);
  assert.equal(calls.some(c => c.method === 'PATCH'), false);
}));
test('a draft belonging to another commit is never overwritten or published', () => fixture(async ({ options, calls, setRelease }) => {
  setRelease({ id: 123, tag_name: 'v3.0.5', target_commitish: 'b'.repeat(40), draft: true, assets: [] });
  await assert.rejects(publishRelease(options), /another commit/);
  assert.equal(calls.some(c => c.method === 'POST' || c.method === 'PATCH'), false);
}));
