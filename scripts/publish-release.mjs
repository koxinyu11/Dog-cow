import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readdir, lstat, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

async function sha256(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
export function verifyRelease(release, { version, sha, files }) {
  if (release.tag_name !== `v${version}` || release.target_commitish !== sha || release.prerelease) throw Error('Release version or commit does not match the build');
  const assets = new Map((release.assets ?? []).map(asset => [asset.name, asset]));
  if (assets.size !== files.length || release.assets.length !== files.length) throw Error('Release must contain exactly the expected assets');
  for (const file of files) {
    const asset = assets.get(file.name);
    if (!asset || asset.state !== 'uploaded' || asset.size !== file.size || asset.digest !== `sha256:${file.digest}`) throw Error(`Release asset verification failed: ${file.name}`);
  }
}

/** All draft operations use numeric release IDs; the tag endpoint is only used after publication. */
export async function publishRelease({ version, sha, repo, directory, api, upload }) {
  if (!/^\d+\.\d+\.\d+$/.test(version) || !/^[a-f0-9]{40}$/.test(sha) || !/^[\w.-]+\/[\w.-]+$/.test(repo)) throw Error('Invalid release arguments');
  const names = [`DogCow-arm64-${version}.dmg`, `DogCow-darwin-arm64-${version}.zip`].sort();
  const entries = await readdir(directory);
  if (entries.some(name => ![...names, 'SHA256SUMS.txt'].includes(name)) || names.some(name => !entries.includes(name))) throw Error('Missing or unexpected release files');
  const files = [];
  for (const name of names) {
    const file = path.join(directory, name);
    const stat = await lstat(file);
    if (!stat.isFile() || !stat.size) throw Error('Release artifact must be a non-empty regular file');
    files.push({ name, size: stat.size, digest: await sha256(file) });
  }
  const checksums = files.map(file => `${file.digest}  ${file.name}\n`).join('');
  await writeFile(path.join(directory, 'SHA256SUMS.txt'), checksums);
  files.push({ name: 'SHA256SUMS.txt', size: Buffer.byteLength(checksums), digest: createHash('sha256').update(checksums).digest('hex') });
  const prefix = `repos/${repo}`;
  const existing = await api('GET', `${prefix}/releases?per_page=100`);
  let release = existing.find(item => item.tag_name === `v${version}`);
  if (release && release.target_commitish !== sha) throw Error('Existing release belongs to another commit; preserve it and allocate a new version');
  if (!release) release = await api('POST', `${prefix}/releases`, { tag_name: `v${version}`, target_commitish: sha, name: `狗牛 v${version}`, generate_release_notes: true, draft: true });
  if (release.draft) {
    const remote = release.assets ?? [];
    if (remote.some(asset => !files.some(file => file.name === asset.name))) throw Error('Draft contains unexpected assets');
    for (const file of files) {
      const asset = remote.find(item => item.name === file.name);
      if (asset) {
        if (asset.state !== 'uploaded' || asset.size !== file.size || asset.digest !== `sha256:${file.digest}`) throw Error('Existing draft asset differs; refusing to overwrite');
      } else await upload(release.id, file.name, path.join(directory, file.name));
    }
  }
  const endpoint = `${prefix}/releases/${release.id}`;
  release = await api('GET', endpoint);
  verifyRelease(release, { version, sha, files });
  if (release.draft) await api('PATCH', endpoint, { draft: false, make_latest: 'true' });
  const published = await api('GET', `${prefix}/releases/tags/v${version}`);
  verifyRelease(published, { version, sha, files });
  if (published.draft) throw Error('Release is still a draft');
  const latest = await api('GET', `${prefix}/releases/latest`);
  if (latest.id !== published.id) throw Error('Published release was not marked latest');
  return published;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const repo = process.env.GITHUB_REPOSITORY;
  const api = async (method, endpoint, payload) => JSON.parse(execFileSync('gh', ['api', '--method', method, endpoint, ...(payload ? ['--input', '-'] : [])], { encoding: 'utf8', ...(payload ? { input: JSON.stringify(payload) } : {}) }));
  const upload = async (id, name, file) => {
    execFileSync('gh', ['api', '--method', 'POST', `https://uploads.github.com/repos/${repo}/releases/${id}/assets?name=${encodeURIComponent(name)}`, '-H', 'Content-Type: application/octet-stream', '--input', file], { stdio: ['ignore', 'ignore', 'inherit'] });
  };
  const release = await publishRelease({ version: process.env.VERSION, sha: process.env.GITHUB_SHA, repo, directory: 'release-assets', api, upload });
  console.log(release.html_url);
}
