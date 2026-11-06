import { Reader, digest } from './pak.mjs';

export function name(r, names) {
  const index = r.i32(), number = r.i32();
  if (index < 0 || index >= names.length || number < 0) throw new Error(`Invalid FName ${index}/${number}`);
  return names[index] + (number ? `_${number - 1}` : '');
}
export function text(r) {
  const flags = r.u32(), history = r.u8();
  if (history === 0) return { flags, history, namespace: r.string(), key: r.string(), value: r.string() };
  if (history === 255) { const hasString = r.i32(); if (hasString !== 0 && hasString !== 1) throw new Error('Invalid invariant FText flag'); return { flags, history, value: hasString ? r.string() : '' }; }
  throw new Error(`Unknown FText history ${history}`);
}
export function summary(b) {
  const r = new Reader(b);
  if (r.u32() !== 0x9e2a83c1 || r.i32() !== -7) throw new Error('Unsupported package header');
  const legacyUE3 = r.i32(), ue4 = r.i32(), license = r.i32(), customCount = r.count(1000);
  const customVersions = r.bytes(customCount * 20).toString('hex');
  const headerSize = r.i32(), folder = r.string(), flags = r.u32();
  const nameCount = r.count(), nameOffset = r.i32(), gatherCount = r.i32(), gatherOffset = r.i32();
  const exportCount = r.count(), exportOffset = r.i32(), importCount = r.count(), importOffset = r.i32();
  if (headerSize !== b.length || (flags & 0x2000) || nameOffset < r.position || nameOffset >= b.length || importOffset < nameOffset || exportOffset < importOffset) throw new Error('Unsupported/invalid asset layout');
  const nr = new Reader(b, nameOffset, importOffset), names = [];
  for (let i = 0; i < nameCount; i++) { names.push(nr.string()); nr.bytes(4); }
  if (nr.position !== importOffset) throw new Error('Name table boundary mismatch');
  const ir = new Reader(b, importOffset, exportOffset), imports = [];
  for (let i = 0; i < importCount; i++) imports.push({ package: name(ir, names), type: name(ir, names), outer: ir.i32(), name: name(ir, names) });
  if (ir.position !== exportOffset) throw new Error('Import boundary mismatch');
  return { legacyUE3, ue4, license, customVersions, headerSize, folder, flags, nameCount, nameOffset, gatherCount, gatherOffset, exportCount, exportOffset, importCount, importOffset, names, imports };
}

// UE4 native math structs serialize their components directly, without nested
// property tags or a None terminator. Keep every float and its original order.
const nativeStructFields = {
  Vector: ['x', 'y', 'z'],
  Vector2D: ['x', 'y'],
  Rotator: ['pitch', 'yaw', 'roll'],
  LinearColor: ['r', 'g', 'b', 'a'],
};
function structValue(r, names, type, depth) {
  if (Object.hasOwn(nativeStructFields, type)) {
    return { value: Object.fromEntries(nativeStructFields[type].map(key => [key, r.f32()])) };
  }
  // Unknown structs still use the strict tagged parser; never silently skip
  // data or guess a native binary layout from its byte length.
  return properties(r, names, depth + 1);
}

export function properties(r, names, depth = 0) {
  if (depth > 40) throw new Error('Property nesting too deep');
  const value = {}, layout = [];
  while (true) {
    const offset = r.position, propertyName = name(r, names); if (propertyName === 'None') return { value, layout, end: r.position };
    const type = name(r, names), size = r.i32(), arrayIndex = r.i32(), metadata = {};
    if (size < 0 || arrayIndex < 0) throw new Error('Invalid property size/index');
    if (type === 'StructProperty') { metadata.struct = name(r, names); metadata.structGuid = r.bytes(16).toString('hex'); }
    else if (type === 'BoolProperty') { const b = r.u8(); if (b > 1) throw new Error('Invalid bool'); metadata.bool = !!b; }
    else if (type === 'EnumProperty' || type === 'ByteProperty') metadata.enum = name(r, names);
    else if (type === 'ArrayProperty') metadata.inner = name(r, names);
    else if (type === 'MapProperty') { metadata.key = name(r, names); metadata.value = name(r, names); }
    const hasGuid = r.u8(); if (hasGuid > 1) throw new Error('Invalid property GUID flag');
    if (hasGuid) metadata.propertyGuid = r.bytes(16).toString('hex');
    const payloadOffset = r.position, end = payloadOffset + size;
    if (end > r.limit) throw new Error(`Truncated property ${propertyName}`);
    const oldLimit = r.limit; r.limit = end;
    let parsed, children;
    const scalar = (kind) => {
      if (kind === 'IntProperty' || kind === 'ObjectProperty') return r.i32();
      if (kind === 'FloatProperty') return r.f32();
      if (kind === 'NameProperty' || kind === 'EnumProperty') return name(r, names);
      if (kind === 'BoolProperty') { const b = r.u8(); if (b > 1) throw new Error('Invalid array bool'); return !!b; }
      if (kind === 'StrProperty') return r.string();
      if (kind === 'TextProperty') return text(r);
      throw new Error(`Unknown property type ${kind} at ${offset}`);
    };
    if (type === 'BoolProperty') parsed = metadata.bool;
    else if (type === 'ByteProperty') parsed = size === 8 ? name(r, names) : r.u8();
    else if (type === 'StructProperty') { const p = structValue(r, names, metadata.struct, depth); parsed = p.value; children = p.layout; }
    else if (type === 'SoftObjectProperty') parsed = { assetPath: name(r, names), subPath: r.string() };
    else if (type === 'ArrayProperty') {
      const count = r.count(); metadata.count = count;
      if (metadata.inner === 'StructProperty') {
        metadata.elementTag = { name: name(r, names), type: name(r, names), size: r.i32(), arrayIndex: r.i32(), struct: name(r, names), guid: r.bytes(16).toString('hex') };
        const g = r.u8(); if (g > 1) throw new Error('Invalid array struct GUID flag'); if (g) metadata.elementTag.propertyGuid = r.bytes(16).toString('hex');
        if (metadata.elementTag.type !== 'StructProperty') throw new Error('Invalid struct array tag');
        parsed = []; children = [];
        for (let i = 0; i < count; i++) { const p = structValue(r, names, metadata.elementTag.struct, depth); parsed.push(p.value); children.push(p.layout ?? []); }
      } else parsed = Array.from({ length: count }, () => scalar(metadata.inner));
    } else if (type === 'MapProperty') {
      if (r.count() !== 0) throw new Error('Map removals unsupported');
      const count = r.count(); metadata.count = count; parsed = [];
      for (let i = 0; i < count; i++) parsed.push([scalar(metadata.key), scalar(metadata.value)]);
    } else parsed = scalar(type);
    if (r.position !== end) throw new Error(`Property boundary mismatch ${propertyName}: ${r.position}/${end}`);
    r.limit = oldLimit;
    const key = arrayIndex ? `${propertyName}[${arrayIndex}]` : propertyName;
    if (Object.hasOwn(value, key)) throw new Error(`Duplicate property ${key}`);
    value[key] = parsed;
    layout.push({ name: propertyName, type, arrayIndex, offset, payloadOffset, size, end, metadata, payloadSha256: digest(r.buffer.subarray(payloadOffset, end)), ...(children ? { children } : {}) });
  }
}

export function table(pak, path) {
  const asset = pak.extract(`${path}.uasset`), exp = pak.extract(`${path}.uexp`), m = summary(asset);
  if (m.exportCount !== 1) throw new Error(`Expected one DataTable export: ${path}`);
  const ex = new Reader(asset, m.exportOffset); const classIndex = ex.i32();
  if (classIndex >= 0 || m.imports[-classIndex - 1]?.name !== 'DataTable') throw new Error('Not a DataTable class');
  ex.bytes(24); const serialSize = ex.u64(), serialOffset = ex.u64();
  if (serialOffset !== asset.length || serialSize !== exp.length - 4) throw new Error('Export serial bounds mismatch');
  const r = new Reader(exp, 0, exp.length - 4), top = properties(r, m.names);
  const rowStruct = m.imports[-top.value.RowStruct - 1];
  if (!['ScriptStruct','UserDefinedStruct'].includes(rowStruct?.type)) throw new Error(`Unknown row struct ${path}: ${JSON.stringify(rowStruct)}`);
  if (r.i32() !== 0) throw new Error('Unexpected object GUID');
  const count = r.count(), rows = {}, layouts = {};
  for (let i = 0; i < count; i++) {
    const row = name(r, m.names); if (Object.hasOwn(rows, row)) throw new Error(`Duplicate row ${row}`);
    const start = r.position, p = properties(r, m.names); rows[row] = p.value; layouts[row] = { offset: start, end: r.position, fields: p.layout };
  }
  if (r.position !== exp.length - 4 || exp.readUInt32LE(exp.length - 4) !== 0x9e2a83c1) throw new Error('DataTable trailing/boundary mismatch');
  return { path, rowCount: count, rowStruct, packageVersion: { ue4: m.ue4, license: m.license, flags: m.flags }, rows, layouts };
}

export function enumMap(pak, path) {
  const a = pak.extract(`${path}.uasset`), b = pak.extract(`${path}.uexp`), m = summary(a), r = new Reader(b), p = properties(r, m.names);
  if (!Array.isArray(p.value.DisplayNameMap)) throw new Error('Missing enum display map');
  if (m.exportCount !== 1 || r.i32() !== 0) throw new Error('Unsupported enum export');
  const count = r.count(), enumerators = Array.from({ length: count }, () => ({ name: name(r, m.names), value: r.u64() })), cppForm = r.u8();
  if (r.position !== b.length - 4 || b.readUInt32LE(r.position) !== 0x9e2a83c1) throw new Error('Enum tail/boundary mismatch');
  return { path, mappings: p.value.DisplayNameMap, enumerators, cppForm, layout: p.layout, interpretation: 'Original enum labels only; no numeric formula inferred.' };
}
