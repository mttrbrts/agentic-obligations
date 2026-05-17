#!/usr/bin/env node
/**
 * concerto compile --target typescript emits extensionless relative imports
 * (e.g. `from './org.accordproject.money@0.3.0'`).  Under NodeNext ESM both
 * TypeScript and Node require explicit `.js` suffixes.  This script rewrites
 * the generated files in place so they're loadable under ESM.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GEN_DIR = join(__dirname, '..', 'logic', 'generated');

const files = (await readdir(GEN_DIR)).filter((f) => f.endsWith('.ts'));

// Matches: from '...' or import('...') for relative paths (starting with ./ or ../)
// that don't already end in .js / .ts / .json
const RE = /(from\s+['"])(\.\/[^'"]+?)(?<!\.js)(?<!\.ts)(?<!\.json)(['"])/g;

let changed = 0;
for (const f of files) {
  const path = join(GEN_DIR, f);
  const src = await readFile(path, 'utf8');
  const out = src.replace(RE, '$1$2.js$3');
  if (out !== src) {
    await writeFile(path, out, 'utf8');
    changed++;
  }
}

console.log(`[fix-generated-imports] rewrote ${changed} of ${files.length} files`);
