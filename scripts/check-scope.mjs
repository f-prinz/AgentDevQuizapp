import { loadState } from './lib/state-io.mjs';
import { scopeForTask, branchScope, changedFiles, taskDiffFiles, scopeViolations } from './lib/scope.mjs';
import { currentBranch } from './lib/gitflow.mjs';

const [id] = process.argv.slice(2);
const state = loadState();
const task = state.tasks.find(t => t.id === id);
if (!task) throw Error(`Unknown task ${id}`);

const branch = currentBranch();
const onTaskBranch = branch === id;
const { files, git } = onTaskBranch ? taskDiffFiles() : changedFiles();
if (!git) {
  console.warn('WARN: kein Git-Repo — Scope-Pruefung uebersprungen (nicht durchsetzbar)');
  process.exit(0);
}
if (!files.length) {
  console.log(`OK: keine relevanten Aenderungen${onTaskBranch ? ` (Branch ${id}, seit Merge-Base)` : ''}`);
  process.exit(0);
}
const allowed = onTaskBranch ? branchScope(task) : scopeForTask(task);
const bad = scopeViolations(files, allowed);
if (bad.length) {
  console.error(`SCOPE VERLETZT (${id}${onTaskBranch ? `, Branch-Diff` : ''}): ${bad.join(', ')}`);
  console.error(`Erlaubt: ${allowed.join(', ')}`);
  process.exit(1);
}
console.log(`OK: ${files.length} Datei(en) im Scope von ${id}${onTaskBranch ? ' (Branch-Diff seit Merge-Base)' : ''}`);
