import test from 'node:test';
import assert from 'node:assert/strict';
import { SerialConnection } from '../src/serial.js';

function device() {
  let input;
  const writes = [];
  const port = {
    readable: new ReadableStream({ start(c) { input = c; } }),
    writable: new WritableStream({ write(bytes) { writes.push([...bytes]); } }),
    async open(options) { this.options = options; },
    async close() { this.closed = true; },
  };
  return { port, writes, input, api: { requestPort: async () => port } };
}
test('user-selected port: reads bytes, writes only requested command, releases locks', async () => {
  const d = device(), received = [], states = [];
  const s = new SerialConnection(d.api, { onData: b => received.push([...b]), onState: v => states.push(v) });
  await s.connect(115200);
  assert.deepEqual(d.port.options, { baudRate: 115200, dataBits: 8, stopBits: 1, parity: 'none', flowControl: 'none' });
  assert.equal(d.writes.length, 0);
  d.input.enqueue(Uint8Array.of(0xaa, 1));
  await new Promise(r => setImmediate(r));
  assert.deepEqual(received, [[0xaa, 1]]);
  await s.send('openChg');
  assert.deepEqual(d.writes, [[1, 6, 85]]);
  await assert.rejects(s.send('unknown'));
  await s.disconnect();
  assert.equal(d.port.readable.locked, false);
  assert.equal(d.port.writable.locked, false);
  assert.equal(d.port.closed, true);
  assert.equal(states.at(-1), 'closed');
  await assert.rejects(s.send('start'));
});
test('cancelled chooser and open failure leave connection closed', async () => {
  const states = [];
  const s = new SerialConnection({ requestPort: async () => { throw new DOMException('Cancelled', 'NotFoundError'); } }, { onState: v => states.push(v) });
  await assert.rejects(s.connect(115200), { name: 'NotFoundError' });
  assert.equal(states.at(-1), 'closed');
  const d = device(); d.port.open = async () => { throw new Error('busy'); };
  const failed = new SerialConnection(d.api);
  await assert.rejects(failed.connect(115200), /busy/);
  await assert.rejects(failed.send('start'));
});
test('unplug/read failure closes port and reports error', async () => {
  const d = device(), errors = [];
  const s = new SerialConnection(d.api, { onError: e => errors.push(e.message) });
  await s.connect(115200);
  d.input.error(new Error('unplugged'));
  await s.readTask;
  assert.deepEqual(errors, ['unplugged']);
  assert.equal(d.port.closed, true);
  assert.equal(d.port.writable.locked, false);
});
test('reject concurrent connect and commands during pending write/close', async () => {
  const d = device();
  let releaseWrite;
  d.port.writable = new WritableStream({ write: () => new Promise(resolve => { releaseWrite = resolve; }) });
  const s = new SerialConnection(d.api);
  const opening = s.connect(115200);
  await assert.rejects(s.connect(115200), /busy/);
  await opening;
  const writing = s.send('start');
  await assert.rejects(s.send('stop'), /still being sent/);
  const closing = s.disconnect();
  await assert.rejects(s.send('stop'), /not open/);
  releaseWrite();
  await Promise.all([writing, closing]);
  assert.equal(d.port.closed, true);
  assert.equal(d.port.writable.locked, false);
});
test('write failure rejects instead of reporting success', async () => {
  const d = device();
  d.port.writable = new WritableStream({ write: () => { throw new Error('write failed'); } });
  const s = new SerialConnection(d.api);
  await s.connect(115200);
  await assert.rejects(s.send('start'), /write failed/);
  await s.disconnect();
  assert.equal(d.port.writable.locked, false);
});
for (const phase of ['chooser', 'open']) {
  test(`cleanup during pending ${phase} never leaves an open port`, async () => {
    const d = device();
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    if (phase === 'chooser') d.api.requestPort = async () => { await gate; return d.port; };
    else d.port.open = async () => { await gate; };
    const s = new SerialConnection(d.api);
    const opening = s.connect(115200);
    await new Promise(resolve => setImmediate(resolve));
    await s.disconnect();
    release();
    await opening;
    assert.equal(s.state, 'closed');
    assert.equal(d.port.readable.locked, false);
    assert.equal(d.port.writable.locked, false);
    if (phase === 'open') assert.equal(d.port.closed, true);
  });
}
