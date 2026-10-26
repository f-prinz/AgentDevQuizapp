import fs from 'node:fs';
import { loadState, writeState } from './lib/state-io.mjs';

// usage: add-component.mjs <name> [--purpose "<text>"]
const [name, ...rest] = process.argv.slice(2);
if (!/^[a-z][a-z0-9-]*$/.test(name ?? '')) {
  throw Error('Usage: add-component.mjs <name> [--purpose "<text>"]  (name: [a-z][a-z0-9-]*)');
}
let purpose = 'TODO';
for (let i = 0; i < rest.length; i += 2) {
  if (rest[i] === '--purpose' && rest[i + 1]) purpose = rest[i + 1];
  else throw Error(`Unknown/incomplete flag ${rest[i]}`);
}

const dir = `apps/${name}`;
const devFile = `.codex/agents/${name}-developer.toml`;
const testFile = `.codex/agents/${name}-test-engineer.toml`;
const TECH_MARKER = '| <!-- <name> | apps/<name>/ | <zweck> | OFFEN --> |';
const CTX_MARKER = '| <!-- <name> | apps/<name>/ | <build> | <test> | <lint> | <run> | <name>_developer | <name>_test_engineer --> |';

// Alle Vorbedingungen pruefen, bevor irgendetwas geschrieben wird.
const state = loadState();
if ((state.components ?? []).includes(name)) throw Error(`Komponente ${name} existiert bereits in state.json`);
for (const f of [devFile, testFile]) if (fs.existsSync(f)) throw Error(`Datei existiert bereits: ${f}`);
for (const f of ['docs/templates/component-developer.toml', 'docs/templates/component-test-engineer.toml']) {
  if (!fs.existsSync(f)) throw Error(`Template fehlt: ${f}`);
}
const techStack = fs.readFileSync('docs/tech-stack.md', 'utf8');
if (!techStack.includes(TECH_MARKER)) throw Error('Platzhalterzeile in docs/tech-stack.md Matrix nicht gefunden');
const ctx = fs.readFileSync('docs/agent-context.md', 'utf8');
if (!ctx.includes(CTX_MARKER)) throw Error('Platzhalterzeile in docs/agent-context.md Tabelle nicht gefunden');

const fill = src =>
  src.replaceAll('<KOMPONENTE>', name).replaceAll('<VERZEICHNIS>', `${dir}/`);
fs.writeFileSync(devFile, fill(fs.readFileSync('docs/templates/component-developer.toml', 'utf8')));
fs.writeFileSync(testFile, fill(fs.readFileSync('docs/templates/component-test-engineer.toml', 'utf8')));

fs.appendFileSync(
  '.codex/config.toml',
  `\n[agents.${name}_developer]\ndescription = "Implementiert die Komponente ${name} in ${dir}/"\nconfig_file = "agents/${name}-developer.toml"\n\n[agents.${name}_test_engineer]\ndescription = "Testet die Komponente ${name} in ${dir}/"\nconfig_file = "agents/${name}-test-engineer.toml"\n`
);

fs.writeFileSync(
  'docs/tech-stack.md',
  techStack.replace(TECH_MARKER, `${TECH_MARKER}\n| ${name} | ${dir}/ | ${purpose} | OFFEN |`)
);
fs.writeFileSync(
  'docs/agent-context.md',
  ctx.replace(CTX_MARKER, `${CTX_MARKER}\n| ${name} | ${dir}/ | - | - | - | - | ${name}_developer | ${name}_test_engineer |`)
);

state.components = [...(state.components ?? []), name];
writeState(state);
fs.mkdirSync(dir, { recursive: true });

console.log(`Komponente ${name} angelegt:`);
console.log(`  ${devFile}, ${testFile}`);
console.log(`  config.toml: [agents.${name}_developer], [agents.${name}_test_engineer]`);
console.log(`  state.json.components, tech-stack.md Matrix, agent-context.md Tabelle, ${dir}/`);
console.log(`Naechste Schritte: Stack-Sektion in docs/tech-stack.md fuellen und freigeben, danach node scripts/verify.mjs`);
