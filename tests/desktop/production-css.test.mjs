import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
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
