# Validation record

## 2026-11-11 — one Windows x64 computer

| Item | Observed result |
|---|---|
| WeChat mini-program runtime | flue.dll 2.5.8.26073 |
| Hema AppID | wx26a31270d9ab25e0 |
| Hema page package | 169 during the successful run; initial static research used 168 |
| Node.js | 24.18.0 x64 |
| Frida | 17.18.0 |
| Upstream base | 9be0b2d0bd9875bd21a104a2279ad4304b46388b |
| Loopback listeners | 127.0.0.1:9421 and 127.0.0.1:62000 |
| Native debug connection | successful with issue #306 26073 config |
| Logic context identity | exact Hema AppID confirmed |
| Device platform after patch | still windows |
| Agreement | normal dialog appeared; human confirmed through the UI |
| Homepage | current commodity content loaded |
| Search | 牛奶 returned actual product names/prices |
| Product detail | 盒马日日鲜 屋型鲜牛奶 950ml opened, price/specifications/reviews visible |
| Reopen | ordinary close/reopen and top-right close/reopen observed; watcher reapplied |
| Fresh helper startup | stop script followed by launcher observed; Hema patched and homepage operable |

No chat content, account tokens, phone numbers, delivery addresses, machine-specific paths or screenshots are part of this published record.

## Not established

- Compatibility on a second computer, Windows ARM64, macOS or Linux.
- Compatibility with another WMPF version or future Hema module signatures.
- Cart, orders, payment, or all possible login/permission flows.
- Unattended operation across OS reboots. No automatic startup was configured.

## 2026-11-12 — 超盒算 NB extension

Verified identity: `wx28be50015b0f8a29`, title `超盒算NB 真实惠 够放心`, mini-program page package 148, same WMPF 26073 / Windows x64 environment.

- Local source inspection confirmed the same `isBannedPlatform` / `bannedPlatformCache` / agreement-queue design, with a distinct AppID.
- Added an explicit shared target allowlist instead of permitting arbitrary mini-programs; both session client and watcher use it.
- Runtime patch removed the unsupported-environment screen and showed the normal NB privacy agreement. The human user confirmed it through the UI.
- Homepage loaded; searching `纯牛奶` returned real products and prices. Opened `NB 纯牛奶 1L` detail with price, specification and ingredient/detail sections.
- Closed NB using its top-right close button and reopened it through its official entry; the watcher identified the new NB session, reapplied, and the homepage remained operable without repeating the consent prompt.
- Multiple simultaneous mini-program debug sessions are not established: the upstream CDP bridge shares IDs/state. Tests and instructions use one supported target at a time; switch by closing the current one first.
- No cart/order/payment actions were taken. No account, address, phone, traffic dump or screenshot is published.

Source/lockfile/installer checks in CI are separate from these live observations. Do not mark another environment supported until native connection, UI behavior, live search, product detail and reopen are independently verified there.

## Publication checks — 2026-11-11

- Repeated setup in a separate clean directory using Windows PowerShell 5.1, public-registry npm lockfile, and a locally configured proxy for downloads: dependency install, Frida local runtime loading, TypeScript and JavaScript syntax checks passed.
- Corrected native-argument quoting exposed by that clean-directory PowerShell 5.1 test.
- Local PowerShell parser checks and idempotent start while helpers were already running passed.
- Checked publication files for machine-specific user paths and token patterns; runtime output and dependencies are ignored.
- CI is intended to repeat source/PowerShell parsing checks on Node.js 22/24; it does not replace live WeChat validation.
