import { execSync } from 'node:child_process';
import { isGitRepo, currentBranch, mergeBase } from './gitflow.mjs';

export { isGitRepo, currentBranch };

// Buchhaltungspfade, die jeder Task implizit mitaendern darf (auf main;
// auf Task-Branches sind sie durch MAIN_ONLY_PATHS gesperrt).
export const BOOKKEEPING_PATHS = [
  'tasks/',
  'docs/progress.md',
  'docs/feature-inventory.md',
];

export function scopeForTask(task) {
  const base =
    Array.isArray(task.allowed_paths) && task.allowed_paths.length
      ? task.allowed_paths
      : task.component === 'contracts'
        ? ['contracts/']
        : [`apps/${task.component}/`];
  return [...base, ...BOOKKEEPING_PATHS];
}

// Scope auf einem Task-Branch: nur Code-Scope + Evidence-/Review-Artefakte.
// Buchhaltungsdateien (MAIN_ONLY_PATHS) sind hier verboten.
export function branchScope(task) {
  const base =
    Array.isArray(task.allowed_paths) && task.allowed_paths.length
      ? task.allowed_paths
      : task.component === 'contracts'
        ? ['contracts/']
        : [`apps/${task.component}/`];
  return [...base, 'tasks/evidence/', 'tasks/reviews/'];
}

const normalize = p =>
  p.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^"|"$/g, '');

// Uncommitted changes (staged + unstaged + untracked) relativ zum Repo-Root.
export function changedFiles() {
  if (!isGitRepo()) return { files: [], git: false };
  const out = execSync('git status --porcelain -uall', { encoding: 'utf8' });
  const files = [];
  for (const line of out.split('\n')) {
    if (line.length < 4) continue;
    let p = line.slice(3);
    const arrow = p.indexOf(' -> ');
    if (arrow >= 0) p = p.slice(arrow + 4);
    files.push(normalize(p.trim()));
  }
  return { files, git: true };
}

export const stagedFiles = () => {
  if (!isGitRepo()) return [];
  const out = execSync('git diff --cached --name-only', { encoding: 'utf8' });
  return out.split('\n').map(normalize).filter(Boolean);
};

// Alle Aenderungen des aktuellen Task-Branches: committed seit merge-base
// plus uncommitted. Ausserhalb eines Branches nur uncommitted.
export function taskDiffFiles() {
  const { files, git } = changedFiles();
  if (!git) return { files: [], git: false };
  const branch = currentBranch();
  const base = branch ? mergeBase('HEAD') : null;
  if (!base) return { files, git: true };
  const committed = execSync(`git diff --name-only ${base}...HEAD`, { encoding: 'utf8' })
    .split('\n')
    .map(normalize)
    .filter(Boolean);
  return { files: [...new Set([...committed, ...files])], git: true, branch };
}

export const inScope = (file, allowed) => {
  const f = normalize(file);
  return allowed.some(a => {
    const p = normalize(a);
    return p.endsWith('/') ? f.startsWith(p) : f === p;
  });
};

export const scopeViolations = (files, allowed) =>
  files.filter(f => !inScope(f, allowed));
