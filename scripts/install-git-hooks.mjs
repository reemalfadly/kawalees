// © 2026 Eng.Reem Alfadly · Kawalees · All rights reserved · KWL-RA-E20A3710
// Installs a git pre-commit hook that runs the fast checks (types, lint, format,
// unit tests) whenever a commit touches the app. Runs on `npm install` via the
// "prepare" script; does nothing in CI or outside a git checkout.
import { execSync } from 'node:child_process';
import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const MARKER = '# kawalees guard';

if (process.env.CI) process.exit(0);

let hooksDir;
let prefix;
try {
  hooksDir = execSync('git rev-parse --git-path hooks', { encoding: 'utf8' }).trim();
  // "studio/" when the app lives in a sub-folder, "" when it is the repository root.
  prefix = execSync('git rev-parse --show-prefix', { encoding: 'utf8' }).trim();
} catch {
  process.exit(0); // not a git checkout (e.g. installed from a tarball)
}

const hookPath = join(hooksDir, 'pre-commit');
const block = `${MARKER}
if git diff --cached --name-only | grep -q '^${prefix}'; then
  echo "🛡️  كواليس: فحص الأنواع والتنسيق والاختبارات قبل الحفظ…"
  (cd "$(git rev-parse --show-toplevel)/${prefix}" && npm run --silent guard) || {
    echo "❌ الفحص فشل وما انحفظ الـ commit. التفاصيل فوق. (للطوارئ فقط: git commit --no-verify)"
    exit 1
  }
fi
${MARKER} end
`;

let current = existsSync(hookPath) ? readFileSync(hookPath, 'utf8') : '#!/bin/sh\n';
// Drop the block written under the app's earlier working name.
current = current.replace(/# sanaa-studio guard[\s\S]*?# sanaa-studio guard end\n/, '');
if (current.includes(MARKER)) {
  current = current.replace(new RegExp(`${MARKER}[\\s\\S]*?${MARKER} end\\n`), block);
} else {
  current = `${current.trimEnd()}\n\n${block}`;
}
writeFileSync(hookPath, current);
chmodSync(hookPath, 0o755);
console.log(`kawalees: pre-commit guard installed at ${hookPath}`);
