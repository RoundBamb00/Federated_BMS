export function frame(length = 40, id = 1) {
  const raw = new Uint8Array(length);
  const view = new DataView(raw.buffer);
  raw.set([0xaa, id]);
  const count = length === 46 ? 15 : 12;
  for (let i = 0; i < count; i++) view.setUint16(2 + i * 2, 3300 + i);
  let p = 2 + count * 2;
  view.setUint16(p, 39666); p += 2;
  view.setUint16(p, 72); p += 2;
  view.setInt16(p, -2); p += 2;
  raw[p++] = 251; raw[p++] = 1; raw[p++] = 0;
  view.setUint16(p, 3311); p += 2;
  view.setUint16(p, 3300); p += 2;
  raw[p] = 26;
  return raw;
}
