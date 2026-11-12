# 故障处理

## 缺少 Node.js / 找不到 npm

安装 Windows x64 Node.js 22+（实测 24），重新打开终端或运行安装入口。只装 WSL/Linux Node.js 不能替代本项目的 Windows 原生 Frida。

## 安装停在 Frida 原生组件

npm 包与 Frida 原生组件来自不同下载源；npm 成功不代表 GitHub Release 下载成功。使用 `setup.ps1 -Proxy http://127.0.0.1:实际端口` 指定自己的可用代理，或修复到 GitHub 的网络。脚本不修改系统代理。不要使用他人的账号凭据或关闭证书校验。

如果使用手工 `npm ci`，npm 的脚本执行策略可能阻止原生组件安装。推荐使用 `setup.ps1`，它先 `npm ci --ignore-scripts`，再显式运行已知的 Frida 安装入口及检查。

## 提示先打开小程序列表

微信的小程序运行时进程还没有启动。登录微信，进入“发现 → 小程序”，停在列表，再启动辅助程序，最后打开盒马。

## Unsupported WMPF version

启动器仅允许实测过的 26073。可以从 WeChatAppEx 主进程的 `--flue-runtime-dir` 路径中的 `RadiumWMPF/<版本>/extracted/runtime` 查到实际版本。微信主程序版本号不是它。

不要将 26073 偏移文件改名后给另一个版本使用。新版本需要独立适配，可参考上游 [ADAPTATION.md](../ADAPTATION.md) 及版本对应的证据。

## 端口占用

9421/62000 必须由本项目自己的 Node 调试器使用。可读取：

```powershell
Get-NetTCPConnection -LocalPort 9421,62000 -State Listen
```

若不是本项目进程，不要直接结束它。已有本项目进程时重复运行启动入口会复用，停止时使用 `stop-hema.cmd`。

## 一直 waiting_for_miniapp

调试器在等待新的小程序连接。关闭盒马后，从微信列表重开，确保启动器先于盒马启动。如果刚完全退出过微信，需要重新启动辅助程序。查看 `logs/debugger.err.log` 和 `logs/debugger.out.log` 的最后几行。

## waiting_for_platform_check / unsupported_module_signature / patch_failed

前者表示已定位目标脚本并等待检测函数执行；长时间不变化时检查页面是否真的加载、是否存在人为调试暂停。后两者可能表示盒马代码改变或运行时签名不匹配。先停止辅助程序，保留脱敏错误和版本，重新研究模块；不要无条件移除任何带“协议/安全”字样的弹层。

## patched 但仍不能使用

这是补丁内部状态，不是业务成功的证明。检查画面是否为正常的隐私协议、登录确认、活动广告或其他授权。协议/登录由用户自行操作；活动广告可以按正常界面关闭。之后执行搜索、商品详情与关闭重开测试。

## 鲜生可以用，超盒算 NB 仍显示不支持

NB 使用独立 AppID `wx28be50015b0f8a29`。旧版仅支持鲜生；更新仓库后需要先运行 `stop-hema.cmd` 再重新启动，不能只覆盖文件而继续使用旧 watcher 进程。确认状态文件里的 appid 和 name 是当前目标。

## 同时打开鲜生与 NB 时状态异常

上游桥接共享一个 CDP 会话，多个目标的上下文与请求可能冲突。目前请一次只打开一个目标，关闭其他目标后重开。必要时停止并重新启动辅助程序，再单独打开要用的小程序。

## 运行 hema-session.mjs 后自动重应用不工作

上游桥接共享一个 CDP 会话，单次客户端会重置调试域；不要在自动 watcher 运行时额外调用它。正常停止入口会先结束 watcher 后再恢复。需要诊断时先停止，按顺序重启。

## 停止后盒马窗口退出

当前小程序处于运行时调试模式，结束调试连接可能关闭该窗口。停止后重新从微信进入即可恢复原始行为。

## 提交问题时

提供 Windows 架构、Node/Frida/WMPF 版本、watcher state、失败阶段及必要的脱敏错误。不要公开完整日志、账号 token、地址、电话、聊天截图、HAR/PCAP 或小程序包。
