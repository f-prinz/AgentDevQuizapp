import { isGitRepo, hasRemote, defaultRemote, predictConflicts, git } from './lib/gitflow.mjs';

// usage: push-task.mjs <TASK-ID> — Task-Branch zur Review-Einreichung pushen.
// Nur bei konfiguriertem Remote; verweigert bei vorhergesagten Konflikten.
const [id] = process.argv.slice(2);
if (!isGitRepo()) throw Error('Kein Git-Repo');
try {
  git(`rev-parse --verify ${id}`);
} catch {
  throw Error(`Branch ${id} existiert nicht`);
}

if (!hasRemote()) {
  console.log('Kein Remote konfiguriert — Push uebersprungen.');
  process.exit(0);
}

const pred = predictConflicts(id);
if (pred.conflicts === true) {
  console.error(`Push verweigert: vorhergesagte Merge-Konflikte${pred.files.length ? `: ${pred.files.join(', ')}` : ''}`);
  console.error(`Erst auf ${id} beheben: git checkout ${id} && git merge main`);
  process.exit(1);
}
if (pred.conflicts === null) console.warn(`WARN: ${pred.detail}`);

const remote = defaultRemote();
git(`push -u ${remote} ${id}`);
console.log(`Branch ${id} nach ${remote} gepusht (Review-Einreichung).`);
