// Regression tests for native mutation ordering, not remote mini-program behavior.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = readFileSync(path.join(__dirname, '../frida/hook.js'), 'utf8').replace(/\nmain\(\);\s*$/, '');
const config = JSON.parse(readFileSync(path.join(__dirname, '../frida/config/win32/addresses.26073.json'), 'utf8'));
const targets = Object.keys(JSON.parse(readFileSync(path.join(__dirname, '../hema-targets.json'), 'utf8')));

function launch({ ids = ['wx1111111111111111', 'wx1111111111111111'], scene = 1256, marker = 18, unreadable = false } = {}) {
  const writes = [], messages = [];
  const pointers = new Map([[1064, 2000], [3616, 3000], [3008, 4000], [5544, 5000], [5016, 6000]]);
  class Pointer {
    constructor(address) { this.address = address; }
    add(n) { return new Pointer(this.address + n); }
    readPointer() { if (!pointers.has(this.address)) throw Error('unreadable'); return new Pointer(pointers.get(this.address)); }
    readU8() {
      if (unreadable) throw Error('unreadable');
      if ([4199, 4231].includes(this.address)) return marker;
      if ([4194, 4226].includes(this.address)) return 0;
      if (this.address === 4671) return 0;
      throw Error('unexpected byte read');
    }
    readUtf8String() { return ids[this.address === 4176 ? 0 : 1]; }
    readS8() { return this.readU8(); }
    readInt() { if (this.address === 6480) return scene; if (this.address === 6748) return 0; throw Error('unexpected integer'); }
    writeInt(v) { writes.push([this.address, v]); }
    writeU8(v) { writes.push([this.address, v]); }
    writeU64(v) { writes.push([this.address, v]); }
    writeUtf8String(v) { writes.push([this.address, v]); }
  }
  class Flag {
    constructor(value) { this.value = BigInt(value); }
    and(v) { return new Flag(this.value & BigInt(v instanceof Flag ? v.value : v)); }
    or(v) { return new Flag(this.value | BigInt(v)); }
    toInt32() { return Number(this.value); }
  }
  let handler;
  vm.runInNewContext(source + '\npatchOnLoadStart(BASE, CONFIG);', {
    BASE: { add: () => 1 }, CONFIG: { ...config, AllowedAppIds: targets },
    Interceptor: { attach: (_addr, callbacks) => { handler = callbacks; } },
    ptr: value => new Flag(value), send: message => messages.push(message),
  });
  const originalFlag = new Flag(0);
  const args = [new Pointer(1000), originalFlag];
  handler.onEnter(args);
  return { writes, messages, args, originalFlag };
}

test('unrelated AppID leaves launch data and debug flag unchanged', () => {
  const r = launch();
  assert.deepEqual(r.writes, []);
  assert.equal(r.args[1], r.originalFlag);
  assert.equal(r.messages.some(m => m.action === 'skipped'), true);
  assert.equal(r.messages.some(m => m.appid), false);
});
test('mismatched, unreadable and unknown string layouts fail closed', () => {
  for (const options of [{ ids: [targets[0], targets[1]] }, { marker: 128 }, { unreadable: true }]) {
    const r = launch(options);
    assert.deepEqual(r.writes, []);
    assert.equal(r.args[1], r.originalFlag);
  }
});
test('unsupported launch scene preserves even a supported app', () => {
  const r = launch({ ids: [targets[0], targets[0]], scene: 1000 });
  assert.deepEqual(r.writes, []);
  assert.equal(r.args[1], r.originalFlag);
});
for (const id of targets) test(`verified target ${id} enables only its launch`, () => {
  const r = launch({ ids: [id, id] });
  assert.equal(r.args[1].value, 1n);
  assert.equal(r.writes.some(([address, value]) => address === 6480 && value === 1101), true);
  assert.equal(r.writes.some(([address, value]) => address === 6748 && value === 1), true);
  assert.equal(r.messages.some(m => m.action === 'allowed' && m.appid === id), true);
});
