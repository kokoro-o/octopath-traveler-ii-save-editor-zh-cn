#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extract } from './lib/octopath-ii/extract-and-validate.mjs';
const args = process.argv.slice(2), options = {};
try {
  for (let i = 0; i < args.length; i += 2) {
    if (!['--pak','--control','--out-dir'].includes(args[i]) || !args[i+1] || Object.hasOwn(options, args[i])) throw new Error('Usage: node scripts/octopath-ii-items.mjs --pak PATH --control NACP --out-dir NEW_LOCAL_DIRECTORY');
    options[args[i]] = args[i+1];
  }
  if (Object.keys(options).length !== 3) throw new Error('All three options are required');
  const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  console.log(JSON.stringify(await extract({ pakPath: options['--pak'], controlPath: options['--control'], output: options['--out-dir'], project })));
} catch (error) { console.error(error.stack); process.exitCode = 1; }
