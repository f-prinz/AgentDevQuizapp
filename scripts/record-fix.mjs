import fs from 'node:fs';
import { loadState, writeState, PROGRESS_FILE } from './lib/state-io.mjs';

const [id, diagnosis] = process.argv.slice(2);
const state = loadState();
const task = state.tasks.find(t => t.id === id);
if (!task || !diagnosis || task.fix_retries >= 3) throw Error('Invalid fix record or retry limit');
task.fix_retries++;
writeState(state);
fs.appendFileSync(PROGRESS_FILE, `\n${state.last_updated_utc}: ${id} Fix-Retry ${task.fix_retries}/3. ${diagnosis}\n`);
console.log(`${id}: Fix-Retry ${task.fix_retries}/3`);
