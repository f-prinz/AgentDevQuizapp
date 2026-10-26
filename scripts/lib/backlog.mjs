import fs from 'node:fs';
import { BACKLOG_FILE } from './state-io.mjs';

const esc = s =>
  String(s ?? '')
    .replaceAll('|', '\\|')
    .replaceAll('\r', ' ')
    .replaceAll('\n', ' ');

export function renderBacklog(state) {
  const showPlanningMetadata = (state.tasks ?? []).some(
    task => task.classification !== undefined || task.priority !== undefined
  );
  const lines = [
    '# Task Backlog',
    '',
    '<!-- Generiert aus tasks/state.json via node scripts/render-backlog.mjs. Nicht von Hand editieren. -->',
    '',
    showPlanningMetadata
      ? '| ID | Komponente | Klasse | Prioritaet | Aufgabe | Abhaengigkeiten | Akzeptanzkriterien | Testbefehl / Pruefung | Status |'
      : '| ID | Komponente | Aufgabe | Abhaengigkeiten | Akzeptanzkriterien | Testbefehl / Pruefung | Status |',
    showPlanningMetadata ? '|---|---|---|---|---|---|---|---|---|' : '|---|---|---|---|---|---|---|',
  ];
  for (const t of state.tasks ?? []) {
    const deps = (t.dependencies ?? []).join(', ') || 'keine';
    lines.push(
      showPlanningMetadata
        ? `| ${t.id} | ${esc(t.component)} | ${esc(t.classification ?? '')} | ${esc(t.priority ?? '')} | ${esc(t.title)} | ${esc(deps)} | ${esc(t.acceptance_criteria)} | ${esc(t.test_command)} | ${t.status} |`
        : `| ${t.id} | ${esc(t.component)} | ${esc(t.title)} | ${esc(deps)} | ${esc(t.acceptance_criteria)} | ${esc(t.test_command)} | ${t.status} |`
    );
  }
  lines.push(
    '',
    'DONE erfordert: gueltige Transition, Evidence-Datei aus scripts/record-check.mjs mit Exit-Code 0, reviewed_by != implemented_by (code_reviewer oder security_reviewer), erfuellte Abhaengigkeiten und bei FEAT/CHG/BUG mindestens einen INV-Eintrag. BLOCKED erfordert blocked_reason. Je Task maximal drei gezielte Fix-Retries (scripts/record-fix.mjs). Archivierte Tasks liegen in tasks/archive.json. Aktueller Datencheck: node scripts/check-state.mjs.',
    ''
  );
  return lines.join('\n');
}

export const writeBacklog = state =>
  fs.writeFileSync(BACKLOG_FILE, renderBacklog(state));
