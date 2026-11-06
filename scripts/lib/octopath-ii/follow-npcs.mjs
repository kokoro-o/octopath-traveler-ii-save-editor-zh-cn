import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Pak, digest, hashFile } from './pak.mjs';
import { enumMap, table } from './uasset.mjs';
import { describeFollowSkill } from './follow-skill-description.mjs';

export const FOLLOW_TABLES = {
  NPCData: 'Character/Database/NPCData', NPCLeadData: 'Character/Database/NPCLeadData',
  SupportCharacterDB: 'Character/Database/SupportCharacterDB', AbilityData: 'Ability/Database/AbilityData',
  GameTextZH_CN: 'GameText/Database/GameTextZH_CN',
  AilmentData: 'Ability/Database/AilmentData', DiseaseData: 'Ability/Database/DiseaseData',
};
// Numeric MJFieldCommandType values verified in the original NSO's native
// FEnumeratorParam pairs, not FieldCommandData.ID (which differs).
export const FOLLOW_OWNERS = {
  2: { characterId: 2, name: '欧修缇', fieldCommandType: 16, commandName: '收服' },
  4: { characterId: 4, name: '帕特提欧', fieldCommandType: 7, commandName: '雇佣' },
  5: { characterId: 5, name: '提米诺斯', fieldCommandType: 10, commandName: '引导' },
  8: { characterId: 8, name: '爱格妮娅', fieldCommandType: 5, commandName: '诱惑' },
};
const i32 = (value, context) => { assert.ok(Number.isInteger(value) && value >= -2147483648 && value <= 2147483647, `Invalid Int32: ${context}`); return value; };

export function buildFollowNpcs(tables) {
  const rows = key => tables[key].rows;
  const texts = rows('GameTextZH_CN'), leads = rows('NPCLeadData'), supporters = rows('SupportCharacterDB');
  const text = ref => typeof texts[ref]?.Text?.value === 'string' ? texts[ref].Text.value : '';
  const regions = Object.keys(texts).filter(k => /^(Twn|Fld|Dng)_/.test(k) && text(k)).sort((a, b) => b.length - a.length || a.localeCompare(b));
  const grouped = new Map(), excluded = [], unresolvedSkills = [];
  for (const [rowName, npc] of Object.entries(rows('NPCData')).sort(([a], [b]) => a.localeCompare(b))) {
    if (npc.FCmd_Lure_ID === 'None') continue;
    const lead = leads[npc.FCmd_Lure_ID];
    if (!lead) { excluded.push({ rowName, reason: 'missing-lead-reference', reference: npc.FCmd_Lure_ID }); continue; }
    const supporter = supporters[lead.SupporterID];
    if (!supporter) { excluded.push({ rowName, reason: 'no-resolved-supporter', reference: lead.SupporterID }); continue; }
    const name = text(npc.TextLabel);
    if (!name.trim()) { excluded.push({ rowName, npcUniqueId: npc.NPC_UnqIndex, reason: 'unnamed-npc', nameRef: npc.TextLabel }); continue; }
    const npcUniqueId = i32(npc.NPC_UnqIndex, `${rowName}.NPC_UnqIndex`);
    assert.ok(npcUniqueId > 0, `Invalid NPC unique ID: ${rowName}`);
    const mapLabel = rowName.replace(/^NPC_/, '');
    const region = regions.find(k => mapLabel === k || mapLabel.startsWith(`${k}_`));
    const town = region ? text(region) : `区域标签：${rowName}`;
    const skills = [];
    for (const command of supporter.CommandTable) {
      if (command.CommandName === 'None') continue;
      const skill = describeFollowSkill(command.CommandName, tables);
      if (skill) skills.push(skill);
      else unresolvedSkills.push({ rowName, abilityRef: command.CommandName });
    }
    const rank = i32(supporter.DisplayRank, `${rowName}.DisplayRank`);
    assert.ok(rank >= 0 && rank <= 10, `Invalid support rank: ${rowName}`);
    const variant = { rowName, name, town, townRef: region ?? null, nameRef: npc.TextLabel,
      leadRef: npc.FCmd_Lure_ID, supporterRef: lead.SupporterID,
      rank: rank === 0 ? null : rank, skills,
      defaultSupportLimit: i32(supporter.SupportLimit, `${rowName}.SupportLimit`),
      unlimited: supporter.IsUnlimitedSupporter, skillNames: [...new Set(skills.map(skill => skill.name))] };
    assert.equal(typeof variant.unlimited, 'boolean', `Invalid unlimited flag: ${rowName}`);
    if (!grouped.has(npcUniqueId)) grouped.set(npcUniqueId, []);
    grouped.get(npcUniqueId).push(variant);
  }
  const followNpcs = {}, sources = {}, ambiguousDefaults = [], ambiguousRanks = [];
  for (const [npcUniqueId, variants] of [...grouped].sort(([a], [b]) => a - b)) {
    const limits = [...new Set(variants.map(v => v.defaultSupportLimit))];
    if (limits.length > 1) ambiguousDefaults.push({ npcUniqueId, values: limits });
    const ranks = [...new Set(variants.map(v => v.rank))];
    if (ranks.length > 1) ambiguousRanks.push({ npcUniqueId, values: ranks });
    const skills = [...new Map(variants.flatMap(v => v.skills).map(skill => [skill.abilityRef, skill])).values()];
    followNpcs[npcUniqueId] = { npcUniqueId, name: [...new Set(variants.map(v => v.name))].join(' / '),
      town: [...new Set(variants.map(v => v.town))].join(' / '),
      defaultSupportLimit: limits.length === 1 ? limits[0] : null,
      rank: ranks.length === 1 ? ranks[0] : null, skills,
      skillDesc: skills.map(skill => `${skill.name}：\n${skill.description}`).join('\n\n'),
      skillNames: [...new Set(variants.flatMap(v => v.skillNames))], unlimited: variants.every(v => v.unlimited) };
    sources[npcUniqueId] = variants;
  }
  return { followNpcs, owners: FOLLOW_OWNERS, report: {
    counts: { entries: grouped.size, namedSourceRows: [...grouped.values()].reduce((n, a) => n + a.length, 0),
      mergedAliasGroups: [...grouped.values()].filter(a => a.length > 1).length, excludedRows: excluded.length, unresolvedSkills: unresolvedSkills.length },
    idRule: 'NPCData.NPC_UnqIndex, not NPCData.ID or SupportCharacterDB.SupporterID',
    locationRule: 'Longest exact map-text label prefix; unmatched rows retain an explicit source-region label',
    aliases: 'Same unique ID merged without silently overwriting variants. Conflicting default limits become null.',
    fieldCommandEvidence: { source: 'Original NSO FEnumeratorParam pairs',
      enumValues: { eLead: 10, eLure: 5, eHire: 7, ePlacate: 16 },
      registrationAddresses: { eLead: '0x6317920', eLure: '0x63178d0', eHire: '0x63178f0', ePlacate: '0x6317980' } },
    rankField: 'SupportCharacterDB.DisplayRank; 0 means unspecified; alias conflicts remain null',
    skillDescriptionRule: 'Explicit AbilityData.Detail -> GameTextZH_CN when available; otherwise labelled database summaries with official DiseaseData.Detail status text. Never substitute same-name guest/learned abilities. Sequence-driven hit counts and special mechanics are not inferred.',
    sources, excluded, unresolvedSkills, ambiguousDefaults, ambiguousRanks, runtimeGameVerified: false,
  } };
}

export async function exportFollowNpcs({ pakPath, controlPath, outputDir, project }) {
  const baseline = JSON.parse(fs.readFileSync(path.join(project, 'scripts/tests/fixtures/octopath-ii-stage-a-baseline.json')));
  const pakSha256 = await hashFile(pakPath), control = fs.readFileSync(controlPath);
  assert.equal(pakSha256, baseline.pakSha256, 'Unexpected source PAK');
  const gameVersion = control.subarray(0x3060, 0x3070).toString().replace(/\0.*$/, '');
  assert.equal(gameVersion, baseline.gameVersion, 'Unexpected source version');
  const pak = new Pak(pakPath), tables = {};
  let result;
  try {
    for (const [key, resource] of Object.entries(FOLLOW_TABLES)) tables[key] = table(pak, `Majesty/Content/${resource}`);
    const targets = enumMap(pak, 'Majesty/Content/Ability/BP/Enum/EAILMENT_TARGET_TYPE_OLD');
    tables.followEffectTargets = Object.fromEntries(targets.mappings.map(([key, value]) => [key, value.value]));
    result = buildFollowNpcs(tables);
    result.report.source = { platform: 'Switch', gameVersion, pakSha256, controlSha256: digest(control),
      resources: [...pak.resources.values()].sort((a, b) => a.path.localeCompare(b.path)) };
  } finally { pak.close(); }
  assert.equal(await hashFile(pakPath), pakSha256, 'PAK changed during read-only extraction');
  const files = { 'followNpcs.json': result.followNpcs, 'followNpcOwners.json': result.owners, 'followNpcs.report.json': result.report };
  const bodies = Object.fromEntries(Object.entries(files).map(([name, value]) => [name, `${JSON.stringify(value, null, 2)}\n`]));
  for (const [name, body] of Object.entries(bodies)) if (fs.existsSync(path.join(outputDir, name))) assert.equal(fs.readFileSync(path.join(outputDir, name), 'utf8'), body, `Refusing to overwrite differing export: ${name}`);
  fs.mkdirSync(outputDir, { recursive: true });
  for (const [name, body] of Object.entries(bodies)) if (!fs.existsSync(path.join(outputDir, name))) fs.writeFileSync(path.join(outputDir, name), body, { flag: 'wx' });
  return { ...result.report.counts, gameVersion, sourceUnchanged: true,
    files: Object.fromEntries(Object.entries(bodies).map(([name, body]) => [name, { bytes: Buffer.byteLength(body), sha256: digest(Buffer.from(body)) }])) };
}
