import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';

// Selbsttest des Templates: baut einen Temp-Klon, initialisiert git + Hooks
// und faehrt den kompletten Task-Lebenszyklus inkl. aller Negativ-Gates.
// usage: node scripts/selftest.mjs

const ROOT = path.resolve(import.meta.dirname, '..');
const T = fs.mkdtempSync(path.join(os.tmpdir(), 'adt-selftest-'));
const R = `${T}-remote.git`;

let passed = 0;
const failures = [];

const run = (cmd, args) =>
  spawnSync(cmd, args, { cwd: T, encoding: 'utf8', shell: false });

const expect = (name, res, predicate) => {
  const code = res.status ?? 1;
  if (predicate(code, res)) {
    passed++;
    console.log(`  ok  ${name}`);
  } else {
    failures.push(name);
    const out = `${res.stdout ?? ''}${res.stderr ?? ''}`.trim().split('\n').slice(-10).join('\n      ');
    console.log(`FAIL  ${name} (exit ${code})\n      ${out}`);
  }
};

const nodeTest = (name, script, args = []) => {
  const res = run('node', [`scripts/${script}`, ...args]);
  expect(name, res, c => c === 0);
  return res;
};
const nodeFail = (name, script, args = [], match = null) => {
  const res = run('node', [`scripts/${script}`, ...args]);
  expect(name, res, c => c !== 0 && (match === null || `${res.stdout}${res.stderr}`.includes(match)));
};
const git = (...args) => execFileSync('git', args, { cwd: T, stdio: 'pipe', encoding: 'utf8' }).trim();
const commit = (name, shouldPass, msg = 't') => {
  const res = run('git', ['commit', '-m', msg]);
  expect(name, res, c => (shouldPass ? c === 0 : c !== 0));
};
const write = (file, content) => {
  const p = path.join(T, file);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
};
const evidenceFor = (taskId, pred) => {
  const dir = path.join(T, 'tasks/evidence');
  return fs.readdirSync(dir)
    .filter(f => f.startsWith(`${taskId}-`))
    .map(f => ({ f, ev: JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) }))
    .find(x => pred(x.ev))?.f;
};

try {
  // --- Setup -------------------------------------------------------------
  fs.cpSync(ROOT, T, {
    recursive: true,
    filter: src =>
      !/\.git([\\/]|$)|node_modules|tasks[\\/]evidence|tasks[\\/]reviews/.test(src),
  });
  // Keep the workflow fixture independent of the project's live task IDs and
  // metadata. The selftest creates FEAT-1/FEAT-2 and must remain repeatable.
  write('tasks/state.json', `${JSON.stringify({
    schema_version: 3,
    phase: 'planning',
    components: ['server', 'web'],
    tasks: [],
    blockers: [],
    last_updated_utc: null,
  }, null, 2)}\n`);
  write('tasks/inventory.json', `${JSON.stringify({ schema_version: 2, entries: [], last_updated_utc: null }, null, 2)}\n`);
  write('tasks/archive.json', `${JSON.stringify({ schema_version: 1, tasks: [] }, null, 2)}\n`);
  write('docs/progress.md', '# Fortschritt\n\nAktueller Stand: Keine Tasks. Historische Meldungen unten bleiben erhalten.\n');
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 't@t');
  git('config', 'user.name', 't');
  git('add', '-A');
  git('commit', '-qm', 'init');
  execFileSync('git', ['init', '-q', '--bare', R], { stdio: 'pipe' });

  console.log('== Basis-Checks ==');
  nodeTest('verify pristine', 'verify.mjs');
  nodeTest('render-backlog fixture', 'render-backlog.mjs');
  nodeTest('check-state pristine', 'check-state.mjs');
  nodeTest('check-inventory pristine', 'check-inventory.mjs');
  nodeTest('sync-main ohne Remote', 'sync-main.mjs');

  console.log('== Komponente + Tasks ==');
  nodeTest('add-component demo', 'add-component.mjs', ['demo', '--purpose', 'Test']);
  nodeTest('verify mit demo', 'verify.mjs');
  nodeTest('add-task FEAT-1', 'add-task.mjs', [
    'FEAT-1', '--component', 'demo', '--title', 'Sortierbar', '--ak', 'sortiert',
    '--test', 'node apps/demo/test.js', '--lint', 'node --check apps/demo/app.js',
  ]);
  nodeFail('add-task FEAT-1 Duplikat', 'add-task.mjs', ['FEAT-1', '--component', 'demo', '--title', 'x']);
  nodeTest('add-task FEAT-2 deps FEAT-1', 'add-task.mjs', ['FEAT-2', '--component', 'demo', '--title', 'dep', '--deps', 'FEAT-1', '--test', 'node apps/demo/test.js']);
  nodeTest('install-hooks', 'install-hooks.mjs');
  git('add', '-A');
  commit('commit: setup auf main', true, 'setup');

  console.log('== Transitionen + Deps ==');
  nodeFail('DONE aus TODO', 'update-task.mjs', ['FEAT-1', 'DONE']);
  nodeFail('IN_PROGRESS trotz offener Dep', 'update-task.mjs', ['FEAT-2', 'IN_PROGRESS']);
  nodeTest('FEAT-1 IN_PROGRESS', 'update-task.mjs', ['FEAT-1', 'IN_PROGRESS', '--by', 'demo_developer']);
  git('add', '-A');
  commit('commit: IN_PROGRESS auf main', true, 'inprog');

  console.log('== Branch-Workflow ==');
  nodeTest('branch-task FEAT-1', 'branch-task.mjs', ['FEAT-1']);
  expect('auf Branch FEAT-1', { status: git('branch', '--show-current') === 'FEAT-1' ? 0 : 1 }, c => c === 0);

  fs.appendFileSync(path.join(T, 'tasks/backlog.md'), 'x\n');
  git('add', 'tasks/backlog.md');
  commit('NEG: backlog auf Task-Branch', false);
  git('reset', '-q', 'HEAD', 'tasks/backlog.md');
  git('checkout', '--', 'tasks/backlog.md');

  git('checkout', '-qb', 'foo');
  write('apps/demo/x.js', '1');
  git('add', 'apps/demo/x.js');
  commit('NEG: Commit auf fremdem Branch', false);
  git('reset', '-q', 'HEAD', 'apps/demo/x.js');
  fs.rmSync(path.join(T, 'apps/demo/x.js'));
  git('checkout', '-q', 'FEAT-1');
  git('branch', '-D', 'foo');

  write('apps/demo/secret.js', 'const k = "-----BEGIN RSA PRIVATE KEY-----\\nabc";\n');
  git('add', 'apps/demo/secret.js');
  commit('NEG: Secret im Diff', false);
  git('reset', '-q', 'HEAD', 'apps/demo/secret.js');
  fs.rmSync(path.join(T, 'apps/demo/secret.js'));

  write('apps/demo/package.json', '{"name":"demo"}\n');
  git('add', 'apps/demo/package.json');
  commit('NEG: Manifest ohne --deps-change', false);
  git('reset', '-q', 'HEAD', 'apps/demo/package.json');
  fs.rmSync(path.join(T, 'apps/demo/package.json'));

  console.log('== TDD + Evidence ==');
  write('apps/demo/test.js', 'process.exit(1)\n');
  nodeFail('rote Evidence (exit!=0)', 'record-check.mjs', ['FEAT-1', '--', 'node', 'apps/demo/test.js']);
  git('add', 'apps/demo/test.js', 'tasks/evidence');
  commit('commit: roter Test + Evidence auf Branch', true);

  write('apps/demo/app.js', "console.log('ok')\n");
  write('apps/demo/test.js', 'process.exit(0)\n');
  nodeTest('gruene Evidence', 'record-check.mjs', ['FEAT-1', '--', 'node', 'apps/demo/test.js']);
  nodeTest('lint Evidence', 'record-check.mjs', ['FEAT-1', '--', 'node', '--check', 'apps/demo/app.js']);
  write('tasks/reviews/FEAT-1.md', '# Review FEAT-1\n\nkeine Findings\n');
  git('add', '-A');
  commit('commit: impl + Evidence + Review auf Branch', true);

  console.log('== Push + Merge ==');
  nodeTest('push-task ohne Remote (skip)', 'push-task.mjs', ['FEAT-1']);

  console.log('== DONE-Gates (vor Merge, auf Branch) ==');
  const green = evidenceFor('FEAT-1', e => e.exit_code === 0 && e.command.includes('test.js'));
  const red = evidenceFor('FEAT-1', e => e.exit_code !== 0);
  const lint = evidenceFor('FEAT-1', e => e.exit_code === 0 && e.command.includes('--check'));
  if (!green || !red || !lint) throw Error('Evidence-Dateien nicht gefunden');
  nodeFail('NEG: DONE ohne review_file', 'update-task.mjs', [
    'FEAT-1', 'DONE', '--test-evidence', `tasks/evidence/${green}`,
    '--red-evidence', `tasks/evidence/${red}`, '--lint-evidence', `tasks/evidence/${lint}`,
    '--reviewed-by', 'code_reviewer', '--review-result', 'ok',
    '--review-file', 'tasks/reviews/gibts-nicht.md',
  ]);
  nodeFail('NEG: DONE mit falscher Evidence', 'update-task.mjs', [
    'FEAT-1', 'DONE', '--test-evidence', `tasks/evidence/${lint}`,
    '--red-evidence', `tasks/evidence/${red}`, '--lint-evidence', `tasks/evidence/${lint}`,
    '--reviewed-by', 'code_reviewer', '--review-result', 'ok',
  ]);

  nodeTest('merge-task FEAT-1', 'merge-task.mjs', ['FEAT-1']);
  expect('Branch FEAT-1 geloescht', { status: git('branch', '--list', 'FEAT-1') === '' ? 0 : 1 }, c => c === 0);

  console.log('== Inventar + DONE ==');
  nodeTest('update-inventory INV-1', 'update-inventory.mjs', ['INV-1', '--capability', 'Sortierbar', '--component', 'demo', '--introduced-by', 'FEAT-1', '--anchor', 'test:apps/demo/test.js']);
  nodeTest('--add-inv INV-1', 'update-task.mjs', ['FEAT-1', '--add-inv', 'INV-1']);
  nodeTest('FEAT-1 DONE', 'update-task.mjs', [
    'FEAT-1', 'DONE', '--test-evidence', `tasks/evidence/${green}`,
    '--red-evidence', `tasks/evidence/${red}`, '--lint-evidence', `tasks/evidence/${lint}`,
    '--reviewed-by', 'code_reviewer', '--review-result', 'ok',
  ]);
  nodeTest('check-state nach DONE', 'check-state.mjs');
  nodeTest('check-inventory nach DONE', 'check-inventory.mjs');
  nodeFail('NEG: DONE -> TODO', 'update-task.mjs', ['FEAT-1', 'TODO']);

  console.log('== Merge-Konflikt-Prognose ==');
  nodeTest('add-task CHG-1', 'add-task.mjs', ['CHG-1', '--component', 'demo', '--title', 'Konflikt', '--test', 'node apps/demo/test.js']);
  nodeTest('CHG-1 IN_PROGRESS', 'update-task.mjs', ['CHG-1', 'IN_PROGRESS', '--by', 'demo_developer']);
  git('add', '-A');
  commit('commit: chg setup', true);
  nodeTest('branch-task CHG-1', 'branch-task.mjs', ['CHG-1']);
  write('apps/demo/app.js', "console.log('branch')\n");
  git('add', 'apps/demo/app.js');
  commit('commit: branch edit', true);
  git('checkout', '-q', 'main');
  write('apps/demo/app.js', "console.log('main')\n");
  git('add', 'apps/demo/app.js');
  commit('commit: main edit', true);
  nodeFail('NEG: merge-task bei Konflikt', 'merge-task.mjs', ['CHG-1'], 'KONFLIKT');
  git('checkout', '-q', 'CHG-1');
  try { git('merge', 'main'); } catch { /* Konflikt erwartet */ }
  write('apps/demo/app.js', "console.log('resolved')\n");
  git('add', 'apps/demo/app.js');
  git('commit', '-qm', 'resolve');
  nodeTest('merge-task nach Aufloesung', 'merge-task.mjs', ['CHG-1']);

  console.log('== Remote-Push ==');
  git('remote', 'add', 'origin', R);
  nodeTest('add-task CHG-2', 'add-task.mjs', ['CHG-2', '--component', 'demo', '--title', 'Push', '--test', 'node apps/demo/test.js']);
  nodeTest('CHG-2 IN_PROGRESS', 'update-task.mjs', ['CHG-2', 'IN_PROGRESS', '--by', 'demo_developer']);
  git('add', '-A');
  commit('commit: chg2 setup', true);
  nodeTest('branch-task CHG-2', 'branch-task.mjs', ['CHG-2']);
  write('apps/demo/y.js', '1\n');
  git('add', 'apps/demo/y.js');
  commit('commit: chg2 work', true);
  nodeTest('push-task mit Remote', 'push-task.mjs', ['CHG-2']);
  nodeTest('merge-task CHG-2 --keep', 'merge-task.mjs', ['CHG-2', '--keep']);
  expect('Branch CHG-2 behalten (--keep)', { status: git('branch', '--list', 'CHG-2') === 'CHG-2' ? 0 : 1 }, c => c === 0);

  console.log('== CHG ohne TDD/Lint (nur gruene Evidence) ==');
  nodeTest('CHG-2 gruene Evidence', 'record-check.mjs', ['CHG-2', '--', 'node', 'apps/demo/test.js']);
  write('tasks/reviews/CHG-2.md', '# Review CHG-2\n\nkeine Findings\n');
  nodeTest('update-inventory INV-2', 'update-inventory.mjs', ['INV-2', '--capability', 'Push-Test', '--component', 'demo', '--introduced-by', 'CHG-2', '--anchor', 'file:apps/demo/y.js']);
  nodeTest('--add-inv INV-2', 'update-task.mjs', ['CHG-2', '--add-inv', 'INV-2']);
  const green2 = evidenceFor('CHG-2', e => e.exit_code === 0);
  nodeTest('CHG-2 DONE ohne rot/lint', 'update-task.mjs', [
    'CHG-2', 'DONE', '--test-evidence', `tasks/evidence/${green2}`,
    '--reviewed-by', 'code_reviewer', '--review-result', 'ok',
  ]);

  console.log('== Archiv + Abschluss ==');
  nodeFail('NEG: Archiv von FEAT-1 blockiert (FEAT-2 dep)', 'archive-tasks.mjs', ['FEAT-1'], 'referenziert');
  nodeTest('archive-tasks CHG-2', 'archive-tasks.mjs', ['CHG-2']);
  nodeTest('check-state final', 'check-state.mjs');
  nodeTest('check-inventory final', 'check-inventory.mjs');
} finally {
  console.log(`\n${passed} Tests bestanden, ${failures.length} fehlgeschlagen`);
  if (failures.length) console.log(`Fehlgeschlagen: ${failures.join(', ')}`);
  fs.rmSync(T, { recursive: true, force: true });
  fs.rmSync(R, { recursive: true, force: true });
  process.exit(failures.length ? 1 : 0);
}
