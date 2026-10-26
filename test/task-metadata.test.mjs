import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { scopeForTask } from '../scripts/lib/scope.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixturePrefix = 'raccoons-task-metadata-';
let fixture;

const run = (...args) => spawnSync(process.execPath, args, {
  cwd: fixture,
  encoding: 'utf8',
  windowsHide: true,
});

const saveJson = (relativePath, value) => {
  const destination = path.join(fixture, relativePath);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, `${JSON.stringify(value, null, 2)}\n`);
};

const readJson = relativePath =>
  JSON.parse(fs.readFileSync(path.join(fixture, relativePath), 'utf8'));

const snapshotAccounting = () => Object.fromEntries(
  ['tasks/state.json', 'tasks/backlog.md', 'docs/progress.md'].map(file => [
    file,
    fs.existsSync(path.join(fixture, file))
      ? fs.readFileSync(path.join(fixture, file), 'utf8')
      : null,
  ]),
);

before(() => {
  fixture = fs.mkdtempSync(path.join(os.tmpdir(), fixturePrefix));
  fs.cpSync(path.join(projectRoot, 'scripts'), path.join(fixture, 'scripts'), { recursive: true });
  fs.writeFileSync(path.join(fixture, 'package.json'), '{"type":"module"}\n');
  fs.mkdirSync(path.join(fixture, 'tasks'), { recursive: true });
  fs.mkdirSync(path.join(fixture, 'docs'), { recursive: true });
  saveJson('tasks/state.json', {
    schema_version: 3,
    phase: 'planning',
    components: ['server', 'web'],
    tasks: [
      {
        id: 'TECH-1', component: 'server', title: 'Base task',
        acceptance_criteria: 'Base criteria', test_command: 'node --test',
        lint_command: null, red_evidence_required: false, dependencies: [],
        status: 'TODO', fix_retries: 0, inventory_refs: [],
      },
      {
        id: 'TECH-2', component: 'web', title: 'Dependent task',
        acceptance_criteria: 'Dependent criteria', test_command: 'node --test',
        lint_command: null, red_evidence_required: false, dependencies: ['TECH-1'],
        status: 'TODO', fix_retries: 0, inventory_refs: [],
      },
      {
        id: 'TECH-3', component: 'server', title: 'Done task',
        acceptance_criteria: 'Frozen criteria', test_command: 'node --test',
        lint_command: null, red_evidence_required: false, dependencies: [],
        status: 'DONE', fix_retries: 0, inventory_refs: [],
        implemented_by: 'server_developer', test_evidence: 'tasks/evidence/TECH-3.json',
        reviewed_by: 'code_reviewer', review_file: 'tasks/reviews/TECH-3.md',
        review_result: 'approved',
      },
    ],
    blockers: [],
    last_updated_utc: null,
  });
  saveJson('tasks/inventory.json', { schema_version: 2, entries: [], last_updated_utc: null });
  saveJson('tasks/archive.json', { schema_version: 1, tasks: [] });
  fs.writeFileSync(path.join(fixture, 'docs/progress.md'), '# Progress\n\nAktueller Stand: initial.\n');
  const rendered = run('scripts/render-backlog.mjs');
  assert.equal(rendered.status, 0, rendered.stderr);
});

after(() => {
  const resolved = path.resolve(fixture ?? '');
  const tempRoot = path.resolve(os.tmpdir());
  assert.ok(resolved.startsWith(`${tempRoot}${path.sep}${fixturePrefix}`), 'refusing to remove an unowned fixture path');
  fs.rmSync(resolved, { recursive: true, force: true });
});

test('add-task accepts virtual contracts without registering an apps component', () => {
  const result = run(
    'scripts/add-task.mjs', 'TECH-4', '--component', 'contracts', '--title', 'Event schemas',
    '--ak', 'schemas exist', '--test', 'node --test contracts/test.mjs',
    '--classification', 'TARGET_ALIGNED', '--priority', 'P0',
  );
  assert.equal(result.status, 0, result.stderr);
  const state = readJson('tasks/state.json');
  assert.deepEqual(state.components, ['server', 'web']);
  assert.equal(state.tasks.at(-1).component, 'contracts');
  assert.equal(state.tasks.at(-1).classification, 'TARGET_ALIGNED');
  assert.equal(state.tasks.at(-1).priority, 'P0');
  assert.deepEqual(scopeForTask(state.tasks.at(-1)).slice(0, 1), ['contracts/']);
});

test('add-task rejects invalid component and unknown flags without changing accounting files', () => {
  const beforeState = snapshotAccounting();
  const unknownComponent = run('scripts/add-task.mjs', 'TECH-9', '--component', 'mobile', '--title', 'Nope');
  assert.notEqual(unknownComponent.status, 0);
  assert.match(`${unknownComponent.stdout}${unknownComponent.stderr}`, /Unbekannte Komponente/);
  assert.deepEqual(snapshotAccounting(), beforeState);

  const unknownFlag = run('scripts/add-task.mjs', 'TECH-10', '--component', 'server', '--title', 'Nope', '--mystery', 'value');
  assert.notEqual(unknownFlag.status, 0);
  assert.match(`${unknownFlag.stdout}${unknownFlag.stderr}`, /Unknown\/incomplete flag/);
  assert.deepEqual(snapshotAccounting(), beforeState);
});

test('update-task writes validated planning metadata for TODO tasks and rerenders backlog', () => {
  const result = run(
    'scripts/update-task.mjs', 'TECH-2', '--component', 'web', '--title', 'Refined task',
    '--ak', 'Refined criteria', '--test', 'node --test refined.mjs', '--lint', 'npm run lint',
    '--deps', 'TECH-1', '--classification', 'CURRENT_STACK_ONLY', '--priority', 'P1',
  );
  assert.equal(result.status, 0, result.stderr);
  const task = readJson('tasks/state.json').tasks.find(entry => entry.id === 'TECH-2');
  assert.equal(task.title, 'Refined task');
  assert.equal(task.acceptance_criteria, 'Refined criteria');
  assert.equal(task.test_command, 'node --test refined.mjs');
  assert.equal(task.lint_command, 'npm run lint');
  assert.deepEqual(task.dependencies, ['TECH-1']);
  assert.equal(task.classification, 'CURRENT_STACK_ONLY');
  assert.equal(task.priority, 'P1');
  assert.match(fs.readFileSync(path.join(fixture, 'tasks/backlog.md'), 'utf8'), /Refined task/);
});

test('update-task rejects invalid classes, unknown dependencies, self-dependencies, cycles and DONE edits atomically', () => {
  const cases = [
    ['TECH-2', '--classification', 'SOME_OTHER_CLASS'],
    ['TECH-2', '--priority', 'P9'],
    ['TECH-2', '--component', 'mobile'],
    ['TECH-2', '--unrecognized', 'value'],
    ['TECH-2', '--deps', 'MISSING-9'],
    ['TECH-2', '--deps', 'TECH-2'],
    ['TECH-1', '--deps', 'TECH-2'],
    ['TECH-3', '--title', 'Must remain frozen'],
  ];
  for (const args of cases) {
    const beforeState = snapshotAccounting();
    const result = run('scripts/update-task.mjs', ...args);
    assert.notEqual(result.status, 0, `expected rejection for ${args.join(' ')}`);
    assert.deepEqual(snapshotAccounting(), beforeState, `accounting changed after ${args.join(' ')}`);
  }
});

test('update-task can explicitly clear dependencies with an empty --deps value', () => {
  const result = run('scripts/update-task.mjs', 'TECH-2', '--deps', '');
  assert.equal(result.status, 0, result.stderr);
  const task = readJson('tasks/state.json').tasks.find(entry => entry.id === 'TECH-2');
  assert.deepEqual(task.dependencies, []);
});
