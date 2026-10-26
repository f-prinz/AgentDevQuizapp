import { execSync } from 'node:child_process';
import { loadState } from './lib/state-io.mjs';
import { branchScope, stagedFiles, scopeViolations, isGitRepo, BOOKKEEPING_PATHS } from './lib/scope.mjs';
import { currentBranch, mergeInProgress, mainBranch, MAIN_ONLY_PATHS } from './lib/gitflow.mjs';

// Heuristischer Secrets-Tripwire: harte Bloecke auf High-Confidence-Marker,
// Warnung auf generische Zuweisungen. Tripwire, kein Scanner.
const SECRET_BLOCK = /-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(sk-[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{20,}|glpat-[a-zA-Z0-9_-]{20,}|AKIA[A-Z0-9]{16}|AIza[0-9A-Za-z_-]{30,}|xox[baprs]-[0-9a-zA-Z-]{10,})/;
const SECRET_WARN = /(password|passwd|secret|token|api[_-]?key)\s*[:=]\s*['"][^'"]{8,}/i;
const MANIFEST = /(^|\/)(package\.json|package-lock\.json|yarn\.lock|pnpm-lock\.yaml|pom\.xml|build\.gradle|build\.gradle\.kts|requirements[^/]*\.txt|Pipfile(\.lock)?|Cargo\.(toml|lock)|pubspec\.yaml|go\.(mod|sum)|Gemfile(\.lock)?|composer\.(json|lock))$|\.csproj$/i;

const scanStagedDiff = () => {
  let added;
  try {
    added = execSync('git diff --cached -U0', { encoding: 'utf8' })
      .split('\n')
      .filter(l => l.startsWith('+') && !l.startsWith('+++'))
      .map(l => l.slice(1));
  } catch {
    return { blocked: [], warnings: [] };
  }
  return {
    blocked: added.filter(l => SECRET_BLOCK.test(l)).map(l => l.trim().slice(0, 80)),
    warnings: added.filter(l => !SECRET_BLOCK.test(l) && SECRET_WARN.test(l)).map(l => l.trim().slice(0, 80)),
  };
};

if (!isGitRepo()) {
  console.warn('WARN: kein Git-Repo — Commit-Scope-Pruefung uebersprungen');
  process.exit(0);
}

if (mergeInProgress()) {
  console.log('OK: Merge-Commit');
  process.exit(0);
}

const files = stagedFiles();
if (!files.length) {
  console.log('OK: keine staged Dateien');
  process.exit(0);
}

const secrets = scanStagedDiff();
if (secrets.blocked.length) {
  console.error(`COMMIT VERWEIGERT: moegliches Secret im Diff: ${secrets.blocked[0]}${secrets.blocked.length > 1 ? ` (+${secrets.blocked.length - 1} weitere)` : ''}`);
  process.exit(1);
}
for (const w of secrets.warnings) console.warn(`WARN: moegliche Secret-Zuweisung: ${w}`);

const manifests = files.filter(f => MANIFEST.test(f));

const state = loadState();
const branch = currentBranch();
const inProgress = (state.tasks ?? []).filter(t => t.status === 'IN_PROGRESS');
const task = inProgress.find(t => t.id === branch);

if (branch === mainBranch()) {
  const nonBook = scopeViolations(files, [...BOOKKEEPING_PATHS, 'tasks/evidence/']);
  if (nonBook.length) {
    console.warn(`WARN: Direkt-Commit auf ${mainBranch()} mit Nicht-Buchhaltungsdateien: ${nonBook.join(', ')} — gehoert das in einen Task-Branch?`);
  }
  if (manifests.length) {
    console.warn(`WARN: Dependency-Manifest auf ${mainBranch()} geaendert: ${manifests.join(', ')}`);
  }
  console.log(`OK: ${files.length} staged Datei(en) auf ${mainBranch()}`);
  process.exit(0);
}

if (!task) {
  if (!inProgress.length) {
    console.warn(`WARN: Branch "${branch}" passt zu keinem IN_PROGRESS-Task und kein Task aktiv — Commit nicht auf Task-Scope geprueft`);
    process.exit(0);
  }
  console.error(`COMMIT-SCOPE VERLETZT: Branch "${branch}" ist weder ${mainBranch()} noch ein IN_PROGRESS-Task (${inProgress.map(t => t.id).join(', ')})`);
  console.error('Regel: Branchname = Task-ID. Branch via scripts/branch-task.mjs anlegen.');
  process.exit(1);
}

const allowed = branchScope(task);
const bad = scopeViolations(files, allowed);
const mainOnly = files.filter(f => MAIN_ONLY_PATHS.includes(f));
if (manifests.length && task.allows_dep_change !== true) {
  console.error(`COMMIT-SCOPE VERLETZT: Dependency-Manifest geaendert (${manifests.join(', ')}) ohne --deps-change auf ${task.id}`);
  console.error('Dependency-Aenderungen sind freigabepflichtig — Task via update-task --deps-change flaggen.');
  process.exit(1);
}
if (bad.length || mainOnly.length) {
  if (mainOnly.length) console.error(`COMMIT-SCOPE VERLETZT: Buchhaltungsdateien gehoeren auf ${mainBranch()}: ${mainOnly.join(', ')}`);
  if (bad.length) {
    console.error(`COMMIT-SCOPE VERLETZT (${task.id}): ${bad.join(', ')}`);
    console.error(`Erlaubt: ${allowed.join(', ')}`);
  }
  process.exit(1);
}
console.log(`OK: ${files.length} staged Datei(en) im Scope von ${task.id} (Branch ${branch})`);
