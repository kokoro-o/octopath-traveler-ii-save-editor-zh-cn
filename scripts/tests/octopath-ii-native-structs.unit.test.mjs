import test from 'node:test';
import assert from 'node:assert/strict';
import { Reader, digest } from '../lib/octopath-ii/pak.mjs';
import { properties } from '../lib/octopath-ii/uasset.mjs';

const i32 = n => { const b = Buffer.alloc(4); b.writeInt32LE(n); return b; };
const floats = values => { const b = Buffer.alloc(values.length * 4); values.forEach((v, i) => b.writeFloatLE(v, i * 4)); return b; };
function fixture() {
  const names = ['None'];
  const fn = name => {
    if (!names.includes(name)) names.push(name);
    return Buffer.concat([i32(names.indexOf(name)), i32(0)]);
  };
  const prop = (key, type, payload, metadata = Buffer.alloc(0)) => Buffer.concat([
    fn(key), fn(type), i32(payload.length), i32(0), metadata, Buffer.from([0]), payload,
  ]);
  const struct = (key, type, payload) => prop(key, 'StructProperty', payload, Buffer.concat([fn(type), Buffer.alloc(16)]));
  const parse = payload => properties(new Reader(Buffer.concat([payload, fn('None')])), names);
  return { fn, prop, struct, parse };
}

for (const [type, keys, values] of [
  ['Vector', ['x', 'y', 'z'], [-40, 0, 100.5]],
  ['Vector2D', ['x', 'y'], [0, -60]],
  ['Rotator', ['pitch', 'yaw', 'roll'], [-90, 0, 180]],
  ['LinearColor', ['r', 'g', 'b', 'a'], [0.5, 0, 1, 0.25]],
]) {
  test(`${type} reads raw components and preserves the next property boundary`, () => {
    const f = fixture(), raw = floats(values);
    const parsed = f.parse(Buffer.concat([f.struct('Offset', type, raw), f.prop('After', 'IntProperty', i32(123))]));
    assert.deepEqual(parsed.value, { Offset: Object.fromEntries(keys.map((k, i) => [k, values[i]])), After: 123 });
    assert.equal(parsed.layout[0].payloadSha256, digest(raw));
    assert.equal(parsed.layout[0].metadata.struct, type);
    assert.equal(parsed.layout[0].end, parsed.layout[1].offset);
  });
}

test('native Vector arrays preserve component and element order without consuming the next field', () => {
  const f = fixture();
  const tag = Buffer.concat([f.fn('Offsets'), f.fn('StructProperty'), i32(24), i32(0), f.fn('Vector'), Buffer.alloc(16), Buffer.from([0])]);
  const parsed = f.parse(Buffer.concat([
    f.prop('Offsets', 'ArrayProperty', Buffer.concat([i32(2), tag, floats([1, -2, 0, 4, 5, 6])]), f.fn('StructProperty')),
    f.prop('After', 'IntProperty', i32(-1)),
  ]));
  assert.deepEqual(parsed.value, { Offsets: [{ x: 1, y: -2, z: 0 }, { x: 4, y: 5, z: 6 }], After: -1 });
  assert.equal(parsed.layout[0].metadata.count, 2);
  assert.equal(parsed.layout[0].metadata.elementTag.struct, 'Vector');
});

test('tagged structs can contain native math structs alongside normal properties', () => {
  const f = fixture(), body = Buffer.concat([
    f.struct('Position', 'Vector2D', floats([12, 24])), f.prop('ID', 'IntProperty', i32(7)), f.fn('None'),
  ]);
  const parsed = f.parse(f.struct('Nested', 'CustomTaggedStruct', body));
  assert.deepEqual(parsed.value.Nested, { Position: { x: 12, y: 24 }, ID: 7 });
  assert.equal(parsed.layout[0].children.length, 2);
});

test('truncated and oversized native structs fail instead of skipping bytes', () => {
  for (const values of [[1, 2], [1, 2, 3, 4]]) {
    const f = fixture();
    assert.throws(() => f.parse(f.struct('Bad', 'Vector', floats(values))), /Truncated|boundary mismatch/);
  }
});

test('native struct components reject NaN and infinities', () => {
  for (const value of [NaN, Infinity, -Infinity]) {
    const f = fixture();
    assert.throws(() => f.parse(f.struct('Bad', 'Rotator', floats([0, value, 0]))), /Non-finite float/);
  }
});

test('unrecognized raw struct layouts remain fatal', () => {
  const f = fixture();
  assert.throws(() => f.parse(f.struct('Unknown', 'UnsupportedNativeStruct', floats([-40, 5, 100]))));
});
