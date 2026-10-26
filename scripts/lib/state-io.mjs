import fs from 'node:fs';

export const STATE_FILE = 'tasks/state.json';
export const INVENTORY_FILE = 'tasks/inventory.json';
export const ARCHIVE_FILE = 'tasks/archive.json';
export const BACKLOG_FILE = 'tasks/backlog.md';
export const PROGRESS_FILE = 'docs/progress.md';

export const loadJson = p => JSON.parse(fs.readFileSync(p, 'utf8'));

export const loadState = () => loadJson(STATE_FILE);
export const loadInventory = () => loadJson(INVENTORY_FILE);
export const loadArchive = () =>
  fs.existsSync(ARCHIVE_FILE)
    ? loadJson(ARCHIVE_FILE)
    : { schema_version: 1, tasks: [] };

export function writeJsonAtomic(file, obj) {
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, `${JSON.stringify(obj, null, 2)}\n`);
  fs.renameSync(tmp, file);
}

export const writeState = state => {
  state.last_updated_utc = new Date().toISOString();
  writeJsonAtomic(STATE_FILE, state);
};

export const writeInventory = inventory => {
  inventory.last_updated_utc = new Date().toISOString();
  writeJsonAtomic(INVENTORY_FILE, inventory);
};

export const writeArchive = archive => writeJsonAtomic(ARCHIVE_FILE, archive);

export const taskIndex = state => new Map(state.tasks.map(t => [t.id, t]));

export const allTasksIndex = (state, archive) => {
  const map = taskIndex(state);
  for (const t of archive.tasks ?? []) if (!map.has(t.id)) map.set(t.id, t);
  return map;
};
