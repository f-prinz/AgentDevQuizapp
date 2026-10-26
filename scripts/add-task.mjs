import { loadState, writeState } from './lib/state-io.mjs';
import { writeBacklog } from './lib/backlog.mjs';
import { loadArchive } from './lib/state-io.mjs';
import { parseDependencies, validateTaskDefinition } from './lib/task-metadata.mjs';

// usage: add-task.mjs <TECH|BUG|CHG|FEAT-n> --component <c> --title "<t>"
//        [--ak "<acceptance>"] [--test "<command>"] [--lint "<command>"]
//        [--deps "A,B"] [--classification <class>] [--priority P0|P1|P2]
//        [--scope p]* [--tdd | --no-tdd]
const [id, ...rest] = process.argv.slice(2);
const match = /^(TECH|BUG|CHG|FEAT)-\d+$/.exec(id ?? '');
if (!match) {
  throw Error('Usage: add-task.mjs <TECH|BUG|CHG|FEAT-n> --component <c> --title "<t>" [--ak s] [--test s] [--lint s] [--deps "A,B"] [--classification <class>] [--priority P0|P1|P2] [--scope p]* [--tdd|--no-tdd] [--deps-change]');
}
const prefix = match[1];

const opts = { scope: [] };
for (let i = 0; i < rest.length; i++) {
  const flag = rest[i];
  const value = rest[i + 1];
  if (flag === '--scope' && value) { opts.scope.push(value); i++; }
  else if (flag === '--tdd') { opts.tdd = true; }
  else if (flag === '--no-tdd') { opts.tdd = false; }
  else if (flag === '--deps-change') { opts.depsChange = true; }
  else if (['--component', '--title', '--ak', '--test', '--lint', '--deps', '--classification', '--priority'].includes(flag) && value !== undefined) {
    if (value.startsWith('--')) throw Error(`Missing value for ${flag}`);
    opts[flag.slice(2)] = value; i++;
  } else {
    throw Error(`Unknown/incomplete flag ${flag}`);
  }
}

const state = loadState();
if (state.tasks.some(t => t.id === id)) throw Error(`Task ${id} existiert bereits`);
if (loadArchive().tasks?.some(t => t.id === id)) throw Error(`Task ${id} existiert bereits im Archiv`);
if (!opts.component || !opts.title?.trim()) throw Error('--component und ein nichtleerer --title sind Pflicht');
const dependencies = parseDependencies(opts.deps);

// TDD-Default: FEAT und BUG verlangen rote Evidence; CHG/TECH optional via --tdd.
const redRequired = opts.tdd ?? ['FEAT', 'BUG'].includes(prefix);

state.tasks.push({
  id,
  component: opts.component,
  title: opts.title,
  acceptance_criteria: opts.ak ?? '',
  test_command: opts.test ?? '',
  lint_command: opts.lint ?? null,
  red_evidence_required: redRequired,
  dependencies,
  ...(opts.classification ? { classification: opts.classification } : {}),
  ...(opts.priority ? { priority: opts.priority } : {}),
  status: 'TODO',
  fix_retries: 0,
  inventory_refs: [],
  ...(opts.depsChange ? { allows_dep_change: true } : {}),
  ...(opts.scope.length ? { allowed_paths: opts.scope } : {}),
});
validateTaskDefinition(state.tasks.at(-1), state, loadArchive().tasks ?? []);
writeState(state);
writeBacklog(state);
console.log(`${id} angelegt (TODO, ${opts.component}${redRequired ? ', TDD rot+gruen' : ''}${opts.lint ? ', lint' : ''})`);
