// Reapply the local Hema platform patch when its JS context is recreated.
// No account tokens are read. Existing consent is handled by Hema's own methods.
import WebSocket from 'ws';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const statePath = fileURLToPath(new URL('./hema-watch-status.json', import.meta.url));
const APPID = 'wx26a31270d9ab25e0';
let ws, sequence = 0, generation = 0, initializing = false;
const pending = new Map(), scripts = new Map(), breakpoints = new Map(), seen = new Set();
let busy = false, enabled = true;
function status(state, extra = {}) {
  writeFileSync(statePath, JSON.stringify({ pid: process.pid, state, at: new Date().toISOString(), ...extra }, null, 2));
  console.log('[hema-watch]', state);
}
function call(method, params = {}) {
  return new Promise((resolve, reject) => {
    if (ws?.readyState !== WebSocket.OPEN) return reject(Error('Disconnected'));
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(Error('Timeout')); }, 4000);
    pending.set(id, { resolve, reject, timer });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
function value(r) { if (r.exceptionDetails) throw Error('Evaluation failed'); return r.result.value; }
async function initialize() {
  if (initializing) return;
  initializing = true; generation++; scripts.clear(); breakpoints.clear(); seen.clear();
  try {
    await call('Runtime.disable'); await call('Runtime.enable');
    await call('Debugger.disable'); await call('Debugger.enable');
    status('waiting_for_hema');
  } catch { status('waiting_for_miniapp'); }
  finally { initializing = false; }
}
const patchExpression = `(()=>{
  if(wx.getAccountInfoSync().miniProgram.appId!=='${APPID}')throw Error('Wrong miniapp');
  if(globalThis.__HEMA_DESKTOP_DIAG__)return 'already_patched';
  const manager=e,popup=l.GI;
  if(typeof manager.isBannedPlatform!=='function'||typeof popup.clear!=='function'||typeof manager.prepareQueue!=='function')throw Error('Signature changed');
  globalThis.__HEMA_DESKTOP_DIAG__={manager,popup,originalCheck:manager.isBannedPlatform,originalCache:manager.bannedPlatformCache,
    restore(){manager.isBannedPlatform=this.originalCheck;manager.bannedPlatformCache=this.originalCache;popup.clear();manager.isOpen=false;delete globalThis.__HEMA_DESKTOP_DIAG__;return 'restored';}};
  manager.isBannedPlatform=function(){return false};manager.bannedPlatformCache=false;popup.clear();manager.isOpen=false;
  manager.prepareQueue(()=>{if(manager.callbackQueue.length)manager.requestQueue()});
  return 'patched';
})()`;
async function inspectScripts() {
  if (busy || initializing || !enabled) return;
  busy = true;
  const current = generation;
  try {
    for (const s of scripts.values()) {
      if (seen.has(s.scriptId)) continue;
      let id;
      try { id = value(await call('Runtime.evaluate', { contextId: s.executionContextId, expression: "typeof wx!=='undefined'&&wx.getAccountInfoSync?wx.getAccountInfoSync().miniProgram.appId:''", returnByValue: true })); }
      catch { continue; }
      if (id !== APPID) continue;
      if (current !== generation) return;
      const already = value(await call('Runtime.evaluate', { contextId: s.executionContextId, expression: '!!globalThis.__HEMA_DESKTOP_DIAG__', returnByValue: true }));
      if (already) { seen.add(s.scriptId); status('patched', { appid: APPID }); continue; }
      const { scriptSource: source } = await call('Debugger.getScriptSource', { scriptId: s.scriptId });
      const marker = 'this.openModal=function(){';
      const index = source.indexOf(marker);
      if (index < 0 || source.indexOf(marker, index + 1) >= 0) { seen.add(s.scriptId); status('unsupported_module_signature'); continue; }
      const pos = index + marker.length, before = source.slice(0, pos);
      const { breakpointId } = await call('Debugger.setBreakpoint', { location: { scriptId: s.scriptId, lineNumber: before.split('\n').length - 1, columnNumber: pos - before.lastIndexOf('\n') - 1 } });
      breakpoints.set(breakpointId, s.executionContextId); seen.add(s.scriptId);
      status('waiting_for_platform_check');
    }
  } catch { status('waiting_for_context'); }
  finally { busy = false; }
}
async function handlePause(params) {
  const own = (params.hitBreakpoints || []).filter(id => breakpoints.has(id));
  if (!own.length) return;
  try {
    const r = await call('Debugger.evaluateOnCallFrame', { callFrameId: params.callFrames[0].callFrameId, expression: patchExpression, returnByValue: true });
    const outcome = value(r);
    status(outcome === 'patched' || outcome === 'already_patched' ? 'patched' : 'unexpected_result', { appid: APPID });
  } catch { status('patch_failed'); }
  finally {
    for (const id of own) { await call('Debugger.removeBreakpoint', { breakpointId: id }).catch(() => {}); breakpoints.delete(id); }
    await call('Debugger.resume').catch(() => {});
  }
}
function connect() {
  if (!enabled) return;
  ws = new WebSocket('ws://127.0.0.1:62000');
  ws.on('open', initialize);
  ws.on('error', () => {});
  ws.on('close', () => { status('waiting_for_debugger'); setTimeout(connect, 1500); });
  ws.on('message', data => {
    let m; try { m = JSON.parse(data.toString()); } catch { return; }
    if (pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); clearTimeout(p.timer); m.error ? p.reject(Error('CDP error')) : p.resolve(m.result); }
    else if (m.method === 'WMPF.sessionConnected') initialize();
    else if (m.method === 'WMPF.sessionDisconnected') { generation++; scripts.clear(); seen.clear(); breakpoints.clear(); status('waiting_for_miniapp'); }
    else if (m.method === 'Debugger.scriptParsed' && m.params.url === 'https://usr/app-service.js') { scripts.set(m.params.scriptId, m.params); }
    else if (m.method === 'Debugger.paused') handlePause(m.params);
  });
}
process.on('SIGINT', () => { enabled = false; ws?.close(); process.exit(0); });
status('starting'); connect(); setInterval(inspectScripts, 1200);
