import test from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { tmpdir } from 'node:os';
import postcss from 'postcss';
import { build } from 'vite';

const root = fileURLToPath(new URL('../../', import.meta.url));
test('renderer CSS files have complete blocks before production concatenation', async () => {
  const directory = path.join(root, 'src/renderer');
  const files = await readdir(directory, { recursive: true });
  for (const file of files.filter(file => file.endsWith('.css'))) {
    const source = await readFile(path.join(directory, file), 'utf8');
    assert.doesNotThrow(() => postcss.parse(source, { from: file }), file);
  }
});
test('production tokens and base controls remain outside conditional media blocks', async () => {
  const result = await build({ configFile: path.join(root, 'vite.config.ts'), logLevel: 'silent', build: { write: false } });
  const outputs = (Array.isArray(result) ? result : [result]).flatMap(result => result.output);
  const css = outputs.filter(file => file.type === 'asset' && file.fileName.endsWith('.css'));
  assert.ok(css.length, 'production must emit CSS');
  const rules = css.flatMap(file => postcss.parse(file.source.toString()).nodes);
  const unconditional = selector => rules.filter(rule => rule.type === 'rule' && rule.selector.split(',').map(s => s.trim()).includes(selector));
  assert.ok(unconditional(':root').some(rule => rule.nodes.some(node => node.prop === '--c-page')), 'page tokens must apply in both motion modes');
  assert.ok(unconditional('.ui-btn').length, 'base buttons must apply in both motion modes');
});


test('in-memory builds neither create output nor archive diagnostic files', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'dogcow-css-memory-'));
  const output = path.join(directory, 'renderer');
  let archive;
  try {
    const result = await build({ configFile: path.join(root, 'vite.config.ts'), logLevel: 'silent', build: { write: false, outDir: output } });
    const files = (Array.isArray(result) ? result : [result]).flatMap(r => r.output);
    const info = files.find(file => file.fileName === 'build-info.json');
    assert.ok(info, 'in-memory output still includes the build identifier');
    const { buildId } = JSON.parse(info.source.toString());
    archive = path.join(root, 'build/diagnostics', buildId);
    await assert.rejects(access(output), { code: 'ENOENT' });
    await assert.rejects(access(archive), { code: 'ENOENT' });
  } finally {
    await rm(directory, { recursive: true, force: true });
    if (archive) await rm(archive, { recursive: true, force: true });
  }
});

test('written builds archive source maps from the actual output directory', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'dogcow-css-written-'));
  const output = path.join(directory, 'custom-renderer');
  let archive;
  try {
    await build({ configFile: path.join(root, 'vite.config.ts'), logLevel: 'silent', build: { outDir: output } });
    const info = await readFile(path.join(output, 'build-info.json'), 'utf8');
    archive = path.join(root, 'build/diagnostics', JSON.parse(info).buildId);
    assert.equal(await readFile(path.join(archive, 'build-info.json'), 'utf8'), info);
    const publicFiles = await readdir(path.join(output, 'assets'));
    assert.equal(publicFiles.some(name => name.endsWith('.map')), false, 'source maps must not ship in app assets');
    const maps = (await readdir(path.join(archive, 'assets'))).filter(name => name.endsWith('.map'));
    assert.ok(maps.length > 0, 'diagnostic maps must exist');
    for (const name of maps) {
      assert.ok(publicFiles.includes(name.slice(0, -4)), 'map must match a generated asset');
      const map = JSON.parse(await readFile(path.join(archive, 'assets', name), 'utf8'));
      assert.ok(map.sources.length > 0);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
    if (archive) await rm(archive, { recursive: true, force: true });
  }
});
