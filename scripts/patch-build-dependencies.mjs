import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// temp@0.9.4 expects rimraf's old callback API. Keep that API while using rimraf 6.
// Pin the entire upstream source: a changed package must be reviewed, never blindly patched.
const ORIGINAL_SHA256 = 'ab00e9972ccbd639a4558519f40ad6839cb2c616b3da6cb9c12dea2828c6c9c9';
const OLD_IMPORT = "let rimraf     = require('rimraf');";
const OLD_SYNC = 'const rimrafSync = rimraf.sync;';
const NEW_SYNC = '// Sync cleanup uses rimraf 6 rimrafSync.';
const ADAPTER = `// DogCow build compatibility: rimraf 6 promise API -> temp 0.9.4 callback API.
const { rimraf: remove, rimrafSync } = require('rimraf');
const rimraf = (target, options, callback) => {
  remove(target, { glob: false, maxRetries: options.maxBusyTries }).then(
    () => callback(null),
    callback,
  );
};`;
const hash = (text) => createHash('sha256').update(text).digest('hex');

export function patchTempSource(source) {
  // Recognize a previous application only if reversing it restores the exact upstream hash.
  const original = source.includes(ADAPTER)
    ? source.replace(ADAPTER, OLD_IMPORT).replace(NEW_SYNC, OLD_SYNC)
    : source;
  if (hash(original) !== ORIGINAL_SHA256) {
    throw Error('temp@0.9.4 源码与已审阅版本不符，停止应用打包依赖补丁。');
  }
  return original.replace(OLD_IMPORT, ADAPTER).replace(OLD_SYNC, NEW_SYNC);
}

export function applyBuildDependencyPatch() {
  const require = createRequire(import.meta.url);
  let manifestPath;
  try {
    manifestPath = require.resolve('temp/package.json');
  } catch (error) {
    if (error.code !== 'MODULE_NOT_FOUND') throw error;
    // Production-only installation has no Forge/temp dependency.
    try { require.resolve('@electron-forge/cli'); }
    catch (missing) {
      if (missing.code !== 'MODULE_NOT_FOUND') throw missing;
      console.log('Build dependency patch skipped: development dependencies are not installed.');
      return;
    }
    throw Error('打包依赖 temp 缺失，请重新安装开发依赖。');
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const rimrafRequire = createRequire(manifestPath);
  const rimraf = rimrafRequire('rimraf/package.json');
  if (manifest.version !== '0.9.4' || rimraf.version !== '6.1.3') {
    throw Error(`打包依赖版本需要重新审阅：temp ${manifest.version} / rimraf ${rimraf.version}。`);
  }
  const file = resolve(dirname(manifestPath), 'lib/temp.js');
  const source = readFileSync(file, 'utf8');
  const patched = patchTempSource(source);
  if (patched !== source) writeFileSync(file, patched);
  console.log('Build dependency compatibility patch ready (temp 0.9.4 / rimraf 6.1.3).');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  applyBuildDependencyPatch();
}
