import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

let root;
try {
  root = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
} catch {
  throw Error('Kein Git-Repo — Hooks koennen erst nach git init installiert werden');
}

const hook = `#!/bin/sh
# Installiert via scripts/install-hooks.mjs — Inhalt dort pflegen.
cd "$(git rev-parse --show-toplevel)" || exit 1
node scripts/check-state.mjs && node scripts/check-inventory.mjs && node scripts/check-commit-scope.mjs
`;

const file = path.join(root, '.git', 'hooks', 'pre-commit');
fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(file, hook);
try { fs.chmodSync(file, 0o755); } catch { /* Windows: nicht noetig */ }
console.log(`pre-commit Hook installiert: ${file}`);
