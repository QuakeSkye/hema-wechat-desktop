# Upstream provenance and modifications

- Upstream: https://github.com/evi0s/WMPFDebugger
- Base commit: `9be0b2d0bd9875bd21a104a2279ad4304b46388b`
- Original author: evi0s and upstream contributors; original Git history and source notices retained.
- License: GPL-2.0-only. The original `LICENSE` is retained. Core third-party protocol sources retain their existing notices; this document does not relicense those files.
- Windows 26073 config: cdpidan, 2026-11-05, https://github.com/evi0s/WMPFDebugger/issues/306#issuecomment-6658603423

## Changes in this derivative

1. Bind debug/CDP listeners to 127.0.0.1 only.
2. Add the Windows 26073 version configuration from the comment above.
3. Emit local connection lifecycle events and stop the server when the instrumented runtime detaches.
4. Add an explicit allowlist for Hema Fresh and 超盒算 NB, a JS session patch and lifecycle watcher. No global platform API changes, persistent mini-program package modification, or automatic consent.
5. Add Windows install/start/stop entry points, a public npm lockfile, version checks, documentation and source validation CI.
6. Replace the root README with Hema-specific instructions; preserve original READMEs in `docs/upstream/` and retain general upstream adaptation/debugging documents.
7. Add a fail-closed native AppID gate before changing any launch flags/configuration. The two 26073 AppID field offsets (176, 208) were identified locally with read-only launch inspection. Share the target list with the JS layer through JSON and add native mutation-order regression tests.

The install scripts use official Frida packages and version-matched release binaries. This derivative is not an official WeChat, Hema or upstream release.
