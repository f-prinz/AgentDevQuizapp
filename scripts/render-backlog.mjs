import { loadState } from './lib/state-io.mjs';
import { writeBacklog } from './lib/backlog.mjs';

const state = loadState();
writeBacklog(state);
console.log(`tasks/backlog.md aktualisiert (${state.tasks?.length ?? 0} Tasks).`);
