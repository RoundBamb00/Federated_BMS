// Wire layout and current scale follow Code/GUI.py; this protocol has no ACK/CRC.
export const COMMANDS = Object.freeze({
  start: [1, 2, 0x55], stop: [1, 3, 0x55],
  openDsg: [1, 4, 0x55], closeDsg: [1, 5, 0x55],
  openChg: [1, 6, 0x55], closeChg: [1, 7, 0x55],
});

export class FrameParser {
  constructor(length = 46) {
    if (![40, 46, 50].includes(length)) throw new Error('Unsupported frame length');
    this.length = length;
    this.buffer = new Uint8Array();
  }
  feed(chunk) {
    const bytes = new Uint8Array(this.buffer.length + chunk.length);
    bytes.set(this.buffer); bytes.set(chunk, this.buffer.length);
    const frames = [];
    let pos = 0;
    while (pos + 1 < bytes.length) {
      if (bytes[pos] !== 0xaa || bytes[pos + 1] < 1 || bytes[pos + 1] > (this.length === 50 ? 3 : 16)) { pos++; continue; }
      if (bytes.length - pos < this.length) break;
      frames.push(bytes.slice(pos, pos + this.length));
      pos += this.length;
    }
    this.buffer = bytes.slice(pos);
    return frames;
  }
}

export class PackResolver {
  constructor(alternate = true, packCount = 2) { this.alternate = alternate; this.packCount = packCount; this.next = 1; }
  resolve(id) {
    if (this.packCount === 3) return id >= 1 && id <= 3 ? id : null;
    if (id === 1 && this.alternate) {
      const pack = this.next; this.next = pack === 1 ? 2 : 1; return pack;
    }
    return id % 2 === 1 ? 1 : 2;
  }
}

export function parseFrame(raw, packIndex) {
  if (![40, 46, 50].includes(raw.length) || raw[0] !== 0xaa || raw[1] < 1 || raw[1] > (raw.length === 50 ? 3 : 16)) throw new Error('Invalid BMS frame');
  const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  const cellsMv = Array.from({ length: 12 }, (_, i) => view.getUint16(2 + 2 * i) || null);
  const p = raw.length >= 46 ? 32 : 26;
  return {
    packIndex, headerId: raw[1], cellsMv,
    totalMv: view.getUint16(p) || null, soc: raw.length === 50 && view.getUint16(p + 2) > 100 ? null : view.getUint16(p + 2),
    currentA: view.getInt16(p + 4), temp1: view.getInt8(p + 6),
    // 36S firmware does not call BMS_STA in its acquisition loop.
    dsgOn: raw.length === 50 ? null : Boolean(raw[p + 7]), chgOn: raw.length === 50 ? null : Boolean(raw[p + 8]),
    maxMv: view.getUint16(p + 9) || null, minMv: view.getUint16(p + 11) || null,
    temp2: view.getInt8(p + 13), rawLen: raw.length,
  };
}

export function summarize(packs, packCount = 2) {
  const selected = Array.from({ length: packCount }, (_, i) => packs[i + 1]);
  const cells = selected.filter(Boolean).flatMap(p => p.cellsMv).filter(v => v != null);
  const maxMv = cells.length ? Math.max(...cells) : null;
  const minMv = cells.length ? Math.min(...cells) : null;
  return {
    totalMv: selected.every(p => p?.totalMv != null) ? selected.reduce((sum, p) => sum + p.totalMv, 0) : null,
    soc: selected.every(p => p?.soc != null) ? Math.trunc(selected.reduce((sum, p) => sum + p.soc, 0) / packCount) : null,
    maxMv, minMv, deltaMv: cells.length ? maxMv - minMv : null,
  };
}
