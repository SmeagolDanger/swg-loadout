/* ═══════════════════════════════════════════════════════════
   SWG File Utilities — Parsers, Writers, Helpers
   ═══════════════════════════════════════════════════════════ */

/* ───────────────────── Binary Reader ───────────────────── */
export class BinaryReader {
  constructor(buffer) {
    const ab = buffer instanceof ArrayBuffer ? buffer : buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    this.view = new DataView(ab);
    this.bytes = new Uint8Array(ab);
    this.pos = 0;
    this.buffer = ab;
  }
  readUint32BE() { const v = this.view.getUint32(this.pos, false); this.pos += 4; return v; }
  readUint32LE() { const v = this.view.getUint32(this.pos, true); this.pos += 4; return v; }
  readInt32BE()  { const v = this.view.getInt32(this.pos, false); this.pos += 4; return v; }
  readInt32LE()  { const v = this.view.getInt32(this.pos, true); this.pos += 4; return v; }
  readUint16BE() { const v = this.view.getUint16(this.pos, false); this.pos += 2; return v; }
  readUint16LE() { const v = this.view.getUint16(this.pos, true); this.pos += 2; return v; }
  readInt16BE()  { const v = this.view.getInt16(this.pos, false); this.pos += 2; return v; }
  readUint8()    { return this.bytes[this.pos++]; }
  readInt8()     { return this.view.getInt8(this.pos++ - 0); }
  readFloat32BE(){ const v = this.view.getFloat32(this.pos, false); this.pos += 4; return v; }
  readFloat32LE(){ const v = this.view.getFloat32(this.pos, true); this.pos += 4; return v; }
  readFloat64BE(){ const v = this.view.getFloat64(this.pos, false); this.pos += 8; return v; }
  readString(len) {
    let s = '';
    for (let i = 0; i < len; i++) { const c = this.bytes[this.pos++]; if (c !== 0) s += String.fromCharCode(c); }
    return s;
  }
  readCString() {
    let s = '';
    while (this.pos < this.bytes.length) { const c = this.bytes[this.pos++]; if (c === 0) break; s += String.fromCharCode(c); }
    return s;
  }
  readUnicodeString(charCount) {
    let s = '';
    for (let i = 0; i < charCount; i++) {
      if (this.remaining() < 2) break;
      const c = this.readUint16BE();
      if (c !== 0) s += String.fromCharCode(c);
    }
    return s;
  }
  readBytes(len) { const b = this.bytes.slice(this.pos, this.pos + len); this.pos += len; return b; }
  readVec3BE() { return { x: this.readFloat32BE(), y: this.readFloat32BE(), z: this.readFloat32BE() }; }
  readVec3LE() { return { x: this.readFloat32LE(), y: this.readFloat32LE(), z: this.readFloat32LE() }; }
  seek(pos) { this.pos = pos; }
  tell() { return this.pos; }
  remaining() { return this.bytes.length - this.pos; }
  hasMore() { return this.pos < this.bytes.length; }
}

/* ───────────────────── Binary Writer ───────────────────── */
export class BinaryWriter {
  constructor(initialSize = 4096) {
    this.buffer = new ArrayBuffer(initialSize);
    this.view = new DataView(this.buffer);
    this.bytes = new Uint8Array(this.buffer);
    this.pos = 0;
  }
  _ensure(n) {
    if (this.pos + n <= this.buffer.byteLength) return;
    const newSize = Math.max(this.buffer.byteLength * 2, this.pos + n + 1024);
    const newBuf = new ArrayBuffer(newSize);
    new Uint8Array(newBuf).set(this.bytes);
    this.buffer = newBuf;
    this.view = new DataView(this.buffer);
    this.bytes = new Uint8Array(this.buffer);
  }
  writeUint32BE(v) { this._ensure(4); this.view.setUint32(this.pos, v, false); this.pos += 4; }
  writeUint32LE(v) { this._ensure(4); this.view.setUint32(this.pos, v, true); this.pos += 4; }
  writeInt32BE(v)  { this._ensure(4); this.view.setInt32(this.pos, v, false); this.pos += 4; }
  writeUint16BE(v) { this._ensure(2); this.view.setUint16(this.pos, v, false); this.pos += 2; }
  writeUint16LE(v) { this._ensure(2); this.view.setUint16(this.pos, v, true); this.pos += 2; }
  writeUint8(v)    { this._ensure(1); this.bytes[this.pos++] = v & 0xff; }
  writeFloat32BE(v){ this._ensure(4); this.view.setFloat32(this.pos, v, false); this.pos += 4; }
  writeFloat32LE(v){ this._ensure(4); this.view.setFloat32(this.pos, v, true); this.pos += 4; }
  writeString(s) { this._ensure(s.length); for (let i = 0; i < s.length; i++) this.bytes[this.pos++] = s.charCodeAt(i); }
  writeCString(s) { this.writeString(s); this.writeUint8(0); }
  writeBytes(b)  { this._ensure(b.length); this.bytes.set(b, this.pos); this.pos += b.length; }
  setUint32BE(pos, v) { this.view.setUint32(pos, v, false); }
  setUint32LE(pos, v) { this.view.setUint32(pos, v, true); }
  tell() { return this.pos; }
  seek(pos) { this.pos = pos; }
  toUint8Array() { return new Uint8Array(this.buffer, 0, this.pos); }
  toArrayBuffer() { return this.buffer.slice(0, this.pos); }
}

/* ───────────────────── CRC-32 ───────────────────── */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c;
  }
  return t;
})();

export function crc32(data) {
  let crc = 0xffffffff;
  if (typeof data === 'string') {
    for (let i = 0; i < data.length; i++) crc = CRC_TABLE[(crc ^ data.charCodeAt(i)) & 0xff] ^ (crc >>> 8);
  } else {
    for (let i = 0; i < data.length; i++) crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function crc32Lower(str) {
  return crc32(str.toLowerCase());
}

/* ───────────────────── Zlib Compression / Decompression ───────────────────── */
async function _streamTransform(data, streamFactory) {
  const stream = streamFactory();
  const writer = stream.writable.getWriter();
  writer.write(data instanceof Uint8Array ? data : new Uint8Array(data));
  writer.close();
  const reader = stream.readable.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }
  const result = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { result.set(c, off); off += c.length; }
  return result;
}

export async function zlibDecompress(data) {
  const input = data instanceof Uint8Array ? data : new Uint8Array(data);
  // Try zlib-wrapped deflate (RFC 1950) — standard for SWG TRE files
  try { return await _streamTransform(input, () => new DecompressionStream('deflate')); }
  catch { /* fall through */ }
  // Try raw deflate (RFC 1951) — some browsers use 'deflate-raw'
  try { return await _streamTransform(input, () => new DecompressionStream('deflate-raw')); }
  catch { /* fall through */ }
  // Try stripping 2-byte zlib header and using raw deflate
  if (input.length > 2) {
    try { return await _streamTransform(input.slice(2), () => new DecompressionStream('deflate-raw')); }
    catch { /* fall through */ }
  }
  // Try adding a zlib header (78 01) if data is raw
  try {
    const withHeader = new Uint8Array(input.length + 2);
    withHeader[0] = 0x78; withHeader[1] = 0x01;
    withHeader.set(input, 2);
    return await _streamTransform(withHeader, () => new DecompressionStream('deflate'));
  } catch { /* fall through */ }
  throw new Error('All decompression methods failed for ' + input.length + ' bytes');
}

export async function zlibCompress(data) {
  return await _streamTransform(data, () => new CompressionStream('deflate'));
}

/* ───────────────────── TRE Parser ───────────────────── */
export async function parseTRE(buffer, treName) {
  const r = new BinaryReader(buffer);
  const magic = r.readString(4);
  if (magic !== 'EERT') throw new Error('Not a valid TRE file (magic: ' + magic + ')');
  const version = r.readString(4);
  const numFiles = r.readUint32LE();
  const infoOffset = r.readUint32LE();
  const infoCompSize = r.readUint32LE();
  const infoDecompSize = r.readUint32LE();
  const nameCompSize = r.readUint32LE();
  const nameDecompSize = r.readUint32LE();

  r.seek(infoOffset);
  const infoRaw = r.readBytes(infoCompSize);
  const infoData = (infoCompSize !== infoDecompSize && infoCompSize > 0)
    ? await zlibDecompress(infoRaw) : infoRaw;

  const nameRaw = r.readBytes(nameCompSize);
  const nameData = (nameCompSize !== nameDecompSize && nameCompSize > 0)
    ? await zlibDecompress(nameRaw) : nameRaw;

  const records = [];
  const ir = new BinaryReader(infoData);
  for (let i = 0; i < numFiles; i++) {
    const checksum = ir.readUint32LE();
    const uncompLen = ir.readUint32LE();
    const offset = ir.readUint32LE();
    const compType = ir.readUint32LE();
    const compLen = ir.readUint32LE();
    const nameOff = ir.readUint32LE();
    let name = '';
    let p = nameOff;
    while (p < nameData.length && nameData[p] !== 0) { name += String.fromCharCode(nameData[p]); p++; }
    records.push({ checksum, uncompLen, offset, compType, compLen, nameOff, name, sourceTRE: treName });
  }
  return { version, numFiles, records, buffer };
}

/* ── Lazy TRE parser (reads only headers, keeps file handle) ── */
export async function parseTRELazy(fileHandle, treName) {
  const file = await fileHandle.getFile();
  const headerBuf = await file.slice(0, 36).arrayBuffer();
  const r = new BinaryReader(headerBuf);
  const magic = r.readString(4);
  if (magic !== 'EERT') throw new Error('Not a valid TRE: ' + treName);
  const version = r.readString(4);
  const numFiles = r.readUint32LE();
  const infoOffset = r.readUint32LE();
  const infoCompSize = r.readUint32LE();
  const infoDecompSize = r.readUint32LE();
  const nameCompSize = r.readUint32LE();
  const nameDecompSize = r.readUint32LE();

  const infoBuf = await file.slice(infoOffset, infoOffset + infoCompSize).arrayBuffer();
  const infoRaw = new Uint8Array(infoBuf);
  const infoData = (infoCompSize !== infoDecompSize) ? await zlibDecompress(infoRaw) : infoRaw;

  const nameStart = infoOffset + infoCompSize;
  const nameBuf = await file.slice(nameStart, nameStart + nameCompSize).arrayBuffer();
  const nameRaw = new Uint8Array(nameBuf);
  const nameData = (nameCompSize !== nameDecompSize) ? await zlibDecompress(nameRaw) : nameRaw;

  const records = [];
  const ir = new BinaryReader(infoData);
  for (let i = 0; i < numFiles; i++) {
    const checksum = ir.readUint32LE();
    const uncompLen = ir.readUint32LE();
    const offset = ir.readUint32LE();
    const compType = ir.readUint32LE();
    const compLen = ir.readUint32LE();
    const nameOff = ir.readUint32LE();
    let name = '';
    let p = nameOff;
    while (p < nameData.length && nameData[p] !== 0) { name += String.fromCharCode(nameData[p]); p++; }
    records.push({ checksum, uncompLen, offset, compType, compLen, nameOff, name, sourceTRE: treName });
  }
  return { version, numFiles, records, fileHandle, fileSize: file.size };
}

export async function extractTREFile(treBuffer, record) {
  const r = new BinaryReader(treBuffer);
  r.seek(record.offset);
  const raw = r.readBytes(record.compLen || record.uncompLen);
  if (record.compType === 2 && record.compLen !== record.uncompLen) return await zlibDecompress(raw);
  return raw;
}

export async function extractTREFileLazy(fileHandle, record) {
  const file = await fileHandle.getFile();
  const len = record.compLen || record.uncompLen;
  const buf = await file.slice(record.offset, record.offset + len).arrayBuffer();
  const raw = new Uint8Array(buf);
  if (record.compType === 2 && record.compLen !== record.uncompLen) return await zlibDecompress(raw);
  return raw;
}

/* ───────────────────── TRE Writer ───────────────────── */
export async function writeTRE(files, version = '0005') {
  // files: Array of { name, data (Uint8Array) }
  const w = new BinaryWriter(1024 * 1024);
  w.writeString('EERT');
  w.writeString(version.padEnd(4, '\0'));
  w.writeUint32LE(files.length);
  const headerOffsetsPos = w.tell();
  w.writeUint32LE(0); // infoOffset placeholder
  w.writeUint32LE(0); // infoCompSize
  w.writeUint32LE(0); // infoDecompSize
  w.writeUint32LE(0); // nameCompSize
  w.writeUint32LE(0); // nameDecompSize

  // Write file data
  const recordInfo = [];
  for (const f of files) {
    const offset = w.tell();
    const compressed = await zlibCompress(f.data);
    const useComp = compressed.length < f.data.length;
    const written = useComp ? compressed : f.data;
    w.writeBytes(written);
    recordInfo.push({
      checksum: crc32(f.data),
      uncompLen: f.data.length,
      offset,
      compType: useComp ? 2 : 0,
      compLen: written.length,
      name: f.name,
    });
  }

  // Build name table
  const nameW = new BinaryWriter(1024);
  const nameOffsets = [];
  for (const rec of recordInfo) {
    nameOffsets.push(nameW.tell());
    nameW.writeCString(rec.name);
  }
  const nameDataRaw = nameW.toUint8Array();
  const nameDataComp = await zlibCompress(nameDataRaw);

  // Build record table
  const infoW = new BinaryWriter(recordInfo.length * 24);
  for (let i = 0; i < recordInfo.length; i++) {
    const rec = recordInfo[i];
    infoW.writeUint32LE(rec.checksum);
    infoW.writeUint32LE(rec.uncompLen);
    infoW.writeUint32LE(rec.offset);
    infoW.writeUint32LE(rec.compType);
    infoW.writeUint32LE(rec.compLen);
    infoW.writeUint32LE(nameOffsets[i]);
  }
  const infoDataRaw = infoW.toUint8Array();
  const infoDataComp = await zlibCompress(infoDataRaw);

  // Write tables
  const infoOffset = w.tell();
  w.writeBytes(infoDataComp);
  w.writeBytes(nameDataComp);

  // Patch header
  w.setUint32LE(12, infoOffset);
  w.setUint32LE(16, infoDataComp.length);
  w.setUint32LE(20, infoDataRaw.length);
  w.setUint32LE(24, nameDataComp.length);
  w.setUint32LE(28, nameDataRaw.length);

  return w.toUint8Array();
}

/* ───────────────────── IFF Parser ───────────────────── */
export function parseIFF(buffer) {
  const r = new BinaryReader(buffer);
  const nodes = [];
  function readNode() {
    if (r.remaining() < 8) return null;
    const startPos = r.tell();
    const tag = r.readString(4);
    const size = r.readUint32BE();
    const endPos = startPos + 8 + size;
    if (tag === 'FORM') {
      if (size < 4) return { tag, type: '????', children: [], offset: startPos, size: size + 8 };
      const type = r.readString(4);
      const children = [];
      while (r.tell() < endPos && r.remaining() >= 8) {
        const child = readNode();
        if (child) children.push(child); else break;
      }
      r.seek(endPos);
      return { tag, type, children, offset: startPos, size: size + 8 };
    } else {
      const data = r.readBytes(Math.min(size, r.remaining()));
      if (size % 2 !== 0 && r.remaining() > 0) r.readUint8();
      return { tag, data, offset: startPos, size: size + 8 };
    }
  }
  while (r.remaining() >= 8) {
    const node = readNode();
    if (node) nodes.push(node); else break;
  }
  return nodes.length === 1 ? nodes[0] : { tag: 'ROOT', type: 'ROOT', children: nodes, offset: 0, size: r.bytes.length };
}

/* ───────────────────── IFF Writer ───────────────────── */
export function writeIFF(node) {
  const w = new BinaryWriter();
  function writeNode(n) {
    if (n.tag === 'FORM' || n.tag === 'ROOT') {
      if (n.tag === 'ROOT' && n.children) {
        for (const child of n.children) writeNode(child);
        return;
      }
      w.writeString('FORM');
      const sizePos = w.tell();
      w.writeUint32BE(0);
      w.writeString((n.type || '????').substring(0, 4).padEnd(4, ' '));
      for (const child of (n.children || [])) writeNode(child);
      const size = w.tell() - sizePos - 4;
      w.setUint32BE(sizePos, size);
    } else {
      w.writeString(n.tag.substring(0, 4).padEnd(4, ' '));
      const data = n.data || new Uint8Array(0);
      w.writeUint32BE(data.length);
      w.writeBytes(data);
      if (data.length % 2 !== 0) w.writeUint8(0);
    }
  }
  writeNode(node);
  return w.toUint8Array();
}

/* ───────────────────── Datatable Parser ───────────────────── */
export function parseDatatable(iffNode) {
  if (!iffNode || iffNode.tag !== 'FORM') return null;
  if (!iffNode.type?.startsWith('DT')) return null;
  const columns = [], colTypes = [], rows = [];
  function scanChildren(children) {
    for (const child of children) {
      if (child.tag === 'COLS' && columns.length === 0) {
        const cr = new BinaryReader(child.data);
        while (cr.remaining() > 0) { const n = cr.readCString(); if (n) columns.push(n); }
      } else if ((child.tag === 'TYPE' || child.tag === 'TYPS') && colTypes.length === 0) {
        const cr = new BinaryReader(child.data);
        while (cr.remaining() > 0) { const t = cr.readCString(); if (t) colTypes.push(t); }
      } else if (child.tag === 'ROWS' && rows.length === 0 && child.data) {
        const cr = new BinaryReader(child.data);
        const num = cr.remaining() > 4 ? cr.readUint32BE() : 0;
        for (let i = 0; i < num && cr.remaining() > 0; i++) {
          const row = [];
          for (const t of colTypes) {
            if (cr.remaining() <= 0) break;
            const tl = t.toLowerCase();
            if (tl === 'b') row.push(cr.readUint8() !== 0);
            else if ('ihe'.includes(tl)) row.push(cr.readInt32BE());
            else if (tl === 'f') row.push(cr.readFloat32BE());
            else row.push(cr.readCString());
          }
          rows.push(row);
        }
      } else if (child.tag === 'FORM' && child.children) {
        scanChildren(child.children);
      }
    }
  }
  scanChildren(iffNode.children || []);
  return { columns, colTypes, rows };
}

/* ───────────────────── STF Parser ───────────────────── */
export function parseSTF(buffer) {
  try {
    const r = new BinaryReader(buffer);
    r.readUint32BE(); r.readUint8(); r.readUint32BE();
    const count = r.readUint32BE();
    const entries = [];
    for (let i = 0; i < count && r.remaining() > 8; i++) {
      const id = r.readUint32BE(), crc = r.readUint32BE(), len = r.readUint32BE();
      entries.push({ id, crc, value: r.readUnicodeString(len) });
    }
    return { count, entries };
  } catch { return null; }
}

/* ───────────────────── PAL Parser ───────────────────── */
export function parsePAL(iffNode) {
  if (!iffNode) return null;
  // Find DATA chunk containing palette entries
  function findData(node) {
    if (node.data && node.tag === 'DATA') return node.data;
    if (node.children) for (const c of node.children) { const r = findData(c); if (r) return r; }
    return null;
  }
  const data = iffNode.data || findData(iffNode);
  if (!data || data.length < 3) return null;
  const colors = [];
  const r = new BinaryReader(data);
  while (r.remaining() >= 4) {
    const red = r.readUint8(), green = r.readUint8(), blue = r.readUint8(), alpha = r.readUint8();
    colors.push({ r: red, g: green, b: blue, a: alpha });
  }
  if (colors.length === 0 && data.length >= 3) {
    const r2 = new BinaryReader(data);
    while (r2.remaining() >= 3) {
      colors.push({ r: r2.readUint8(), g: r2.readUint8(), b: r2.readUint8(), a: 255 });
    }
  }
  return { colors };
}

/* ───────────────────── Mesh Parser (for 3D preview) ───────────────────── */
export function parseMesh(iffNode) {
  const result = { positions: [], normals: [], indices: [], shaders: [] };
  if (!iffNode || iffNode.tag !== 'FORM') return result;

  function findFormsOfType(node, type) {
    const found = [];
    if (node.tag === 'FORM' && node.type === type) found.push(node);
    if (node.children) for (const c of node.children) found.push(...findFormsOfType(c, type));
    return found;
  }
  function findChunk(node, tag) {
    if (node.tag === tag && node.data) return node;
    if (node.children) for (const c of node.children) { const r = findChunk(c, tag); if (r) return r; }
    return null;
  }

  // Find SPS (shader primitive sets)
  const spsNodes = findFormsOfType(iffNode, 'SPS ') || findFormsOfType(iffNode, 'SPS');
  const spsNode = spsNodes[0] || iffNode;

  // Find all versioned FORM children that contain vertex/index data
  const versionForms = (spsNode.children || []).filter(c => c.tag === 'FORM' && /^\d{4}$/.test(c.type));
  if (versionForms.length === 0) {
    // Try one level deeper
    for (const child of (iffNode.children || [])) {
      if (child.tag === 'FORM' && child.children) {
        versionForms.push(...child.children.filter(c => c.tag === 'FORM' && /^\d{4}$/.test(c.type)));
      }
    }
  }

  let globalIndexOffset = 0;
  for (const vf of versionForms) {
    // Find VTXA form
    const vtxaForms = findFormsOfType(vf, 'VTXA');
    const vtxa = vtxaForms[0];
    if (!vtxa) continue;

    const vtxaInfo = findChunk(vtxa, 'INFO');
    const vtxaData = findChunk(vtxa, 'DATA');
    if (!vtxaInfo || !vtxaData) continue;

    const ir = new BinaryReader(vtxaInfo.data);
    const flags = ir.readUint32BE();
    const vertexCount = ir.readUint32BE();

    // Calculate vertex stride from flags
    let stride = 0;
    const hasPos = true; stride += 12;
    const hasNormal = (flags & 0x02) !== 0; if (hasNormal) stride += 12;
    const hasColor0 = (flags & 0x04) !== 0; if (hasColor0) stride += 4;
    const hasColor1 = (flags & 0x08) !== 0; if (hasColor1) stride += 4;
    const numTexSets = (flags >> 8) & 0xff; stride += numTexSets * 8;
    // If stride seems wrong, try to calculate from data size
    if (stride * vertexCount > vtxaData.data.length && vertexCount > 0) {
      stride = Math.floor(vtxaData.data.length / vertexCount);
    }

    const vr = new BinaryReader(vtxaData.data);
    const baseVertex = result.positions.length / 3;
    for (let i = 0; i < vertexCount && vr.remaining() >= stride; i++) {
      const startP = vr.tell();
      result.positions.push(vr.readFloat32LE(), vr.readFloat32LE(), vr.readFloat32LE());
      if (hasNormal && vr.remaining() >= 12) {
        result.normals.push(vr.readFloat32LE(), vr.readFloat32LE(), vr.readFloat32LE());
      }
      vr.seek(startP + stride);
    }

    // Find INDX
    const indxChunk = findChunk(vf, 'INDX') || findChunk(vf, 'ITL ');
    if (indxChunk && indxChunk.data.length >= 4) {
      const ixr = new BinaryReader(indxChunk.data);
      const indexCount = ixr.readUint32LE();
      const use32 = (indxChunk.data.length - 4) / indexCount >= 4;
      for (let i = 0; i < indexCount && ixr.remaining() >= 2; i++) {
        result.indices.push((use32 ? ixr.readUint32LE() : ixr.readUint16LE()) + baseVertex);
      }
    }
  }

  // Try alternate structure: OITL for triangle lists
  if (result.positions.length === 0) {
    const dataChunks = [];
    function collectData(node) {
      if (node.data && (node.tag === 'POSN' || node.tag === 'DOT3')) dataChunks.push({ tag: node.tag, data: node.data });
      if (node.children) node.children.forEach(collectData);
    }
    collectData(iffNode);
  }

  return result;
}

/* ───────────────────── World Snapshot Parser ───────────────────── */
export function parseWorldSnapshot(iffNode) {
  const objects = [];
  if (!iffNode || iffNode.tag !== 'FORM') return { objects };

  function parseNodes(node) {
    if (!node.children) return;
    for (const child of node.children) {
      if (child.tag === 'FORM' && child.type === 'NODE') {
        const obj = { templateName: '', x: 0, y: 0, z: 0, yaw: 0, cellIndex: 0, objId: 0 };
        for (const sub of (child.children || [])) {
          if (sub.tag === 'OTNL' && sub.data) {
            const r = new BinaryReader(sub.data);
            if (r.remaining() > 4) { r.readUint32BE(); obj.templateName = r.readCString(); }
            else obj.templateName = r.readCString();
          }
          if (sub.tag === 'TRFM' && sub.data && sub.data.length >= 48) {
            const r = new BinaryReader(sub.data);
            // 3x4 matrix: rotation 3x3 + translation
            r.seek(sub.data.length - 12); // last 3 floats are position
            obj.x = r.readFloat32BE();
            obj.y = r.readFloat32BE();
            obj.z = r.readFloat32BE();
          }
          if (sub.tag === 'CELI' && sub.data) {
            obj.cellIndex = new BinaryReader(sub.data).readInt32BE();
          }
          if (sub.tag === 'OIDT' && sub.data) {
            obj.objId = new BinaryReader(sub.data).readUint32BE();
          }
        }
        objects.push(obj);
        // Recurse into child nodes
        parseNodes(child);
      } else {
        parseNodes(child);
      }
    }
  }
  parseNodes(iffNode);
  return { objects };
}

/* ───────────────────── Config Parser ───────────────────── */
export function parseLiveCfg(text) {
  const treFiles = [];
  for (const line of text.split('\n')) {
    const match = line.trim().match(/^searchTree[_\d]*\s*=\s*(.+\.tre)\s*$/i);
    if (match) treFiles.push(match[1].trim());
  }
  return treFiles;
}

/* ───────────────────── Directory Scanner ───────────────────── */
export async function scanDirectory(dirHandle, onProgress) {
  const treHandles = [];
  let cfgText = null;

  async function walk(handle, path = '') {
    for await (const entry of handle.values()) {
      const fullPath = path ? path + '/' + entry.name : entry.name;
      if (entry.kind === 'file') {
        const lower = entry.name.toLowerCase();
        if (lower.endsWith('.tre')) treHandles.push({ handle: entry, name: entry.name, path: fullPath });
        if (['live.cfg', 'swgemu_live.cfg', 'swgemu.cfg'].includes(lower)) {
          cfgText = await (await entry.getFile()).text();
        }
      } else if (entry.kind === 'directory') {
        await walk(entry, fullPath);
      }
    }
  }

  onProgress('Scanning directory…');
  await walk(dirHandle);

  let orderedTreNames = cfgText ? parseLiveCfg(cfgText) : [];
  if (orderedTreNames.length) onProgress('Found config with ' + orderedTreNames.length + ' TRE entries');

  const orderedHandles = [];
  const usedPaths = new Set();

  for (const treName of orderedTreNames) {
    const lower = treName.toLowerCase();
    const match = treHandles.find(h =>
      h.path.toLowerCase() === lower || h.name.toLowerCase() === lower || h.path.toLowerCase().endsWith('/' + lower)
    );
    if (match && !usedPaths.has(match.path)) { orderedHandles.push(match); usedPaths.add(match.path); }
  }
  for (const h of treHandles.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!usedPaths.has(h.path)) orderedHandles.push(h);
  }

  return { orderedHandles, cfgFound: !!cfgText, treCount: orderedHandles.length };
}

/* ───────────────────── Content Search ───────────────────── */
export async function searchRepository(treArchives, treBuffers, query, mode = 'filename', onProgress, abortSignal) {
  // mode: 'filename' | 'content_text' | 'content_hex' | 'crc'
  const results = [];
  const lowerQuery = query.toLowerCase();
  let searched = 0;

  for (const archive of treArchives) {
    if (abortSignal?.aborted) break;
    const buf = treBuffers[archive.name] || (archive.fileHandle ? null : null);

    for (const rec of archive.records || []) {
      if (abortSignal?.aborted) break;
      searched++;
      if (searched % 500 === 0) onProgress?.(searched);

      if (mode === 'filename') {
        if (rec.name.toLowerCase().includes(lowerQuery)) {
          results.push({ name: rec.name, sourceTRE: rec.sourceTRE || archive.name, record: rec });
        }
      } else if (mode === 'crc') {
        const targetCRC = parseInt(query, 16);
        if (!isNaN(targetCRC) && rec.checksum === targetCRC) {
          results.push({ name: rec.name, sourceTRE: rec.sourceTRE || archive.name, record: rec, match: 'CRC match' });
        }
      } else if ((mode === 'content_text' || mode === 'content_hex') && buf) {
        try {
          const data = await extractTREFile(buf, rec);
          let found = false;
          if (mode === 'content_text') {
            const text = new TextDecoder('ascii', { fatal: false }).decode(data);
            if (text.toLowerCase().includes(lowerQuery)) found = true;
          } else if (mode === 'content_hex') {
            const hexPattern = query.replace(/\s/g, '').toLowerCase();
            const hexStr = Array.from(data.slice(0, Math.min(data.length, 65536)))
              .map(b => b.toString(16).padStart(2, '0')).join('');
            if (hexStr.includes(hexPattern)) found = true;
          }
          if (found) {
            results.push({ name: rec.name, sourceTRE: rec.sourceTRE || archive.name, record: rec });
          }
        } catch {}
      }

      if (results.length >= 500) break;
    }
    if (results.length >= 500) break;
  }

  return { results, searched };
}

/* ───────────────────── Hex Formatting ───────────────────── */
export function formatHex(data, maxBytes = 4096) {
  const lines = [];
  const len = Math.min(data.length, maxBytes);
  for (let i = 0; i < len; i += 16) {
    const hex = [];
    let ascii = '';
    for (let j = 0; j < 16; j++) {
      if (i + j < len) {
        hex.push(data[i + j].toString(16).padStart(2, '0'));
        ascii += data[i + j] >= 32 && data[i + j] < 127 ? String.fromCharCode(data[i + j]) : '.';
      } else { hex.push('  '); ascii += ' '; }
    }
    lines.push({ offset: i.toString(16).padStart(8, '0'), hex: hex.slice(0, 8).join(' ') + '  ' + hex.slice(8).join(' '), ascii });
  }
  return lines;
}

/* ───────────────────── File Tree ───────────────────── */
export function buildFileTree(records) {
  const root = { name: '/', children: {}, files: [], fileCount: 0 };
  for (const rec of records) {
    const parts = rec.name.replace(/^\//, '').split('/');
    let node = root;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!node.children[parts[i]]) node.children[parts[i]] = { name: parts[i], children: {}, files: [], fileCount: 0 };
      node = node.children[parts[i]];
    }
    node.files.push({ ...rec, shortName: parts[parts.length - 1] });
  }
  function countFiles(n) { let c = n.files.length; for (const ch of Object.values(n.children)) c += countFiles(ch); n.fileCount = c; return c; }
  countFiles(root);
  return root;
}

export function mergeRecords(allTreRecords) {
  const merged = new Map();
  for (const records of allTreRecords) for (const rec of records) merged.set(rec.name, rec);
  return Array.from(merged.values());
}

/* ───────────────────── Helpers ───────────────────── */
export function formatSize(bytes) {
  if (bytes == null) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
  return (bytes / 1073741824).toFixed(2) + ' GB';
}

const FILE_ICONS = { iff: '◆', tre: '📦', stf: '💬', pal: '🎨', snd: '🔊', ws: '🌐', cef: '⚡', tab: '📊', dat: '📊', tga: '🖼', dds: '🖼', jpg: '🖼', png: '🖼', bmp: '🖼', ans: '🎭', msh: '🔷', apt: '📐', sat: '🛰', lua: '📜', inc: '📄', trn: '🏔', lay: '📐', pob: '🏛', sht: '🎨', cmp: '🧩', lod: '📏', mgn: '🦴', ska: '💀', skt: '🦴', flr: '🏠', cdf: '👤', lmg: '🖼', prt: '✨', trt: '🌳', lat: '📊', ilf: '🔧', wav: '🔊', mp3: '🎵' };
export function getFileIcon(name) { return FILE_ICONS[getFileExt(name)] || '📄'; }
export function getFileExt(name) { return (name || '').split('.').pop().toLowerCase(); }

export function hasMatchingFiles(node, term) {
  const t = term.toLowerCase();
  if (node.files?.some(f => f.shortName.toLowerCase().includes(t))) return true;
  for (const child of Object.values(node.children)) if (hasMatchingFiles(child, term)) return true;
  return false;
}

/* ───────────────────── Audio Helpers ───────────────────── */
export function tryDecodeAudio(data) {
  // Check for WAV header
  if (data.length > 44 && data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46) {
    return { type: 'wav', blob: new Blob([data], { type: 'audio/wav' }) };
  }
  // Check for MP3 header (0xFF 0xFB or ID3)
  if ((data[0] === 0xFF && (data[1] & 0xE0) === 0xE0) || (data[0] === 0x49 && data[1] === 0x44 && data[2] === 0x33)) {
    return { type: 'mp3', blob: new Blob([data], { type: 'audio/mpeg' }) };
  }
  // Try as raw audio (guess WAV-like)
  return { type: 'unknown', blob: new Blob([data], { type: 'application/octet-stream' }) };
}

/* ───────────────────── Diff Helpers ───────────────────── */
export function computeDiff(dataA, dataB, maxBytes = 8192) {
  const lenA = Math.min(dataA.length, maxBytes);
  const lenB = Math.min(dataB.length, maxBytes);
  const maxLen = Math.max(lenA, lenB);
  const diffs = []; // { offset, byteA, byteB }
  for (let i = 0; i < maxLen; i++) {
    const a = i < lenA ? dataA[i] : -1;
    const b = i < lenB ? dataB[i] : -1;
    if (a !== b) diffs.push({ offset: i, a, b });
  }
  return { diffs, sizeA: dataA.length, sizeB: dataB.length, identical: diffs.length === 0 && dataA.length === dataB.length };
}
