import fs from 'node:fs';
import assert from 'node:assert/strict';
import { loadState, loadArchive, allTasksIndex, BACKLOG_FILE } from './lib/state-io.mjs';
import { renderBacklog } from './lib/backlog.mjs';

const state = loadState();
const archive = loadArchive();
assert.equal(state.schema_version, 3, 'Unknown state schema_version');
assert.equal(archive.schema_version ?? 1, 1, 'Unknown archive schema_version');

const allowed = ['TODO', 'IN_PROGRESS', 'DONE', 'BLOCKED'];
const reviewers = new Set(['code_reviewer', 'security_reviewer']);
const components = new Set(state.components ?? []);
const ids = new Set(state.tasks.map(t => t.id));
const archiveIds = new Set((archive.tasks ?? []).map(t => t.id));
const taskById = allTasksIndex(state, archive);

assert.equal(ids.size, state.tasks.length, 'Duplicate task IDs');
for (const id of ids) assert.ok(!archiveIds.has(id), `Task ${id} exists in state and archive`);
for (const id of archiveIds) assert.ok(!ids.has(id), `Archived task ${id} duplicated in state`);

// backlog.md muss exakt dem Render aus state.json entsprechen.
const rendered = renderBacklog(state);
const onDisk = fs.existsSync(BACKLOG_FILE) ? fs.readFileSync(BACKLOG_FILE, 'utf8') : '';
assert.equal(
  onDisk.replace(/\r\n/g, '\n'),
  rendered.replace(/\r\n/g, '\n'),
  'tasks/backlog.md ist nicht synchron — ausfuehren: node scripts/render-backlog.mjs'
);

for (const task of state.tasks) {
  assert.ok(task.id && allowed.includes(task.status), `Invalid task/status ${task.id}`);
  assert.ok(task.component && components.has(task.component), `Unknown component ${task.component} (${task.id})`);
  assert.ok(task.title, `${task.id}: missing title`);
  assert.ok(Array.isArray(task.dependencies), `${task.id}: dependencies must be an array`);
  assert.ok(Array.isArray(task.inventory_refs) && task.inventory_refs.every(r => /^INV-\d+$/.test(r)), `${task.id}: invalid inventory_refs`);
  assert.ok(task.fix_retries >= 0 && task.fix_retries <= 3, `${task.id}: invalid fix_retries`);
  if (task.allowed_paths !== undefined) assert.ok(Array.isArray(task.allowed_paths), `${task.id}: allowed_paths must be an array`);

  for (const dep of task.dependencies) {
    const depTask = taskById.get(dep);
    assert.ok(depTask, `${task.id}: missing dependency ${dep}`);
    if (['IN_PROGRESS', 'DONE'].includes(task.status)) {
      assert.equal(depTask.status, 'DONE', `${task.id}: dependency ${dep} incomplete`);
    }
  }

  if (task.status === 'BLOCKED') {
    assert.ok(task.blocked_reason, `${task.id}: BLOCKED without blocked_reason`);
  }

  const evidenceCheck = (file, expectExit, label, declaredCmd) => {
    assert.ok(fs.existsSync(file), `${task.id}: evidence file missing ${file}`);
    const ev = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.equal(ev.task_id, task.id, `${task.id}: ${label} evidence belongs to ${ev.task_id}`);
    if (expectExit === 0) assert.equal(ev.exit_code, 0, `${task.id}: ${label} evidence failed (exit ${ev.exit_code})`);
    else assert.notEqual(ev.exit_code, 0, `${task.id}: ${label} evidence must be a failing run (exit was 0)`);
    if (declaredCmd) {
      assert.ok((ev.command ?? '').includes(declaredCmd), `${task.id}: ${label} evidence command '${ev.command}' does not match declared '${declaredCmd}'`);
    }
  };

  if (task.status === 'DONE') {
    assert.ok(task.test_evidence, `${task.id}: DONE without test_evidence`);
    evidenceCheck(task.test_evidence, 0, 'test', task.test_command);
    if (task.red_evidence_required) {
      assert.ok(task.red_evidence, `${task.id}: DONE without red_evidence (TDD)`);
      evidenceCheck(task.red_evidence, 'nonzero', 'red', task.test_command);
    }
    if (task.lint_command) {
      assert.ok(task.lint_evidence, `${task.id}: DONE without lint_evidence`);
      evidenceCheck(task.lint_evidence, 0, 'lint', task.lint_command);
    }
    const reviewFile = task.review_file ?? `tasks/reviews/${task.id}.md`;
    assert.ok(fs.existsSync(reviewFile), `${task.id}: DONE without review artefact ${reviewFile}`);
    assert.ok(task.reviewed_by, `${task.id}: DONE without reviewed_by`);
    assert.ok(reviewers.has(task.reviewed_by), `${task.id}: reviewed_by must be code_reviewer or security_reviewer`);
    assert.notEqual(task.reviewed_by, task.implemented_by, `${task.id}: reviewer must differ from implementer`);
    assert.ok(task.review_result, `${task.id}: DONE without review_result summary`);
  }
}

const visit = (id, path = new Set()) => {
  assert.ok(!path.has(id), `Dependency cycle at ${id}`);
  const t = taskById.get(id);
  for (const dep of t?.dependencies ?? []) visit(dep, new Set([...path, id]));
};
for (const id of ids) visit(id);

console.log(`OK: ${ids.size} active + ${archiveIds.size} archived tasks; JSON, transitions, evidence, reviewers and backlog synchronized.`);
