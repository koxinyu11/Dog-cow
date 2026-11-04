import { readdir, mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
const [platform, arch, version] = process.argv.slice(2);
if (!['darwin', 'win32'].includes(platform) || !['arm64', 'x64'].includes(arch) || !/^\d+\.\d+\.\d+$/.test(version || '')) throw Error('Invalid release asset arguments');
async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map((e) => e.isDirectory() ? files(path.join(directory, e.name)) : [path.join(directory, e.name)]))).flat();
}
const sources = await files('out/make');
await mkdir('release-assets', { recursive: true });
const extensionNames = platform === 'darwin'
  ? [['.dmg', `DogCow-${arch}-${version}.dmg`], ['.zip', `DogCow-darwin-${arch}-${version}.zip`]]
  : [['.exe', `DogCow-win32-${arch}-${version}-setup.exe`]];
for (const [extension, name] of extensionNames) {
  const matches = sources.filter((file) => file.toLowerCase().endsWith(extension));
  if (matches.length !== 1) throw Error(`Expected one ${extension} artifact, found ${matches.length}`);
  await copyFile(matches[0], path.join('release-assets', name));
}
