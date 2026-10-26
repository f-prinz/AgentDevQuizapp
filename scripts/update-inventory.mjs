import { loadState, loadArchive, loadInventory, writeInventory } from './lib/state-io.mjs';

const usage =
  'Usage: update-inventory.mjs INV-xxx [--capability s] [--component c] [--status active|removed] [--anchor type:ref]* [--anchor "route:<file>::<METHOD PATH>"] [--introduced-by TASK] [--removed-by TASK] [--notes s]';

const [id, ...rest] = process.argv.slice(2);
if (!/^INV-\d+$/.test(id ?? '')) throw Error(usage);

const state = loadState();
const archive = loadArchive();
const inventory = loadInventory();
const components = new Set(state.components ?? []);
const taskIds = new Set([...(state.tasks ?? []), ...(archive.tasks ?? [])].map(t => t.id));
const anchorTypes = new Set(['test', 'route', 'file', 'ui_step']);

const parseAnchor = value => {
  const sep = value.indexOf(':');
  const type = value.slice(0, sep);
  const body = value.slice(sep + 1);
  if (!anchorTypes.has(type) || !body) throw Error(`Invalid anchor "${value}" (expected type:ref)`);
  if (type === 'route') {
    const idx = body.indexOf('::');
    if (idx <= 0 || idx === body.length - 2) {
      throw Error(`Route anchor needs file and ref: "route:<file>::<METHOD PATH>" (got "${value}")`);
    }
    return { type, file: body.slice(0, idx), ref: body.slice(idx + 2) };
  }
  return { type, ref: body };
};

const opts = { anchors: [] };
for (let i = 0; i < rest.length; i += 2) {
  const [flag, value] = [rest[i], rest[i + 1]];
  if (value === undefined) throw Error(`Missing value for ${flag}`);
  if (flag === '--anchor') {
    opts.anchors.push(parseAnchor(value));
  } else if (['--capability', '--component', '--status', '--introduced-by', '--removed-by', '--notes'].includes(flag)) {
    opts[flag.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
  } else {
    throw Error(`Unknown flag ${flag}`);
  }
}

let entry = inventory.entries.find(e => e.id === id);
if (!entry) {
  entry = { id, capability: null, component: null, status: 'active', anchors: [], introduced_by: null, removed_by: null, notes: '' };
  inventory.entries.push(entry);
}

if (opts.capability !== undefined) entry.capability = opts.capability;
if (opts.component !== undefined) {
  if (!components.has(opts.component)) throw Error(`Unknown component ${opts.component}`);
  entry.component = opts.component;
}
if (opts.status !== undefined) {
  if (!['active', 'removed'].includes(opts.status)) throw Error('Invalid status');
  entry.status = opts.status;
}
for (const a of opts.anchors) {
  const same = x => x.type === a.type && x.ref === a.ref && (x.file ?? null) === (a.file ?? null);
  if (!entry.anchors.some(same)) entry.anchors.push(a);
}
if (opts.introducedBy !== undefined) {
  if (!taskIds.has(opts.introducedBy)) throw Error(`Unknown task ${opts.introducedBy}`);
  entry.introduced_by = opts.introducedBy;
}
if (opts.removedBy !== undefined) {
  if (!taskIds.has(opts.removedBy)) throw Error(`Unknown task ${opts.removedBy}`);
  entry.removed_by = opts.removedBy;
}
if (opts.notes !== undefined) entry.notes = opts.notes;

if (entry.status === 'removed' && !entry.removed_by) throw Error(`${id}: status removed requires --removed-by`);
if (entry.status === 'active') entry.removed_by = null;
if (!entry.capability || !entry.component) throw Error(`${id}: entry incomplete (capability/component required)`);

writeInventory(inventory);
console.log(`${id}: ${entry.status} (${entry.component}) - ${entry.capability}`);
for (const ref of [entry.introduced_by, entry.removed_by].filter(Boolean)) {
  const task = state.tasks.find(t => t.id === ref);
  if (task && !(task.inventory_refs ?? []).includes(id)) {
    console.log(`HINWEIS: ${id} ist nicht in ${ref}.inventory_refs — verlinken via: node scripts/update-task.mjs ${ref} --add-inv ${id}`);
  }
}
