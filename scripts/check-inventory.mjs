import fs from 'node:fs';
import assert from 'node:assert/strict';
import { loadState, loadArchive, loadInventory, allTasksIndex } from './lib/state-io.mjs';

const state = loadState();
const archive = loadArchive();
const inventory = loadInventory();
assert.equal(inventory.schema_version, 2, 'Unknown inventory schema_version');

const components = new Set(state.components ?? []);
const taskById = allTasksIndex(state, archive);
const anchorTypes = new Set(['test', 'route', 'file', 'ui_step']);

const ids = new Set();
const warnings = [];

const routeNeedle = ref => {
  const m = ref.match(/^(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(\S+)/i);
  return m ? m[1] : ref;
};

const fileContains = (file, needle) => {
  if (!fs.existsSync(file)) return null;
  const stat = fs.statSync(file);
  if (stat.size > 4 * 1024 * 1024) return false;
  try {
    return fs.readFileSync(file, 'utf8').includes(needle);
  } catch {
    return false;
  }
};

for (const entry of inventory.entries ?? []) {
  assert.ok(/^INV-\d+$/.test(entry.id ?? ''), `Invalid entry id ${entry.id}`);
  assert.ok(!ids.has(entry.id), `Duplicate entry id ${entry.id}`);
  ids.add(entry.id);
  assert.ok(entry.capability, `${entry.id}: missing capability`);
  assert.ok(entry.component && components.has(entry.component), `${entry.id}: unknown component ${entry.component}`);
  assert.ok(['active', 'removed'].includes(entry.status), `${entry.id}: invalid status`);
  assert.ok(Array.isArray(entry.anchors), `${entry.id}: anchors must be an array`);

  const introTask = taskById.get(entry.introduced_by);
  assert.ok(introTask, `${entry.id}: unknown introduced_by ${entry.introduced_by}`);
  assert.ok((introTask.inventory_refs ?? []).includes(entry.id), `${entry.id}: not listed in ${entry.introduced_by}.inventory_refs`);

  if (entry.status === 'removed') {
    const remTask = taskById.get(entry.removed_by);
    assert.ok(remTask, `${entry.id}: removed without valid removed_by`);
    assert.ok((remTask.inventory_refs ?? []).includes(entry.id), `${entry.id}: not listed in ${entry.removed_by}.inventory_refs`);
  } else {
    assert.ok(entry.removed_by == null, `${entry.id}: active entry must not have removed_by`);
  }

  for (const anchor of entry.anchors) {
    assert.ok(anchorTypes.has(anchor.type), `${entry.id}: invalid anchor type ${anchor.type}`);
    assert.ok(anchor.ref, `${entry.id}: anchor without ref`);
    if (anchor.type === 'file' || anchor.type === 'test') {
      const exists = fs.existsSync(anchor.ref);
      if (entry.status === 'active') assert.ok(exists, `${entry.id}: anchor missing ${anchor.ref}`);
      else assert.ok(!exists, `${entry.id}: removed entry but anchor still exists ${anchor.ref}`);
    } else if (anchor.type === 'route') {
      assert.ok(anchor.file, `${entry.id}: route anchor without file (erwartet: "route:<file>::<METHOD PATH>")`);
      const found = fileContains(anchor.file, routeNeedle(anchor.ref));
      if (entry.status === 'active') {
        assert.ok(found !== null, `${entry.id}: route anchor file missing ${anchor.file}`);
        assert.ok(found, `${entry.id}: route not found in ${anchor.file}: ${anchor.ref}`);
      } else {
        assert.ok(found !== true, `${entry.id}: removed entry but route still found in ${anchor.file}: ${anchor.ref}`);
      }
    } else {
      warnings.push(`${entry.id}: ui_step anchor not mechanically verifiable (${anchor.ref})`);
    }
  }
}

for (const task of state.tasks) {
  for (const ref of task.inventory_refs ?? []) {
    assert.ok(ids.has(ref), `${task.id}: unknown inventory ref ${ref}`);
  }
  const prefix = task.id.split('-')[0];
  if (task.status === 'DONE' && ['FEAT', 'CHG', 'BUG'].includes(prefix)) {
    assert.ok((task.inventory_refs ?? []).length > 0, `${task.id}: DONE without inventory_refs`);
  }
}

for (const w of warnings) console.warn(`WARN: ${w}`);
console.log(`OK: ${ids.size} inventory entries; anchors, task references and components consistent.`);
