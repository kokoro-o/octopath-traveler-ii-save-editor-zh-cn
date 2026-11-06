import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

// Exact bytes of the original upstream public Steam fixture, not a personal save.
const publicFixtures = new Map([
  ['tests/saves/octopath-traveler-ii/steam/SaveData0.sav', 'b9d594c4275bb53ab2196d5f6875a2bcaedeb8147b3c8cd34f28692ba271c83e'],
]);
const git = args => execFileSync('git', args, { maxBuffer: 32 * 1024 * 1024 });
const staged = process.argv.includes('--staged');
const tracked = new Map(git(['ls-files', '--stage', '-z']).toString().split('\0').filter(Boolean).map(row => {
  const [meta, file] = row.split('\t');
  const [mode, hash, stage] = meta.split(' ');
  if (stage !== '0') throw new Error('Resolve merge conflicts before publication.');
  return [file, { mode, hash }];
}));
const files = [...new Set(git(['ls-files', '--cached', ...(staged ? [] : ['--others', '--exclude-standard']), '-z']).toString().split('\0').filter(Boolean))].sort();
const errors = [], manifest = [];
let fixtureCount = 0;
for (const file of files) {
  if (!staged && !fs.existsSync(file)) continue;
  if (publicFixtures.has(file)) {
    const bytes = staged ? git(['show', `:${file}`]) : fs.readFileSync(file);
    if (createHash('sha256').update(bytes).digest('hex') !== publicFixtures.get(file)) errors.push(`${file}: upstream save fixture changed`);
    fixtureCount++;
    manifest.push(file);
    continue;
  }
  const name = path.basename(file);
  const blocked = /(^|\/)(\.local|\.git|node_modules|build|qa-input|test-results|playwright-report)(\/|$)/.test(file)
    || (name.startsWith('.env') && name !== '.env.example')
    || /\.(sav|srm|sra|pak|nsp|xci|nacp|uasset|uexp|pem|key|p12|pfx|log)$/i.test(file)
    || /^MJSaveData/i.test(name) || /\.edited(?:\.|$)/i.test(name)
    || file.startsWith('tests/saves/') || /\.report\.json$/.test(file)
    || /^scripts\/tests\/.*\.playwright\.config\.mjs$/.test(file);
  if (blocked) { errors.push(`${file}: excluded from publication`); continue; }
  if (tracked.get(file)?.mode === '120000' || (!staged && fs.lstatSync(file).isSymbolicLink())) { errors.push(`${file}: unexpected symbolic link`); continue; }
  const bytes = staged ? git(['show', `:${file}`]) : fs.readFileSync(file);
  if (bytes.length > 50 * 1024 * 1024) { errors.push(`${file}: unexpectedly large file`); continue; }
  if (!bytes.includes(0)) {
    const value = bytes.toString('utf8');
    if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bgh[pousr]_[A-Za-z0-9]{30,}|\bgithub_pat_[A-Za-z0-9_]{30,}|\bAKIA[A-Z0-9]{16}\b/.test(value)) errors.push(`${file}: possible credential (value omitted)`);
    if (/\/(?:Users|home)\/[A-Za-z0-9._-]+\//.test(value)) errors.push(`${file}: personal absolute path`);
  }
  manifest.push(file);
}
if (!manifest.includes('LICENSE.md')) errors.push('LICENSE.md: upstream license is required');
if (errors.length) {
  console.error(`Publication audit failed (${errors.length}):\n${errors.join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(`Publication audit passed: ${manifest.length} files; ${fixtureCount} unchanged upstream public fixtures, ${manifest.length - fixtureCount} source/assets/configuration files.`);
  console.log('This is a path/credential check, not a grant of rights to third-party game text or images.');
  if (process.argv.includes('--manifest')) {
    fs.mkdirSync('.local', { recursive: true });
    fs.writeFileSync('.local/publication-files.txt', `${manifest.join('\n')}\n`);
    console.log('Review list: .local/publication-files.txt (local only).');
  }
}
