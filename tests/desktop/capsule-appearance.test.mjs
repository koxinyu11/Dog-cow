import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

await mkdir(path.resolve('node_modules/.cache'), { recursive: true });
const directory = await mkdtemp(path.resolve('node_modules/.cache/capsule-appearance-'));
const outfile = path.join(directory, 'capsule.mjs');
try {
  await build({ entryPoints: ['src/renderer/features/capsule/Capsule.tsx'], outfile, bundle: true, platform: 'node', format: 'esm', packages: 'external', jsx: 'automatic', plugins: [{
    name: 'render-fixture', setup(b) {
      b.onLoad({ filter: /renderer\/theme\.ts$/ }, () => ({ contents: "export const useTheme = () => ({mode:'light',resolved:'light'});" }));
      b.onLoad({ filter: /renderer\/state\.ts$/ }, () => ({ contents: 'export const command = () => Promise.reject(Error("render-only fixture")); export const registerFlush = () => () => {};' }));
      b.onLoad({ filter: /\.css$/ }, () => ({ contents: '', loader: 'js' }));
    },
  }] });
  const { Capsule, CapsuleSettings } = await import(pathToFileURL(outfile).href);
  const themeOutput = await build({ entryPoints: ['src/renderer/features/capsule/capsule-theme.ts'], bundle: true, write: false, platform: 'node', format: 'esm' });
  const { capsuleTheme } = await import(`data:text/javascript;base64,${Buffer.from(themeOutput.outputFiles[0].text).toString('base64')}`);
  const { BACKGROUND_PRESETS } = await import('../../dist-electron/src/shared/board.js');
  const state = { board: { background: { kind: 'preset', value: 'classic' } }, window: { metric: 'income-today', phase: 'idle', warning: '', alwaysOnTop: false }, income: { settings: {}, snapshot: { earnedToday: 176.98 }, now: Date.now() }, tasks: { tasks: [] } };
  test('settings preview contains the real value but no native-window controls or drag affordance', () => {
    const preview = renderToStaticMarkup(createElement(Capsule, { state, preview: true }));
    assert.match(preview, /176\.98/);
    assert.doesNotMatch(preview, /<button|capsule-grip|展开主界面/);
    const actual = renderToStaticMarkup(createElement(Capsule, { state }));
    assert.match(actual, /aria-label="展开主界面"/);
    assert.match(actual, /capsule-grip/);
    assert.match(actual, /lucide-wallet/);
    assert.match(actual, /lucide-maximize/);
  });
  test('settings uses the shared combobox and keeps native window actions out of the form', () => {
    const form = renderToStaticMarkup(createElement(CapsuleSettings, { state, notify() {} }));
    assert.match(form, /role="combobox"/);
    assert.match(form, /role="switch"/);
    assert.match(form, /样式预览/);
    assert.doesNotMatch(form, /收成胶囊|展开主界面|恢复胶囊位置|重试保存/);
  });
  const luminance = hex => {
    const channels = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
    return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
  };
  const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05);
  test('all existing presets and custom background extremes retain readable text in light and dark modes', () => {
    const backgrounds = [...Object.keys(BACKGROUND_PRESETS).map(value => ({ kind: 'preset', value })), ...['#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff'].map(value => ({ kind: 'color', value })), { kind: 'image', value: 'not-read-for-theme' }];
    for (const background of backgrounds) for (const mode of ['light', 'dark']) {
      const theme = capsuleTheme(background, mode);
      assert.ok(contrast(theme.ink, theme.surface) >= 4.5, `${background.value}/${mode}: value`);
      assert.ok(contrast(theme.muted, theme.surface) >= 4.5, `${background.value}/${mode}: label`);
      assert.match(theme.surface, /^#[0-9a-f]{6}$/);
    }
    assert.notEqual(capsuleTheme({ kind: 'preset', value: 'meadow' }, 'light').surface, capsuleTheme({ kind: 'preset', value: 'ocean' }, 'light').surface);
  });
} finally {
  await rm(directory, { recursive: true, force: true });
}
