import { loadState } from './lib/state-io.mjs';
import { isGitRepo, currentBranch, syncMain, git } from './lib/gitflow.mjs';

// usage: branch-task.mjs <TASK-ID> — legt den Task-Branch an (oder wechselt
// auf ihn) und synchronisiert main vorher (falls Remote konfiguriert).
const [id] = process.argv.slice(2);
const state = loadState();
const task = state.tasks.find(t => t.id === id);
if (!task) throw Error(`Unknown task ${id}`);
if (task.status !== 'IN_PROGRESS') throw Error(`${id} ist nicht IN_PROGRESS — erst via update-task setzen`);

if (!isGitRepo()) {
  console.warn('WARN: kein Git-Repo — Branch-Anlage uebersprungen');
  process.exit(0);
}
if (git('status --porcelain').length > 0) {
  throw Error('Arbeitsbaum verschmutzt — erst committen oder bereinigen');
}

const r = syncMain();
if (r.diverged) throw Error(`main-Sync fehlgeschlagen: ${r.reason}`);
if (!r.synced) console.log(`main-Sync: ${r.reason}`);

let exists = false;
try {
  git(`rev-parse --verify ${id}`);
  exists = true;
} catch { /* Branch existiert nicht */ }

if (exists) {
  git(`checkout ${id}`);
  console.log(`Auf bestehenden Branch ${id} gewechselt`);
} else {
  git(`checkout -b ${id} main`);
  console.log(`Branch ${id} von main angelegt`);
}
