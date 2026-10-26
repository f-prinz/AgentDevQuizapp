import { loadState } from './lib/state-io.mjs';
import { isGitRepo, currentBranch, syncMain, predictConflicts, mainBranch, git, gitArgs } from './lib/gitflow.mjs';

// usage: merge-task.mjs <TASK-ID> [--keep] — Konfliktprognose, dann --no-ff
// Merge auf main; loescht den Task-Branch danach (sicheres -d), ausser --keep.
const [id, ...flags] = process.argv.slice(2);
const keep = flags.includes('--keep');
const state = loadState();
if (!state.tasks.some(t => t.id === id)) throw Error(`Unknown task ${id}`);
if (!isGitRepo()) throw Error('Kein Git-Repo');

try {
  git(`rev-parse --verify ${id}`);
} catch {
  throw Error(`Branch ${id} existiert nicht — erst branch-task.mjs ${id}`);
}
if (git('status --porcelain').length > 0) {
  throw Error('Arbeitsbaum verschmutzt — erst committen oder bereinigen');
}

const r = syncMain();
if (r.diverged) throw Error(`main-Sync fehlgeschlagen: ${r.reason}`);

const pred = predictConflicts(id);
if (pred.conflicts === true) {
  console.error(`MERGE-KONFLIKTE vorhergesagt${pred.files.length ? `: ${pred.files.join(', ')}` : ''}`);
  console.error(`Loesen auf dem Task-Branch: git checkout ${id} && git merge ${mainBranch()}, Konflikte beheben, Tests erneut via record-check, dann merge-task erneut ausfuehren.`);
  process.exit(1);
}
if (pred.conflicts === null) console.warn(`WARN: ${pred.detail}`);

git(`checkout ${mainBranch()}`);
gitArgs(['merge', '--no-ff', id, '-m', `Merge ${id}`]);
if (keep) {
  console.log(`Branch ${id} nach ${mainBranch()} gemergt (Branch bleibt erhalten, --keep).`);
} else {
  git(`branch -d ${id}`);
  console.log(`Branch ${id} nach ${mainBranch()} gemergt und geloescht.`);
}
console.log(`Finale Evidence auf ${mainBranch()} ausfuehren, dann update-task DONE.`);
