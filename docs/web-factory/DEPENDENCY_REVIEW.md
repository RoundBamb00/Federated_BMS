# Pre-publish dependency review — 2026-10-16

## Requested production findings

The fresh production dependency scanner initially checked 52 packages and returned three High findings. These are real upstream advisories, not dismissed false positives:

| Dependency | Previous | Patched | Advisory |
| --- | --- | --- | --- |
| source-map-js | 1.2.1 | 1.2.2 | GHSA-68fv-2mgg-jv7q: indexed source-map offset denial of service |
| js-yaml | 4.3.0 | 4.3.2 | GHSA-5p4m-2wfm-xmqj: quadratic ordered-map resolution; GHSA-2883-xcg3-v3hh: empty merge-source CPU exhaustion |

Pinned the patched transitive dependencies through package.json overrides and regenerated bun.lock. Retained @tanstack/react-start 1.168.60 and @tailwindcss/vite 4.3.3. The patch versions satisfy the existing major-version dependency ranges. Lockfile regeneration also retained compatible refreshed resolutions for shell-quote 1.12.0, nanoid 3.3.18, and brace-expansion 1.1.21 / 5.0.12. The targeted override patches only the 1.x branch; the newer major is preserved.

## Actual verification

- Final production dependency scan: **52 packages, zero known vulnerabilities**.
- Final full Bun 1.4.3 `bun audit --json`: **zero advisory records**, `{}`, exit 0. The previously remaining brace-expansion findings are resolved.
- Earlier full audit: 14 advisory records (one Critical, eleven High, two Moderate). Final audit has no Critical records.
- `npm test`: 18 protocol/serial tests and one routing test passed (19 total).
- Latest checked automatic build log: `build OK` at 2026-10-16T05:23:30Z. No manual production build was run because this environment builds automatically.
- Standalone typecheck not run: environment instructions prohibit manual project typechecks. The available build log does not separately certify a typecheck; standalone typecheck remains unverified.
- Playwright: Chinese/English driver URLs and safe new-tab attributes, Arial family, heading weight, empty initial readings, no automatic connection/commands, desktop and 375/390/768-width mobile overflow checks passed. Mock serial telemetry, all six command bytes, stale states, disconnect and reconnect passed; no page errors.
- No physical hardware testing, penetration test, or new backend scan performed. Stored supply-chain findings were empty but stale; the fresh dependency scan above is the relevant production dependency result.
- Protocol, serial implementation, Arial typography and driver links unchanged. Settings/log CSS now uses neutral light-gray surfaces, white modules, light-gray borders, dark-gray text and teal-blue accents. Five data palette variables remain unused; no charts or data added. Not published.

## Resolved full-audit advisories and tooling requirement

Pinned `brace-expansion@^1.1.7` to 1.1.21, preserving the separate 5.0.12 branch required by minimatch 10.2.6. This fixes the four advisories below without a cross-major API replacement.

Version-scoped overrides require newer Bun. The sandbox's Bun 1.3.14 ignored the selector, and cannot read the resulting format-3 lockfile. Used a temporary Bun 1.4.3 installation to regenerate the lockfile and run the clean full audit; package.json declares `packageManager: bun@1.4.3`. Future install/audit environments must use Bun 1.4.3 or newer. The automatic production build and production scanner accepted the current project, but a clean install with the sandbox's older Bun is unsupported. Standalone typecheck remains unverified.

- https://github.com/advisories/GHSA-rgw5-rvv9-x895
- https://github.com/advisories/GHSA-6j4f-fj2g-mc7p
- https://github.com/advisories/GHSA-qhr7-859c-m2p7
- https://github.com/advisories/GHSA-q2hr-2g5m-vwhr