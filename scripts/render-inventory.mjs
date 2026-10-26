import fs from 'node:fs';

const inventory = JSON.parse(fs.readFileSync('tasks/inventory.json', 'utf8'));
const esc = s => String(s ?? '').replaceAll('|', '\\|');

const lines = [
  '# Funktionsinventar',
  '',
  '<!-- Generiert aus tasks/inventory.json via node scripts/render-inventory.mjs. Nicht von Hand editieren. -->',
  '',
  '| ID | Faehigkeit | Komponente | Status | Nachweise | Eingefuehrt | Entfernt |',
  '|---|---|---|---|---|---|---|',
];

for (const e of (inventory.entries ?? []).slice().sort((a, b) => a.id.localeCompare(b.id))) {
  const anchors = (e.anchors ?? [])
    .map(a => (a.type === 'route' ? `route: \`${esc(a.ref)}\` in \`${esc(a.file)}\`` : `${a.type}: \`${esc(a.ref)}\``))
    .join('<br>') || '-';
  lines.push(`| ${e.id} | ${esc(e.capability)} | ${esc(e.component)} | ${e.status === 'active' ? 'aktiv' : 'entfernt'} | ${anchors} | ${e.introduced_by ?? '-'} | ${e.removed_by ?? '-'} |`);
}

lines.push('', `Stand: ${inventory.last_updated_utc ?? 'nie aktualisiert'}`, '');
fs.writeFileSync('docs/feature-inventory.md', lines.join('\n'));
console.log(`docs/feature-inventory.md aktualisiert (${inventory.entries?.length ?? 0} Eintraege).`);
