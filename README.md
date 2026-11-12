# hema-wechat-desktop

电脑微信盒马鲜生、超盒算 NB 小程序的本地运行时兼容辅助程序，基于 [evi0s/WMPFDebugger](https://github.com/evi0s/WMPFDebugger)。

盒马会检查设备平台，并在 Windows 上显示“当前环境不支持使用”。本项目在官方微信小程序运行时中，只临时调整盒马自身的平台判断，让原有协议流程继续执行。关闭重开盒马时，后台程序会自动重新应用。

**已验证：Windows x64、WMPF 26073、Node.js 24 x64、盒马小程序 AppID `wx26a31270d9ab25e0`。** 2026-11-11 在一台电脑上实测首页、搜索、商品详情和关闭重开成功。尚未验证其他电脑、其他 WMPF 版本、下单或支付。见[验证记录](docs/VALIDATION.md)。

支持列表由 `hema-targets.mjs` 明确维护：盒马鲜生 `wx26a31270d9ab25e0`、超盒算 NB `wx28be50015b0f8a29`。两者有各自的协议、登录与业务流程；不会对任意其他小程序放行。

2026-11-12 已在同一电脑补充实测 NB 首页、纯牛奶搜索、商品详情与右上角关闭重开，均通过。下单和支付未测试。

如果让 AI 操作，请把本仓库链接交给它，并要求先完整阅读 [AGENTS.md](AGENTS.md)。

## 快速开始

### 1. 准备

- Windows x64 与官方电脑微信，使用你自己的账号。
- 安装 [Node.js](https://nodejs.org/) 22 或更高版本的 **x64** 版本；本项目实测 Node.js 24。
- 下载本仓库 ZIP 并完整解压，或使用 Git：

```powershell
git clone https://github.com/QuakeSkye/hema-wechat-desktop.git
cd hema-wechat-desktop
```

不要只下载 `start-hema.cmd`：它需要项目源码和依赖。

### 2. 首次安装

双击 `install.cmd`。也可在项目目录执行：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\setup.ps1
```

安装脚本按 `package-lock.json` 安装依赖，随后明确执行 Frida 原生组件安装并检查源码。它不会启动注入、修改系统代理或安装证书。执行策略参数只作用于本次 PowerShell 进程。

安装需要能访问 npm 官方仓库及 GitHub Releases。如果网络必须使用你自己的 HTTP 代理：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\setup.ps1 -Proxy http://127.0.0.1:你的代理端口
```

把端口替换成你的实际配置。不要原样复制占位文字，也不需要为了使用盒马而开启 VPN。

### 3. 启动

1. 登录电脑微信，打开“发现 → 小程序”，先停留在小程序列表。
2. 双击 `start-hema.cmd`，等待启动成功。
3. 从微信中打开**盒马鲜生**或**超盒算 NB**。
4. 需要时，由你自己阅读并确认盒马协议、完成登录或其他授权。

本项目的启动器只允许已验证的 **WMPF 26073**。这里的版本是微信的小程序框架版本，**不是微信主程序版本，也不是盒马包版本**。不匹配时会停止，不会自动换用其他版本偏移。

辅助程序持续运行期间，可以关闭、重开盒马；首次画面可能短暂显示限制页，随后自动放行。完全退出微信或重启电脑后，重新按上述启动步骤操作。没有设置开机自启或计划任务。

目前请一次只打开一个目标小程序。切换鲜生与 NB 时，先关闭当前小程序，再打开另一个；上游桥接共享 CDP 会话，尚未支持多个目标同时调试。

### 4. 检查是否真的成功

- 首页能够操作，而不只是遮罩消失。
- 搜索“牛奶”等普通商品，能得到商品名称、价格与规格。
- 能进入商品详情。
- 点击右上角关闭，再从微信打开，仍能恢复。
- 本地 `hema-watch-status.json` 的 `state` 应为 `patched`。

只看到调试端口、`script loaded` 或 `miniapp client connected`，**不能据此认定功能已经恢复**。这些步骤分别验证不同阶段。

### 5. 停止与恢复

双击 `stop-hema.cmd`，然后关闭重开盒马。

程序会先停止自动重应用，再尝试恢复本次内存中的原方法，最后停止本地调试器。停止调试器可能同时关闭当前调试中的盒马窗口。官方安装包及磁盘上的盒马小程序包均不作修改。

## 工作原理

```text
官方电脑微信 / WMPF 26073
  → Frida 临时挂载小程序公共运行时，建立本机 CDP 桥接
  → watcher 核对逻辑层 AppID 为盒马
  → 在周期检查处取得盒马平台判断对象
  → 临时修改 isBannedPlatform 及它的缓存
  → 由盒马原有流程读取已有协议记录、继续业务回调
  → 新盒马会话创建后自动重复
```

原生调试钩子挂载的是微信小程序的公共运行时；JavaScript 平台补丁只针对核对过 AppID 的盒马上下文。设备 API 仍会报告真实的 `windows`，不会全局伪造手机信息。程序不会替你接受协议，不读取或导出账号 token，不自动加购、下单或支付。

调试服务仅监听 `127.0.0.1:9421` 与 `127.0.0.1:62000`。不要将其映射或转发到外网。

## 文件与文档

| 文件 | 用途 |
|---|---|
| `install.cmd` / `setup.ps1` | 首次依赖安装与源码检查 |
| `start-hema.cmd` / `start-hema.ps1` | 启动本地调试器及 watcher |
| `stop-hema.cmd` / `stop-hema-debug.ps1` | 停止与恢复 |
| `hema-watch.mjs` | 新会话识别与自动重应用 |
| `hema-targets.mjs` | 两个已核实目标的 AppID 支持列表 |
| `hema-session.mjs` | 停止恢复时使用的单次诊断客户端 |
| `frida/config/win32/addresses.26073.json` | 已测试版本的原生偏移 |
| [AGENTS.md](AGENTS.md) | AI 操作顺序、边界和成功判据 |
| [故障处理](docs/TROUBLESHOOTING.md) | 安装、连接、白屏及签名变化 |
| [验证记录](docs/VALIDATION.md) | 已测范围及未测范围 |
| [上游来源](UPSTREAM.md) | 原始项目、版本配置来源和修改说明 |

`logs/` 和 `hema-watch-status.json` 是本机生成文件，已加入 `.gitignore`。提交 issue 时只提供必要的脱敏错误信息。

## 版本变化

微信或盒马更新后可能失效。出现 `unsupported_module_signature` 时，程序会保留原有限制并停止该次修改。不要把“有一个 JSON 偏移文件”等同于已适配；新版本需要独立验证，不能盲用 `26073` 偏移。

## 许可与致谢

沿用上游 **GPL-2.0-only**，见 [LICENSE](LICENSE)。核心调试框架来自 evi0s/WMPFDebugger；`26073` 配置由 cdpidan 在 [issue #306](https://github.com/evi0s/WMPFDebugger/issues/306#issuecomment-6658603423) 提供。完整来源与本项目修改见 [UPSTREAM.md](UPSTREAM.md)。
