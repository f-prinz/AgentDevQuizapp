import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const [taskId, ...rest] = process.argv.slice(2);
const sep = rest.indexOf('--');
if (!/^([A-Z]+)-\d+$/.test(taskId ?? '') || sep < 0 || sep === rest.length - 1) {
  throw Error('Usage: record-check.mjs <TASK-ID> -- <command...>');
}
const command = rest.slice(sep + 1).join(' ');

const started = new Date();
const res = spawnSync(command, { shell: true, encoding: 'utf8', cwd: process.cwd() });
const finished = new Date();
const exitCode = res.status ?? (res.error ? 1 : 0);

if (res.stdout) process.stdout.write(res.stdout);
if (res.stderr) process.stderr.write(res.stderr);
if (res.error) console.error(`Spawn-Fehler: ${res.error.message}`);

const tail = s => (s ?? '').slice(-8000);
const rec = {
  task_id: taskId,
  command,
  exit_code: exitCode,
  stdout_tail: tail(res.stdout),
  stderr_tail: tail(res.stderr),
  started: started.toISOString(),
  finished: finished.toISOString(),
  cwd: process.cwd(),
};

fs.mkdirSync('tasks/evidence', { recursive: true });
const file = `tasks/evidence/${taskId}-${started.toISOString().replace(/[:.]/g, '-')}.json`;
fs.writeFileSync(file, `${JSON.stringify(rec, null, 2)}\n`);
console.log(`\nEvidence: ${file} (exit ${exitCode})`);
process.exit(exitCode);
