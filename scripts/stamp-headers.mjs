// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710
// Puts the author's notice at the top of every source file (safe to run again; files that already
// have it are left alone). `npm run stamp` after adding new files; a unit test checks none is missing.
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const MARK = 'KWL-RA-E20A3710';
const TEXT = `© 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · ${MARK}`;
const ROOTS = ['src', 'electron', 'scripts', 'tests'];
const ROOT_FILES = [
  'vite.config.ts',
  'vitest.config.ts',
  'playwright.config.ts',
  'eslint.config.js',
  'capacitor.config.json',
];
const COMMENT = {
  '.ts': (t) => `// ${t}\n`,
  '.tsx': (t) => `// ${t}\n`,
  '.cjs': (t) => `// ${t}\n`,
  '.mjs': (t) => `// ${t}\n`,
  '.js': (t) => `// ${t}\n`,
  '.css': (t) => `/* ${t} */\n`,
};

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function sourceFiles() {
  const out = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (COMMENT[extname(p)]) out.push(p);
    }
  };
  for (const r of ROOTS) walk(join(root, r));
  for (const f of ROOT_FILES) if (COMMENT[extname(f)]) out.push(join(root, f));
  return out;
}

export function hasMark(text) {
  return text.slice(0, 400).includes(MARK);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let n = 0;
  for (const file of sourceFiles()) {
    const text = readFileSync(file, 'utf8');
    if (hasMark(text)) continue;
    const note = COMMENT[extname(file)](TEXT);
    // Keep a #! line first.
    const shebang = text.startsWith('#!') ? text.slice(0, text.indexOf('\n') + 1) : '';
    writeFileSync(file, shebang + note + text.slice(shebang.length));
    n++;
    console.log('stamped', relative(root, file));
  }
  console.log(n ? `${n} file(s) stamped` : 'every file already carries the notice');
}
