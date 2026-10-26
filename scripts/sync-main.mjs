import { isGitRepo, syncMain } from './lib/gitflow.mjs';

// Session-Start / vor Task-Branch: main auf Remote-Stand (fast-forward only).
if (!isGitRepo()) {
  console.log('Kein Git-Repo — Sync uebersprungen.');
  process.exit(0);
}
const r = syncMain();
if (r.diverged) {
  console.error(`SYNC FEHLGESCHLAGEN: ${r.reason}`);
  process.exit(1);
}
console.log(`main: ${r.synced ? `synchron (${r.reason})` : `nicht synchronisiert — ${r.reason}`}`);
