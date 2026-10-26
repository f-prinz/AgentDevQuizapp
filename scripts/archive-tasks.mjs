import fs from 'node:fs';
import { loadState, loadArchive, writeState, writeArchive, PROGRESS_FILE } from './lib/state-io.mjs';
import { writeBacklog } from './lib/backlog.mjs';

// Verschiebt DONE-Tasks nach tasks/archive.json. inventory_refs / introduced_by
// bleiben ueber die Archiv-Lookup-Logik in check-inventory.mjs aufloesbar.
const ids = process.argv.slice(2).filter(a => !a.startsWith('--'));
const state = loadState();
const archive = loadArchive();

const done = state.tasks.filter(t => t.status === 'DONE');
const toMove = ids.length ? done.filter(t => ids.includes(t.id)) : done;
const missing = ids.filter(i => !toMove.some(t => t.id === i));
if (missing.length) throw Error(`Nicht archivierbar (unbekannt oder nicht DONE): ${missing.join(', ')}`);
if (!toMove.length) {
  console.log('Nichts zu archivieren.');
  process.exit(0);
}

const activeDeps = new Set(state.tasks.filter(t => t.status !== 'DONE').flatMap(t => t.dependencies ?? []));
const blocked = toMove.filter(t => activeDeps.has(t.id));
if (blocked.length) {
  throw Error(`Tasks werden noch von aktiven Tasks referenziert: ${blocked.map(t => t.id).join(', ')}`);
}

const moveIds = new Set(toMove.map(t => t.id));
archive.tasks.push(...toMove);
state.tasks = state.tasks.filter(t => !moveIds.has(t.id));
state.phase = state.tasks.every(t => t.status === 'DONE') ? 'complete' : 'development';
state.blockers = state.tasks.filter(t => t.status === 'BLOCKED').map(t => ({ task_id: t.id, reason: t.blocked_reason }));

writeArchive(archive);
writeState(state);
writeBacklog(state);
fs.appendFileSync(PROGRESS_FILE, `\n${state.last_updated_utc}: Archiviert: ${[...moveIds].join(', ')}\n`);
console.log(`Archiviert: ${[...moveIds].join(', ')} (${state.tasks.length} verbleiben)`);
