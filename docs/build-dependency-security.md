# Build dependency security overrides

Checked 2026-11-04. F14 replaces the vulnerable glob/minimatch dependency chains without downgrading Electron Forge.

| Package | Pinned override | Reason |
| --- | --- | --- |
| `glob` | 14.0.3 | Includes the cancellation fix for GHSA-3g3m-2fjr-6pw4 |
| `minimatch` | 11.0.4 | Includes the amplification fix for GHSA-g3hv-75wg-m249 |
| `@electron/asar` | 4.3.1 | Unifies the modern packager and older Windows installer on the same named-export APIs |
| `rimraf` | 6.1.3 | Removes the old callback-only rimraf/glob chain; its glob dependency uses the fixed override |

These are actual dependency replacements, not audit suppression. `package-lock.json` records exact resolved packages. No audit exceptions or vulnerability severity filters are added.

## Compatibility patch

`temp@0.9.4`, used by electron-winstaller, expects rimraf's callback and `.sync` APIs. `scripts/patch-build-dependencies.mjs` adapts its cleanup call to rimraf 6's Promise API and named synchronous export, with glob expansion disabled for temporary paths. Callback success/failure and busy retry count are forwarded. The patch only modifies installed development dependencies; application code and user data are untouched.

`npm install` / `npm ci` apply the patch through `postinstall`. It checks temp/rimraf versions and the entire upstream source SHA-256 before writing. Running twice is safe; any unrecognized source, even with the same version, fails installation rather than silently applying a guessed patch. Production-only installs without development tools skip the patch. Do not use `--ignore-scripts` for a usable packaging environment.

The existing Forge toolchain requires Node >=22.13.0. ASAR 4's ESM module can be loaded by the Windows installer's `require` call on this supported Node line; the shared archive fixture checks the exact extraction API used by the installer.

## Verification and maintenance

- Clean `npm ci`, including the install hook; full and production-only npm audits.
- Existing app tests, renderer/main typechecks and builds.
- Additional tests cover callback, Promise and synchronous cleanup; patch idempotence and changed-source refusal; archive glob/unpack matching, Unicode filenames, symlinks and extraction through the Windows installer's ASAR resolution.
- Build a real macOS package with the normal make script. Do not launch a second app instance for verification.
- Full native Windows installer generation is not verified on this Mac because Wine is unavailable. Shared installer archive and cleanup APIs are tested; this is not a substitute for native Windows CI.

When upstream Forge/ASAR/winstaller/temp adopt patched dependencies, review their API changes, remove unnecessary overrides and the temp patch together, then repeat the checks. Do not expand this patch to unrelated source versions automatically.

Sources: [glob advisory](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4), [minimatch advisory](https://github.com/advisories/GHSA-g3hv-75wg-m249).
