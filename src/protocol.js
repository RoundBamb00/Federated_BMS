// Wire layout and current scale follow Code/GUI.py; this protocol has no ACK/CRC.
export const COMMANDS = Object.freeze({
  start: [1, 2, 0x55], stop: [1, 3, 0x55],
  openDsg: [1, 4, 0x55], closeDsg: [1, 5, 0x55],
  openChg: [1, 6, 0x55], closeChg: [1, 7, 0x55],
});

export class FrameParser {
  constructor(length = 46) {
    if (![40, 46].includes(length)) throw new Error('Unsupported frame length');
    this.length = length;
    this.buffer = new Uint8Array();
  }
  feed(chunk) {
    const bytes = new Uint8Array(this.buffer.length + chunk.length);
    bytes.set(this.buffer); bytes.set(chunk, this.buffer.length);
    const frames = [];
    let pos = 0;
    while (pos + 1 < bytes.length) {
      if (bytes[pos] !== 0xaa || bytes[pos + 1] < 1 || bytes[pos + 1] > 16) { pos++; continue; }
      if (bytes.length - pos < this.length) break;
      frames.push(bytes.slice(pos, pos + this.length));
      pos += this.length;
    }
    this.buffer = bytes.slice(pos);
    return frames;
  }
}

export class PackResolver {
  constructor(alternate = true) { this.alternate = alternate; this.next = 1; }
  resolve(id) {
    if (id === 1 && this.alternate) {
      const pack = this.next; this.next = pack === 1 ? 2 : 1; return pack;
    }
    return id % 2 === 1 ? 1 : 2;
  }
}

export function parseFrame(raw, packIndex) {
  if (![40, 46].includes(raw.length) || raw[0] !== 0xaa || raw[1] < 1 || raw[1] > 16) throw new Error('Invalid BMS frame');
  const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  const cellsMv = Array.from({ length: 12 }, (_, i) => view.getUint16(2 + 2 * i) || null);
  const p = raw.length === 46 ? 32 : 26;
  return {
    packIndex, headerId: raw[1], cellsMv,
    totalMv: view.getUint16(p) || null, soc: view.getUint16(p + 2),
    currentA: view.getInt16(p + 4), temp1: view.getInt8(p + 6),
    dsgOn: Boolean(raw[p + 7]), chgOn: Boolean(raw[p + 8]),
    maxMv: view.getUint16(p + 9) || null, minMv: view.getUint16(p + 11) || null,
    temp2: view.getInt8(p + 13), rawLen: raw.length,
  };
}

export function summarize(packs) {
  const a = packs[1], b = packs[2];
  const cells = Object.values(packs).flatMap(p => p.cellsMv).filter(v => v != null);
  const maxMv = cells.length ? Math.max(...cells) : null;
  const minMv = cells.length ? Math.min(...cells) : null;
  return {
    totalMv: a?.totalMv != null && b?.totalMv != null ? a.totalMv + b.totalMv : null,
    soc: a && b ? Math.trunc((a.soc + b.soc) / 2) : null,
    maxMv, minMv, deltaMv: cells.length ? maxMv - minMv : null,
  };
}
