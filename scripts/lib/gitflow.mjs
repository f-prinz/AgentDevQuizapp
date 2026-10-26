import { execSync, execFileSync } from 'node:child_process';
import fs from 'node:fs';

export const git = (cmd, opts = {}) =>
  execSync(`git ${cmd}`, { encoding: 'utf8', stdio: 'pipe', ...opts }).trim();

// Args-Array-Variante ohne Shell — fuer Aufrufe mit Leerzeichen/Quotes in Argumenten.
export const gitArgs = (args, opts = {}) =>
  execFileSync('git', args, { encoding: 'utf8', stdio: 'pipe', ...opts }).trim();

export const isGitRepo = () => {
  try {
    git('rev-parse --is-inside-work-tree');
    return true;
  } catch {
    return false;
  }
};

export const currentBranch = () => {
  try {
    return git('symbolic-ref --short HEAD') || null;
  } catch {
    return null; // detached HEAD
  }
};

export const hasRemote = () => {
  try {
    return git('remote').length > 0;
  } catch {
    return false;
  }
};

export const defaultRemote = () => {
  const remotes = git('remote').split('\n').filter(Boolean);
  return remotes.includes('origin') ? 'origin' : remotes[0] ?? null;
};

export const mergeInProgress = () =>
  fs.existsSync('.git/MERGE_HEAD');

// Buchhaltungsdateien, die ausschliesslich auf main geschrieben werden duerfen.
export const MAIN_ONLY_PATHS = [
  'tasks/state.json',
  'tasks/backlog.md',
  'tasks/inventory.json',
  'tasks/archive.json',
  'docs/progress.md',
  'docs/feature-inventory.md',
];

export const EVIDENCE_PATH = 'tasks/evidence/';

export const mainBranch = () => {
  for (const b of ['main', 'master']) {
    try {
      git(`rev-parse --verify ${b}`);
      return b;
    } catch { /* weiter */ }
  }
  return 'main';
};

// main auf den Remote-Stand bringen (nur fast-forward). Ohne Remote: skip.
export const syncMain = () => {
  if (!hasRemote()) return { synced: false, reason: 'kein Remote' };
  const remote = defaultRemote();
  git(`fetch ${remote}`);
  const main = mainBranch();
  const local = git(`rev-parse ${main}`);
  const upstream = `${remote}/${main}`;
  let remoteSha = null;
  try {
    remoteSha = git(`rev-parse ${upstream}`);
  } catch {
    return { synced: false, reason: `kein ${upstream}` };
  }
  if (local === remoteSha) return { synced: true, reason: 'bereits aktuell' };
  const behind = git(`rev-list --count ${main}..${upstream}`);
  const ahead = git(`rev-list --count ${upstream}..${main}`);
  if (ahead !== '0') {
    return { synced: false, reason: `lokaler ${main} ist ${ahead} Commit(s) voraus — Divergenz, Nutzerentscheidung noetig`, diverged: true };
  }
  git(`checkout ${main}`);
  git(`pull --ff-only ${remote} ${main}`);
  return { synced: true, reason: `${behind} Commit(s) geholt` };
};

export const mergeBase = (branch = 'HEAD') => {
  const main = mainBranch();
  for (const base of [main]) {
    try {
      return git(`merge-base ${branch} ${base}`);
    } catch { /* weiter */ }
  }
  return null;
};

// Sagt Merge-Konflikte voraus, ohne den Arbeitsbaum anzufassen.
// Rueckgabe: { conflicts: bool, files: string[] }
export const predictConflicts = branch => {
  const main = mainBranch();
  try {
    const out = execSync(`git merge-tree --write-tree ${branch} ${main}`, {
      encoding: 'utf8',
      stdio: 'pipe',
    });
    // git >= 2.38: exit 0 = sauber; Zeilen nach dem Tree-OID listen Konfliktinfos.
    return { conflicts: false, files: [], detail: out.trim() };
  } catch (e) {
    const out = `${e.stdout ?? ''}\n${e.stderr ?? ''}`;
    // Alte git-Version ohne --write-tree: Fallback auf Probe-Merge.
    if (/unknown option|usage:|invalid option/i.test(out)) return dryRunMerge(branch);
    const files = [...out.matchAll(/CONFLICT.*?: (.+)/g)]
      .map(m => m[1].trim())
      .filter((v, i, a) => a.indexOf(v) === i);
    // Exit != 0 ohne "unknown option" = Konfliktprognose positiv.
    return { conflicts: true, files, detail: out.trim() };
  }
};

const dryRunMerge = branch => {
  const dirty = git('status --porcelain').length > 0;
  if (dirty) return { conflicts: null, files: [], detail: 'Arbeitsbaum verschmutzt — Konfliktprognose uebersprungen' };
  const head = currentBranch();
  try {
    git(`checkout ${mainBranch()}`);
    execSync(`git merge --no-commit --no-ff ${branch}`, { stdio: 'pipe' });
    git('merge --abort');
    return { conflicts: false, files: [], detail: 'dry-run merge clean' };
  } catch {
    const unmerged = git('diff --name-only --diff-filter=U').split('\n').filter(Boolean);
    try { git('merge --abort'); } catch { /* nichts */ }
    return { conflicts: unmerged.length > 0, files: unmerged, detail: 'dry-run merge' };
  } finally {
    if (head && currentBranch() !== head) git(`checkout ${head}`);
  }
};
