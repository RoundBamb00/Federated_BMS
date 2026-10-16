import test from 'node:test';
import assert from 'node:assert/strict';
import { FrameParser, parseFrame, PackResolver, COMMANDS, summarize } from '../src/protocol.js';
import { frame } from './fixtures.js';
import { readFileSync } from 'node:fs';

for (const length of [40, 46]) {
  test(`decode ${length}-byte source-compatible packet`, () => {
    const p = parseFrame(frame(length), 2);
    assert.equal(p.packIndex, 2);
    assert.deepEqual(p.cellsMv, Array.from({ length: 12 }, (_, i) => 3300 + i));
    assert.equal(p.totalMv, 39666);
    assert.equal(p.soc, 72);
    assert.equal(p.currentA, -2);
    assert.equal(p.temp1, -5);
    assert.equal(p.temp2, 26);
    assert.equal(p.dsgOn, true);
    assert.equal(p.chgOn, false);
    assert.equal(p.maxMv, 3311);
    assert.equal(p.minMv, 3300);
  });
  test(`${length}-byte parser handles every split including AA split and final packet`, () => {
    const a = frame(length);
    for (let split = 1; split < length; split++) {
      const parser = new FrameParser(length);
      assert.deepEqual(parser.feed(a.slice(0, split)), []);
      assert.deepEqual(parser.feed(a.slice(split)), [a]);
    }
  });
  test(`${length}-byte parser handles noise, coalescing and header-like payload`, () => {
    const a = frame(length); a[9] = 0xaa; a[10] = 0x01;
    const b = frame(length, 2);
    const parser = new FrameParser(length);
    assert.deepEqual(parser.feed(Uint8Array.from([7, 0xaa, 0, ...a, ...b])), [a, b]);
    parser.feed(new Uint8Array(100000));
    assert.ok(parser.buffer.length <= 1);
  });
}
test('invalid frames rejected and missing voltages preserved', () => {
  assert.throws(() => parseFrame(new Uint8Array(40), 1));
  assert.throws(() => parseFrame(new Uint8Array(41), 1));
  assert.throws(() => new FrameParser(70));
  const a = frame(); a[2] = 0; a[3] = 0;
  assert.equal(parseFrame(a, 1).cellsMv[0], null);
});
test('same-header alternation and explicit IDs match source', () => {
  const r = new PackResolver(true);
  assert.deepEqual([1, 1, 1, 2, 3, 4].map(id => r.resolve(id)), [1, 2, 1, 2, 1, 2]);
  const explicit = new PackResolver(false);
  assert.deepEqual([1, 1, 2].map(id => explicit.resolve(id)), [1, 1, 2]);
});
test('exact six hardware command bytes', () => {
  assert.deepEqual(COMMANDS, { start: [1, 2, 85], stop: [1, 3, 85], openDsg: [1, 4, 85], closeDsg: [1, 5, 85], openChg: [1, 6, 85], closeChg: [1, 7, 85] });
});
test('24S total requires both packs; missing is never zero', () => {
  const p = parseFrame(frame(), 1);
  assert.equal(summarize({}).totalMv, null);
  assert.equal(summarize({ 1: p }).totalMv, null);
  assert.deepEqual(summarize({ 1: p, 2: p }), { totalMv: 79332, soc: 72, maxMv: 3311, minMv: 3300, deltaMv: 11 });
});
test('all decoded fields match the original Python parser oracle', () => {
  const fixtures = JSON.parse(readFileSync(new URL('./source-parity.json', import.meta.url)));
  const mapping = { pack_index: 'packIndex', header_id: 'headerId', cells_mv: 'cellsMv', total_mv: 'totalMv', soc: 'soc', current_a: 'currentA', temp1: 'temp1', temp2: 'temp2', dsg_on: 'dsgOn', chg_on: 'chgOn', max_mv: 'maxMv', min_mv: 'minMv', raw_len: 'rawLen' };
  for (const fixture of fixtures) {
    const actual = parseFrame(Uint8Array.from(fixture.raw), 2);
    for (const [oldKey, key] of Object.entries(mapping)) assert.deepEqual(actual[key], fixture.python[oldKey], key);
  }
});
