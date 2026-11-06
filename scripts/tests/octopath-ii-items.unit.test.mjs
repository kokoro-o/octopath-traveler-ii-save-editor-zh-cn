import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Reader, Pak, digest } from '../lib/octopath-ii/pak.mjs';
import { properties, text, summary } from '../lib/octopath-ii/uasset.mjs';
import { inventoryFromSource, requireReference, canonicalHash, originalField } from '../lib/octopath-ii/extract-and-validate.mjs';

const i32 = n => { const b = Buffer.alloc(4); b.writeInt32LE(n); return b; };
const u64 = n => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(n)); return b; };
const string = (s, wide = false) => Buffer.concat([i32(wide ? -(s.length + 1) : Buffer.byteLength(s) + 1), Buffer.from(s + '\0', wide ? 'utf16le' : 'utf8')]);
function fixture() {
  const names = ['None'];
  const fn = s => { if (!names.includes(s)) names.push(s); return Buffer.concat([i32(names.indexOf(s)), i32(0)]); };
  const prop = (key, type, value, meta = Buffer.alloc(0)) => Buffer.concat([fn(key), fn(type), i32(value.length), i32(0), meta, Buffer.from([0]), value]);
  const parse = b => properties(new Reader(Buffer.concat([b, fn('None')])), names);
  return { names, fn, prop, parse };
}
test('Reader rejects negative, truncated and unsafe reads', () => {
  assert.throws(() => new Reader(Buffer.alloc(4)).bytes(-1));
  assert.throws(() => new Reader(Buffer.alloc(3)).i32());
  assert.throws(() => new Reader(Buffer.from('ffffffffffffffff', 'hex')).u64());
});
test('FString retains UTF-16 Chinese and empty strings', () => {
  assert.equal(new Reader(string('帽盔', true)).string(), '帽盔'); assert.equal(new Reader(i32(0)).string(), '');
});
test('FString rejects invalid length, encoding and terminator', () => {
  assert.throws(() => new Reader(i32(1000001)).string());
  assert.throws(() => new Reader(Buffer.concat([i32(2), Buffer.from([255,0])])).string());
  assert.throws(() => new Reader(Buffer.concat([i32(1), Buffer.from([1])])).string());
});
test('FText keeps original newline, namespace and stable key', () => {
  const v = text(new Reader(Buffer.concat([i32(0), Buffer.from([0]), string('GameTextZH_CN'), string('KEY'), string('第一行\n第二行', true)])));
  assert.deepEqual(v, { flags:0, history:0, namespace:'GameTextZH_CN', key:'KEY', value:'第一行\n第二行' });
});
test('FText distinguishes empty history and unsupported histories', () => {
  assert.equal(text(new Reader(Buffer.concat([i32(0),Buffer.from([255]),i32(0)]))).value, '');
  assert.throws(() => text(new Reader(Buffer.concat([i32(0),Buffer.from([3])]))));
});
test('integer properties retain signed values, zeros, types and order', () => {
  const f=fixture(), p=f.parse(Buffer.concat([f.prop('HP','IntProperty',i32(0)),f.prop('EVA','IntProperty',i32(-94))]));
  assert.deepEqual(p.value,{HP:0,EVA:-94}); assert.deepEqual(p.layout.map(x=>[x.name,x.type]),[['HP','IntProperty'],['EVA','IntProperty']]);
  assert.equal(p.layout[0].payloadSha256,digest(i32(0)));
});
test('nested CharacterParam retains all 13 zero and signed fields', () => {
  const f=fixture(), keys=['HP','MP','BP','SP','POT','ATK','DEF','MATK','MDEF','ACC','EVA','CON','AGI'];
  const body=Buffer.concat([...keys.map(k=>f.prop(k,'IntProperty',i32(k==='CON'?-58:0))),f.fn('None')]);
  const p=f.parse(f.prop('EquipmentRevision','StructProperty',body,Buffer.concat([f.fn('CharacterParam'),Buffer.alloc(16)])));
  assert.deepEqual(Object.keys(p.value.EquipmentRevision),keys);assert.equal(p.value.EquipmentRevision.CON,-58);assert.equal(p.layout[0].children.length,13);
});
test('primitive arrays retain length and element order', () => {
  const f=fixture(), p=f.parse(f.prop('Values','ArrayProperty',Buffer.concat([i32(3),i32(0),i32(-2),i32(9)]),f.fn('IntProperty')));
  assert.deepEqual(p.value.Values,[0,-2,9]);assert.equal(p.layout[0].metadata.count,3);
});
test('enum and bool arrays keep zeros and ordering', () => {
  const f=fixture(); const p=f.parse(Buffer.concat([
    f.prop('Resistance','ArrayProperty',Buffer.concat([i32(2),f.fn('eNONE'),f.fn('eHALF')]),f.fn('EnumProperty')),
    f.prop('Disease','ArrayProperty',Buffer.from([3,0,0,0,0,1,0]),f.fn('BoolProperty'))]));
  assert.deepEqual(p.value,{Resistance:['eNONE','eHALF'],Disease:[false,true,false]});
});
test('struct array preserves inactive slots and original element order', () => {
  const f=fixture(), elements=['A','None'].map(s=>Buffer.concat([f.prop('AilmentName','NameProperty',f.fn(s)),f.fn('None')]));
  const tag=Buffer.concat([f.fn('Effects'),f.fn('StructProperty'),i32(0),i32(0),f.fn('AilmentHandler'),Buffer.alloc(16),Buffer.from([0])]);
  const p=f.parse(f.prop('Effects','ArrayProperty',Buffer.concat([i32(2),tag,...elements]),f.fn('StructProperty')));
  assert.deepEqual(p.value.Effects,[{AilmentName:'A'},{AilmentName:'None'}]);assert.equal(p.layout[0].children.length,2);
});
test('unknown property type is fatal', () => {
  const f=fixture();assert.throws(()=>f.parse(f.prop('X','MysteryProperty',Buffer.alloc(0))),/Unknown property type/);
});
test('property size mismatch and truncated property are fatal', () => {
  const f=fixture();assert.throws(()=>f.parse(f.prop('X','IntProperty',Buffer.alloc(8))),/boundary mismatch/);
  assert.throws(()=>f.parse(f.prop('X','IntProperty',Buffer.alloc(2))),/Truncated/);
});
test('duplicate properties are fatal',()=>{const f=fixture();assert.throws(()=>f.parse(Buffer.concat([f.prop('X','IntProperty',i32(1)),f.prop('X','IntProperty',i32(2))])),/Duplicate property/)});
test('invalid array count and invalid FName are fatal',()=>{
  const f=fixture();assert.throws(()=>f.parse(f.prop('X','ArrayProperty',i32(-1),f.fn('IntProperty'))));
  assert.throws(()=>properties(new Reader(Buffer.concat([i32(999),i32(0)])),['None']),/Invalid FName/);
});
test('invalid asset headers are rejected',()=>assert.throws(()=>summary(Buffer.alloc(221)),/header/));
test('static inventory reader does not execute source and rejects duplicate IDs',()=>{
  const src='export const inventory = [{index:0x770,type:0,name:"Grape"}]; throw new Error("must not execute");';
  assert.deepEqual(inventoryFromSource(src),[{id:1904,editorCategory:0,editorName:'Grape'}]);
  assert.throws(()=>inventoryFromSource('export const inventory=[{index:1,type:0,name:"A"},{index:1,type:0,name:"B"}]'),/Duplicate inventory ID/);
  assert.throws(()=>inventoryFromSource('export const inventory = getInventory()'),/static array/);
});
test('missing required reference fails; None and empty text are not missing',()=>{
  assert.throws(()=>requireReference({},'MISSING','test'),/Missing reference/); assert.equal(requireReference({},'None','test'),null);
  assert.deepEqual(requireReference({EMPTY:{Text:{value:''}}},'EMPTY','test'),{Text:{value:''}});
});
test('normalization sorts object keys but never array order',()=>{
  assert.equal(canonicalHash({b:1,a:2}),canonicalHash({a:2,b:1}));assert.notEqual(canonicalHash([1,2]),canonicalHash([2,1]));
});
test('GUID-suffixed source fields resolve without renaming raw keys or accepting ambiguity',()=>{
  const key='DiseaseName_8_75475DD04B3C5EEC50F1BE921DE759E3',raw={[key]:'POISON'};
  assert.equal(originalField(raw,'DiseaseName'),'POISON');assert.deepEqual(Object.keys(raw),[key]);
  assert.throws(()=>originalField({...raw,DiseaseName:'None'},'DiseaseName'),/ambiguous/);
  assert.throws(()=>originalField({},'DiseaseName'),/Missing/);
});
const tempBase=path.resolve('.local/ot2-stage-a/session-001/unit-fixtures');
test('PAK rejects wrong footer, corrupted index hash, and truncated file',()=>{
  fs.mkdirSync(tempBase,{recursive:true});const temp=fs.mkdtempSync(path.join(tempBase,'pak-'));
  const bad=path.join(temp,'bad.pak');fs.writeFileSync(bad,Buffer.alloc(221));assert.throws(()=>new Pak(bad),/magic/);
  const footer=Buffer.alloc(221);footer.writeUInt32LE(0x5a6f12e1,17);footer.writeInt32LE(11,21);footer.writeBigUInt64LE(0n,25);footer.writeBigUInt64LE(4n,33);footer.write('Zlib',61);
  fs.writeFileSync(bad,Buffer.concat([Buffer.alloc(4),footer]));assert.throws(()=>new Pak(bad),/index hash mismatch/);
  fs.writeFileSync(bad,Buffer.alloc(3));assert.throws(()=>new Pak(bad),/Illegal PAK offset/);
});
test('PAK refuses illegal offsets before allocating buffers',()=>{
  const p=Object.create(Pak.prototype);p.size=100;assert.throws(()=>p.read(-1,4),/Illegal/);assert.throws(()=>p.read(99,2),/Illegal/);
  assert.throws(()=>p.read(0,Number.MAX_SAFE_INTEGER),/Illegal/);
});
test('PAK directory offsets outside encoded entries fail',()=>{
  const p=Object.create(Pak.prototype);p.size=100;p.files=new Map([['x',0]]);p.encoded=Buffer.concat([Buffer.from([0,0,0,192]),i32(999),i32(1)]);
  assert.throws(()=>p.entry('x'),/Illegal entry bounds/);assert.throws(()=>p.entry('missing'),/Missing PAK resource/);
});
test('baseline is explicitly prior-sample evidence with 24 unique samples and 9 ambiguities',()=>{
  const b=JSON.parse(fs.readFileSync(new URL('./fixtures/octopath-ii-stage-a-baseline.json',import.meta.url)));
  assert.equal(b.samples.length,24);assert.equal(new Set(b.samples.map(s=>s.id)).size,24);assert.equal(b.ambiguities.length,9);
  assert.match(b.provenance,/Manually transcribed/);assert.equal(b.classificationDifference.id,11159);
  assert.equal(b.samples.find(s=>s.id===302).nameRef,'TX_NA_ITM_TRE_SIN_10_1300_BIBLE');
  assert.equal(b.samples.find(s=>s.id===10596).nameRef,'TX_NA_INFO_Twn_Dst_3_1_A_04');
});
