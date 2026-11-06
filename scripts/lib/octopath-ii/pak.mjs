import fs from 'node:fs';
import crypto from 'node:crypto';
import zlib from 'node:zlib';

export const digest = (bytes, algorithm = 'sha256') => crypto.createHash(algorithm).update(bytes).digest('hex');
export class Reader {
  constructor(buffer, position = 0, limit = buffer.length) { this.buffer = buffer; this.position = position; this.limit = limit; }
  bytes(length) {
    if (!Number.isSafeInteger(length) || length < 0 || this.position + length > this.limit) throw new Error(`Truncated/invalid read at ${this.position}: ${length}`);
    const result = this.buffer.subarray(this.position, this.position + length); this.position += length; return result;
  }
  u8() { return this.bytes(1)[0]; }
  u32() { return this.bytes(4).readUInt32LE(); }
  i32() { return this.bytes(4).readInt32LE(); }
  u64() { const n = this.bytes(8).readBigUInt64LE(); if (n > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Unsafe integer offset'); return Number(n); }
  f32() { const n = this.bytes(4).readFloatLE(); if (!Number.isFinite(n)) throw new Error('Non-finite float'); return n; }
  count(max = 1000000) { const n = this.i32(); if (n < 0 || n > max) throw new Error(`Invalid count: ${n}`); return n; }
  string() {
    const n = this.i32(); if (n === 0) return '';
    if (Math.abs(n) > 1000000) throw new Error(`Invalid FString length ${n}`);
    const width = n < 0 ? 2 : 1, b = this.bytes(Math.abs(n) * width);
    if (!b.subarray(-width).equals(Buffer.alloc(width))) throw new Error('Unterminated FString');
    return new TextDecoder(n < 0 ? 'utf-16le' : 'utf-8', { fatal: true }).decode(b.subarray(0, -width));
  }
}

export async function hashFile(path) { const h = crypto.createHash('sha256'); for await (const b of fs.createReadStream(path)) h.update(b); return h.digest('hex'); }

// Read-only, intentionally limited to the verified v11 format, Zlib and plain entries.
export class Pak {
  constructor(path) {
    this.fd = fs.openSync(path, 'r'); this.size = fs.fstatSync(this.fd).size;
    try {
      const footer = this.read(this.size - 221, 221), r = new Reader(footer);
      const keyGuid = r.bytes(16).toString('hex'), encrypted = r.u8();
      if (r.u32() !== 0x5a6f12e1) throw new Error('Invalid PAK magic/footer');
      const version = r.i32(); if (version !== 11) throw new Error(`Unsupported PAK version ${version}`);
      const indexOffset = r.u64(), indexSize = r.u64(), indexHash = r.bytes(20).toString('hex');
      const methods = Array.from({ length: 5 }, () => r.bytes(32).toString('ascii').replace(/\0.*$/, ''));
      if (encrypted || !/^0+$/.test(keyGuid)) throw new Error('Encrypted PAK is unsupported');
      if (methods[0] !== 'Zlib' || methods.slice(1).some(Boolean)) throw new Error('Unsupported compression method table');
      const index = this.checked(indexOffset, indexSize, indexHash), ir = new Reader(index);
      const mountPoint = ir.string(), entryCount = ir.count(), seed = ir.u64();
      if (ir.i32() !== 1) throw new Error('Missing path hash index');
      const pathOffset = ir.u64(), pathSize = ir.u64(), pathHash = ir.bytes(20).toString('hex');
      if (ir.i32() !== 1) throw new Error('Missing directory index');
      const directoryOffset = ir.u64(), directorySize = ir.u64(), directoryHash = ir.bytes(20).toString('hex');
      this.checked(pathOffset, pathSize, pathHash);
      const directory = this.checked(directoryOffset, directorySize, directoryHash);
      this.encoded = ir.bytes(ir.count(100000000));
      if (ir.i32() !== 0 || ir.position !== index.length) throw new Error('Unsupported legacy entries/index trailing bytes');
      const dr = new Reader(directory), directories = dr.count(); this.files = new Map();
      for (let i = 0; i < directories; i++) {
        const parent = dr.string(), count = dr.count();
        for (let j = 0; j < count; j++) {
          const name = parent + dr.string(), offset = dr.i32();
          if (this.files.has(name) || offset < 0 || offset >= this.encoded.length) throw new Error(`Duplicate/invalid directory entry ${name}`);
          this.files.set(name, offset);
        }
      }
      if (dr.position !== directory.length || this.files.size !== entryCount) throw new Error('Directory size/count mismatch');
      const compressionCounts = {};
      for (const name of this.files.keys()) { const e = this.entry(name); const k = e.method ? 'zlib' : 'plain'; compressionCounts[k] = (compressionCounts[k] || 0) + 1; }
      this.info = { size: this.size, version, mountPoint, entryCount, directories, seed, encrypted: false, methods, compressionCounts, indexOffset, indexSize, indexHash, pathHash, directoryHash, indexHashesVerified: true };
      this.resources = new Map();
    } catch (e) { this.close(); throw e; }
  }
  close() { if (this.fd !== undefined) { fs.closeSync(this.fd); this.fd = undefined; } }
  read(offset, length) {
    if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length < 0 || offset + length > this.size || length > 256 * 1024 * 1024) throw new Error(`Illegal PAK offset/length ${offset}/${length}`);
    const b = Buffer.alloc(length); if (fs.readSync(this.fd, b, 0, length, offset) !== length) throw new Error('Truncated PAK'); return b;
  }
  checked(offset, length, expected) { const b = this.read(offset, length); if (digest(b, 'sha1') !== expected) throw new Error('PAK index hash mismatch'); return b; }
  entry(name) {
    const pos = this.files.get(name); if (pos === undefined) throw new Error(`Missing PAK resource ${name}`);
    const r = new Reader(this.encoded, pos), bits = r.u32();
    const blockSize = (bits & 63) === 63 ? r.u32() : (bits & 63) << 11;
    const method = (bits >>> 23) & 63;
    const offset = bits >>> 31 ? r.u32() : r.u64();
    const size = (bits >>> 30) & 1 ? r.u32() : r.u64();
    const compressedSize = method ? ((bits >>> 29) & 1 ? r.u32() : r.u64()) : size;
    const encrypted = !!(bits & (1 << 22)), blocks = (bits >>> 6) & 65535;
    if (encrypted || method > 1 || (method === 0 && blocks !== 0) || (method && !blocks)) throw new Error(`Unsupported entry ${name}`);
    const headerSize = 53 + (method ? 4 + 16 * blocks : 0);
    const lengths = blocks === 1 ? [compressedSize] : Array.from({ length: blocks }, () => r.u32());
    if (method && lengths.reduce((a, b) => a + b, 0) !== compressedSize) throw new Error('Compression block sum mismatch');
    if (offset < 0 || offset + headerSize + compressedSize > this.size) throw new Error(`Illegal entry bounds ${name}`);
    return { offset, size, compressedSize, method, encrypted, blocks, blockSize, headerSize, lengths };
  }
  extract(name) {
    const e = this.entry(name);
    if (e.size > 256 * 1024 * 1024) throw new Error(`Resource exceeds extraction memory limit ${name}`);
    const h = new Reader(this.read(e.offset, e.headerSize));
    if (h.u64() !== 0 || h.u64() !== e.compressedSize || h.u64() !== e.size || h.u32() !== e.method) throw new Error(`Entry header mismatch ${name}`);
    const expected = h.bytes(20).toString('hex');
    if (e.method) {
      if (h.i32() !== e.blocks) throw new Error('Header block count mismatch');
      let next = e.headerSize;
      for (const n of e.lengths) { if (h.u64() !== next || h.u64() !== next + n) throw new Error('Header block offset mismatch'); next += n; }
    }
    if (h.u8() !== 0) throw new Error('Unexpected entry flags');
    const diskBlockSize = h.u32(); if (h.position !== h.limit || (e.method && diskBlockSize !== e.blockSize && e.blocks > 1)) throw new Error('Entry header layout mismatch');
    const compressed = this.read(e.offset + e.headerSize, e.compressedSize);
    if (digest(compressed, 'sha1') !== expected) throw new Error(`Payload hash mismatch ${name}`);
    let out = compressed;
    if (e.method) {
      let pos = 0; out = Buffer.concat(e.lengths.map((n, i) => {
        const result = zlib.inflateSync(compressed.subarray(pos, pos + n), { maxOutputLength: e.blocks === 1 ? e.size : e.blockSize }); pos += n;
        const expectedLength = i === e.blocks - 1 ? e.size - (e.blocks - 1) * e.blockSize : e.blockSize;
        if (result.length !== expectedLength) throw new Error('Decompressed block length mismatch'); return result;
      }));
    }
    if (out.length !== e.size) throw new Error('Decompressed size mismatch');
    this.resources.set(name, { path: name, ...e, payloadSha1: expected, payloadSha1Verified: true, sha256: digest(out) }); return out;
  }
}
