#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exportFollowNpcs } from './lib/octopath-ii/follow-npcs.mjs';
try {
  const args = process.argv.slice(2), options = {};
  for (let i = 0; i < args.length; i += 2) {
    if (!['--pak', '--control', '--out-dir'].includes(args[i]) || !args[i + 1] || Object.hasOwn(options, args[i])) throw new Error('Usage: --pak PATH --control NACP --out-dir DIRECTORY');
    options[args[i]] = args[i + 1];
  }
  if (Object.keys(options).length !== 3) throw new Error('All three options are required');
  const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  console.log(JSON.stringify(await exportFollowNpcs({ pakPath: options['--pak'], controlPath: options['--control'], outputDir: options['--out-dir'], project }), null, 2));
} catch (error) { console.error(error.stack); process.exitCode = 1; }
