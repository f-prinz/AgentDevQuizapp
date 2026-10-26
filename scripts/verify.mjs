import fs from 'node:fs';
import { loadState } from './lib/state-io.mjs';

// Strukturpruefung des Multi-Agent-Setups. Erwartete Basisbesetzung:
// 14 Basis-Agents + je 2 Komponenten-Agents pro Eintrag in state.components.
const BASE_AGENTS = [
  'analyst',
  'analyst_validator',
  'software_architect',
  'database_engineer',
  'technical_planner',
  'integration_engineer',
  'code_reviewer',
  'e2e_tester',
  'security_reviewer',
  'bug_reproducer',
  'local_environment',
  'system_validator',
  'documentation_agent',
  'scope_auditor',
];

const REQUIRED_FILES = ['AGENTS.md', '.codex/config.toml', 'docs/project-idea.md', 'docs/start-prompt.md'];

const errors = [];
const err = m => errors.push(m);

for (const f of REQUIRED_FILES) if (!fs.existsSync(f)) err(`Fehlt: ${f}`);

const config = fs.existsSync('.codex/config.toml') ? fs.readFileSync('.codex/config.toml', 'utf8') : '';
const registered = new Map(); // agent name -> config_file
let current = null;
for (const line of config.split('\n')) {
  const m = line.match(/^\[agents\.([\w]+)\]/);
  if (m) { current = m[1]; continue; }
  const cf = line.match(/^config_file\s*=\s*"([^"]+)"/);
  if (cf && current) registered.set(current, cf[1]);
}
const onDisk = fs.existsSync('.codex/agents')
  ? fs.readdirSync('.codex/agents').filter(f => f.endsWith('.toml')).map(f => `agents/${f}`)
  : [];

for (const [name, file] of registered) {
  if (!fs.existsSync(`.codex/${file}`)) err(`Agent ${name}: config_file ${file} fehlt`);
}
for (const file of onDisk) {
  if (![...registered.values()].includes(file)) err(`Datei .codex/${file} ist nicht in config.toml registriert`);
}
for (const base of BASE_AGENTS) {
  if (!registered.has(base)) err(`Basis-Agent ${base} nicht in config.toml registriert`);
}

const state = loadState();
const components = state.components ?? [];
const techStack = fs.existsSync('docs/tech-stack.md') ? fs.readFileSync('docs/tech-stack.md', 'utf8') : '';
const agentContext = fs.existsSync('docs/agent-context.md') ? fs.readFileSync('docs/agent-context.md', 'utf8') : '';

for (const c of components) {
  for (const role of ['developer', 'test_engineer']) {
    const agent = `${c}_${role}`;
    if (!registered.has(agent)) err(`Komponente ${c}: Agent ${agent} nicht in config.toml registriert`);
    else if (!fs.existsSync(`apps/${c}`)) err(`Komponente ${c}: Verzeichnis apps/${c}/ fehlt`);
  }
  if (!techStack.includes(`| ${c} |`)) err(`Komponente ${c}: keine Zeile in docs/tech-stack.md Matrix`);
  if (!agentContext.includes(`| ${c} |`)) err(`Komponente ${c}: keine Zeile in docs/agent-context.md Tabelle`);
}

const expected = BASE_AGENTS.length + 2 * components.length;
if (registered.size !== expected) {
  err(`Agent-Anzahl: ${registered.size} registriert, erwartet ${expected} (${BASE_AGENTS.length} Basis + 2 x ${components.length} Komponenten)`);
}

if (errors.length) {
  for (const e of errors) console.error(`FEHLER: ${e}`);
  process.exit(1);
}
console.log(`OK: ${registered.size} Agents (${BASE_AGENTS.length} Basis + ${2 * components.length} Komponenten), ${components.length} Komponenten, Struktur konsistent.`);
