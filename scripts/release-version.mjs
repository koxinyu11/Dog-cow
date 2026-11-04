import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
export function nextReleaseVersion(base, tags) {
  const parse = (value) => /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value) ? value.replace(/^v/, '').split('.').map(Number) : null;
  const candidate = parse(base);
  if (!candidate || !candidate.every(Number.isSafeInteger)) throw Error('Invalid package version');
  const compare = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
  const previous = tags.map(parse).filter((v) => v && v.every(Number.isSafeInteger)).sort(compare).at(-1);
  if (!previous || compare(candidate, previous) > 0) return candidate.join('.');
  if (!Number.isSafeInteger(previous[2] + 1)) throw Error('Release version overflow');
  return [previous[0], previous[1], previous[2] + 1].join('.');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const tags = execFileSync('git', ['tag', '--list'], { encoding: 'utf8' }).trim().split('\n');
  const version = nextReleaseVersion(JSON.parse(readFileSync('package.json', 'utf8')).version, tags);
  console.log(version);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `version=${version}\n`);
}
