import fs from 'node:fs';
import { loadState, loadInventory, loadArchive, allTasksIndex, writeState, PROGRESS_FILE } from './lib/state-io.mjs';
import { writeBacklog } from './lib/backlog.mjs';
import { scopeForTask, branchScope, changedFiles, taskDiffFiles, scopeViolations, isGitRepo } from './lib/scope.mjs';
import { currentBranch } from './lib/gitflow.mjs';

const usage =
  'Usage: update-task.mjs <TASK-ID> [TODO|IN_PROGRESS|DONE|BLOCKED] [--by <agent>] [--reason <text>] [--test-evidence <file>] [--red-evidence <file>] [--lint-evidence <file>] [--reviewed-by <agent>] [--review-file <path>] [--test-result <text>] [--review-result <text>] [--add-inv INV-x] [--scope <path>]* [--deps-change]';

const transitions = {
  TODO: ['IN_PROGRESS'],
  IN_PROGRESS: ['DONE', 'BLOCKED', 'TODO'],
  BLOCKED: ['IN_PROGRESS', 'TODO'],
  DONE: [],
};
const reviewers = new Set(['code_reviewer', 'security_reviewer']);

const [id, ...rest] = process.argv.slice(2);
if (isGitRepo() && currentBranch() === id) {
  console.warn(`WARN: Du bist auf dem Task-Branch ${id} — Buchhaltungsaenderungen (state.json, backlog.md, progress.md) gehoeren auf main. Erst merge-task ausfuehren?`);
}
const state = loadState();
const archive = loadArchive();
const task = state.tasks.find(t => t.id === id);
if (!task) throw Error(`Unknown task ${id}`);

let status = null;
const opts = { scopes: [] };
for (let i = 0; i < rest.length; i++) {
  const arg = rest[i];
  if (['TODO', 'IN_PROGRESS', 'DONE', 'BLOCKED'].includes(arg)) {
    if (status) throw Error(`Duplicate status`);
    status = arg;
  } else if (arg === '--scope') {
    if (!rest[++i]) throw Error('Missing value for --scope');
    opts.scopes.push(rest[i]);
  } else if (arg === '--deps-change') {
    task.allows_dep_change = true;
  } else if (arg.startsWith('--')) {
    if (!rest[++i]) throw Error(`Missing value for ${arg}`);
    opts[arg.slice(2)] = rest[i];
  } else {
    throw Error(`Unexpected argument ${arg}\n${usage}`);
  }
}

if (status && status !== task.status && !transitions[task.status].includes(status)) {
  throw Error(`Invalid transition ${task.status} -> ${status} (${id})`);
}

if (opts.scopes.length) {
  task.allowed_paths = [...new Set([...(task.allowed_paths ?? []), ...opts.scopes])];
}

if (opts['add-inv']) {
  if (!/^INV-\d+$/.test(opts['add-inv'])) throw Error(`Invalid inventory ref ${opts['add-inv']}`);
  const inv = loadInventory();
  if (!inv.entries?.some(e => e.id === opts['add-inv'])) throw Error(`Unknown inventory entry ${opts['add-inv']}`);
  if (!(task.inventory_refs ??= []).includes(opts['add-inv'])) task.inventory_refs.push(opts['add-inv']);
}

if (opts.by) task.implemented_by = opts.by;
if (opts['test-result']) task.test_result = opts['test-result'];
if (opts['review-result']) task.review_result = opts['review-result'];
if (opts['test-evidence']) task.test_evidence = opts['test-evidence'];
if (opts['red-evidence']) task.red_evidence = opts['red-evidence'];
if (opts['lint-evidence']) task.lint_evidence = opts['lint-evidence'];
if (opts['reviewed-by']) task.reviewed_by = opts['reviewed-by'];
if (opts['review-file']) task.review_file = opts['review-file'];

const evidenceCheck = (file, expectExit, declaredCmd) => {
  if (!fs.existsSync(file)) throw Error(`Evidence file missing ${file}`);
  const ev = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (ev.task_id !== id) throw Error(`Evidence belongs to ${ev.task_id}, not ${id}`);
  const ok = expectExit === 0 ? ev.exit_code === 0 : ev.exit_code !== 0;
  if (!ok) throw Error(`Evidence exit code ${ev.exit_code} (erwartet ${expectExit === 0 ? '0' : '!= 0'}) in ${file}`);
  if (declaredCmd && !(ev.command ?? '').includes(declaredCmd)) {
    throw Error(`Evidence-Befehl '${ev.command}' passt nicht zum deklarierten Befehl '${declaredCmd}'`);
  }
};

const taskById = allTasksIndex(state, archive);
if (status === 'IN_PROGRESS' || status === 'DONE') {
  for (const dep of task.dependencies ?? []) {
    if (taskById.get(dep)?.status !== 'DONE') throw Error(`Dependency ${dep} incomplete`);
  }
}

if (status === 'BLOCKED') {
  if (!opts.reason && !task.blocked_reason) throw Error('BLOCKED requires --reason');
  if (opts.reason) task.blocked_reason = opts.reason;
}

if (status === 'DONE') {
  if (!task.test_evidence) throw Error('DONE requires --test-evidence <file>');
  evidenceCheck(task.test_evidence, 0, task.test_command);
  if (task.red_evidence_required) {
    if (!task.red_evidence) throw Error('DONE requires --red-evidence <file> (TDD: roter Testlauf zuerst)');
    evidenceCheck(task.red_evidence, 'nonzero', task.test_command);
  }
  if (task.lint_command) {
    if (!task.lint_evidence) throw Error('DONE requires --lint-evidence <file> (lint_command gesetzt)');
    evidenceCheck(task.lint_evidence, 0, task.lint_command);
  }
  const reviewFile = task.review_file ?? `tasks/reviews/${id}.md`;
  if (!fs.existsSync(reviewFile)) {
    throw Error(`DONE erfordert Review-Artefakt ${reviewFile} (Findings via --review-file <path> verlinken oder anlegen)`);
  }
  if (!task.reviewed_by) throw Error('DONE requires --reviewed-by <agent>');
  if (!reviewers.has(task.reviewed_by)) throw Error(`reviewed_by must be code_reviewer or security_reviewer`);
  if (task.reviewed_by === task.implemented_by) throw Error('Reviewer must differ from implementer');
  if (!task.review_result) throw Error('DONE requires --review-result <summary>');

  const onBranch = currentBranch() === id;
  const { files, git } = onBranch ? taskDiffFiles() : changedFiles();
  const allowed = onBranch ? branchScope(task) : scopeForTask(task);
  if (git) {
    const bad = scopeViolations(files, allowed);
    if (bad.length) throw Error(`Out-of-scope changes: ${bad.join(', ')} (allowed: ${allowed.join(', ')})`);
  } else {
    console.warn('WARN: kein Git-Repo — Scope-Pruefung uebersprungen');
  }
}

if (status === 'IN_PROGRESS' && isGitRepo()) {
  const { files } = changedFiles();
  const foreign = scopeViolations(files, scopeForTask(task));
  if (foreign.length) console.warn(`WARN: Arbeitsbaum verschmutzt — Dateien ausserhalb des Task-Scope: ${foreign.join(', ')}`);
}

if (status) task.status = status;
state.blockers = state.tasks.filter(t => t.status === 'BLOCKED').map(t => ({ task_id: t.id, reason: t.blocked_reason }));
state.phase = state.tasks.every(t => t.status === 'DONE') ? 'complete' : 'development';
writeState(state);
writeBacklog(state);

let progress = fs.existsSync(PROGRESS_FILE) ? fs.readFileSync(PROGRESS_FILE, 'utf8') : '# Fortschritt\n\nAktueller Stand: Keine Tasks. Historische Meldungen unten bleiben erhalten.\n';
const current = state.tasks.map(t => `${t.id} ${t.status}`).join('; ');
progress = progress.replace(/^Aktueller Stand:.*$/m, `Aktueller Stand: ${current}. Historische Meldungen unten bleiben erhalten.`);
progress += `\n${state.last_updated_utc}: ${id}${status ? ` ${status}` : ' aktualisiert'}. ${opts['test-result'] ?? ''} ${opts['review-result'] ?? ''} ${opts.reason ?? ''}\n`;
fs.writeFileSync(PROGRESS_FILE, progress);
console.log(`${id}: ${task.status}`);
