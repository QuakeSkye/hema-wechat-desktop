// Local-only diagnostic client. Does not read tokens or accept privacy agreements.
import WebSocket from 'ws';

const action = process.argv[2] || 'status';
if (!['status', 'apply', 'restore'].includes(action)) throw Error('Use status, apply, or restore');
const ws = new WebSocket('ws://127.0.0.1:62000');
const pending = new Map();
const contexts = new Map();
const scripts = new Map();
let seq = 0;
let paused = null;
let breakpoint = null;
let frameWait = null;
const call = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++seq;
  const timer = setTimeout(() => { pending.delete(id); reject(Error('Timeout: ' + method)); }, 10000);
  pending.set(id, { resolve, reject, timer });
  ws.send(JSON.stringify({ id, method, params }));
});
ws.on('message', data => {
  const m = JSON.parse(data.toString());
  if (pending.has(m.id)) {
    const p = pending.get(m.id); pending.delete(m.id); clearTimeout(p.timer);
    m.error ? p.reject(Error(m.error.message)) : p.resolve(m.result);
  } else if (m.method === 'Runtime.executionContextCreated') contexts.set(m.params.context.id, m.params.context);
  else if (m.method === 'Debugger.scriptParsed') scripts.set(m.params.scriptId, m.params);
  else if (m.method === 'Debugger.paused') { paused = m.params; frameWait?.(paused); }
});
const evaluate = (contextId, expression) => call('Runtime.evaluate', { contextId, expression, returnByValue: true });
const checkedValue = result => {
  if (result.exceptionDetails) throw Error('Evaluation failed');
  return result.result.value;
};

try {
  await new Promise((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); });
  // The upstream bridge shares one CDP session across local clients.
  await call('Runtime.disable');
  await call('Runtime.enable');
  await call('Debugger.disable');
  await call('Debugger.enable');
  let contextId;
  for (const id of contexts.keys()) {
    try {
      const idValue = checkedValue(await evaluate(id, "typeof wx!=='undefined'&&wx.getAccountInfoSync?wx.getAccountInfoSync().miniProgram.appId:''"));
      if (idValue === 'wx26a31270d9ab25e0') { contextId = id; break; }
    } catch {}
  }
  if (!contextId) throw Error('Hema context not found. Open Hema after starting the debugger.');
  if (action === 'status') {
    console.log(checkedValue(await evaluate(contextId, "JSON.stringify({appid:wx.getAccountInfoSync().miniProgram.appId,platform:wx.getDeviceInfo().platform,patched:!!globalThis.__HEMA_DESKTOP_DIAG__,agreement:globalThis.__HEMA_DESKTOP_DIAG__?.manager.privateAgreement,queueLength:globalThis.__HEMA_DESKTOP_DIAG__?.manager.callbackQueue.length})")));
  } else if (action === 'restore') {
    console.log(checkedValue(await evaluate(contextId, "globalThis.__HEMA_DESKTOP_DIAG__?globalThis.__HEMA_DESKTOP_DIAG__.restore():'No session patch present'")));
    console.log('Close Hema and stop the debugger to fully return to normal launch behavior.');
  } else {
    const already = checkedValue(await evaluate(contextId, '!!globalThis.__HEMA_DESKTOP_DIAG__'));
    if (already) throw Error('Patch already active');
    const script = [...scripts.values()].find(s => s.executionContextId === contextId && s.url === 'https://usr/app-service.js');
    if (!script) throw Error('Hema app script not found');
    const { scriptSource: source } = await call('Debugger.getScriptSource', { scriptId: script.scriptId });
    const marker = 'this.openModal=function(){';
    const markerIndex = source.indexOf(marker);
    if (markerIndex < 0 || source.indexOf(marker, markerIndex + 1) >= 0) throw Error('Ambiguous module signature');
    const pos = markerIndex + marker.length;
    const before = source.slice(0, pos);
    const location = { scriptId: script.scriptId, lineNumber: before.split('\n').length - 1, columnNumber: pos - before.lastIndexOf('\n') - 1 };
    breakpoint = (await call('Debugger.setBreakpoint', { location })).breakpointId;
    if (!paused) await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { frameWait = null; reject(Error('Platform module did not execute')); }, 10000);
      frameWait = () => { clearTimeout(timer); frameWait = null; resolve(); };
    });
    const expression = `(()=>{
      if(wx.getAccountInfoSync().miniProgram.appId!=='wx26a31270d9ab25e0')throw Error('Wrong miniapp');
      const manager=e,popup=l.GI;
      if(typeof manager.isBannedPlatform!=='function'||typeof popup.clear!=='function')throw Error('Module signature changed');
      globalThis.__HEMA_DESKTOP_DIAG__={manager,popup,originalCheck:manager.isBannedPlatform,originalCache:manager.bannedPlatformCache,
        restore(){manager.isBannedPlatform=this.originalCheck;manager.bannedPlatformCache=this.originalCache;popup.clear();manager.isOpen=false;delete globalThis.__HEMA_DESKTOP_DIAG__;manager.openModal();return 'restored';}};
      manager.isBannedPlatform=function(){return false};manager.bannedPlatformCache=false;popup.clear();manager.isOpen=false;
      return JSON.stringify({patched:true,agreement:manager.privateAgreement,queueLength:manager.callbackQueue.length});
    })()`;
    console.log(checkedValue(await call('Debugger.evaluateOnCallFrame', { callFrameId: paused.callFrames[0].callFrameId, expression, returnByValue: true })));
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (ws.readyState === WebSocket.OPEN) {
    if (breakpoint) await call('Debugger.removeBreakpoint', { breakpointId: breakpoint }).catch(() => {});
    if (paused) await call('Debugger.resume').catch(() => {});
    await call('Debugger.disable').catch(() => {});
    ws.close();
  }
}
