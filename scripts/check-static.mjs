import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const base = process.env.BASE_PATH || '';
for (const route of ['', 'about/', 'faq/', 'octopath-traveler-ii/save-editor/']) {
  const file = `build/${route}index.html`;
  assert.ok(fs.existsSync(file), `Missing static entry: ${file}`);
  const html = fs.readFileSync(file, 'utf8');
  assert.ok(html.includes(`${base}/_app/`), `Wrong asset base: ${file}`);
}
assert.ok(fs.existsSync('build/.nojekyll'));
assert.ok(fs.existsSync('build/404.html'));
assert.ok(fs.existsSync('build/img/games/octopath-traveler-ii/logo.png'));
assert.ok(!fs.existsSync('build/server'), 'Node server must not be in the Pages artifact');
assert.ok(!fs.existsSync('build/index.js'), 'Node entry point must not be in the Pages artifact');
function inspect(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    assert.ok(!entry.isSymbolicLink(), `Unexpected link in artifact: ${file}`);
    assert.ok(!/^(\.env(?:\..*)?|\.git|\.local|node_modules|tests|qa-input)$/.test(entry.name), `Private path in artifact: ${file}`);
    assert.ok(!/\.(sav|srm|sra|pak|nsp|xci|nacp|uasset|uexp|pem|key|p12|pfx|log)$|\.report\.json$|^MJSaveData/i.test(entry.name), `Private file in artifact: ${file}`);
    if (entry.isDirectory()) inspect(file);
  }
}
inspect('build');
console.log(`Static entry points and asset base verified: ${base || '/'}`);
