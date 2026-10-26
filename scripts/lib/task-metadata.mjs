export const TASK_CLASSIFICATIONS = new Set([
  'CURRENT_STACK_ONLY',
  'TARGET_ALIGNED',
  'REQUIRES_MIGRATION',
]);

export const TASK_PRIORITIES = new Set(['P0', 'P1', 'P2']);

export function parseDependencies(value = '') {
  const dependencies = value.split(',').map(item => item.trim()).filter(Boolean);
  if (new Set(dependencies).size !== dependencies.length) {
    throw Error('Dependencies duerfen nicht doppelt vorkommen');
  }
  return dependencies;
}

export function validateTaskDefinition(task, state, archivedTasks = []) {
  if (typeof task.title !== 'string' || !task.title.trim()) {
    throw Error(`${task.id}: title darf nicht leer sein`);
  }
  const components = new Set([...(state.components ?? []), 'contracts']);
  if (!components.has(task.component)) {
    throw Error(`Unbekannte Komponente ${task.component} (deklariert: ${(state.components ?? []).join(', ')}, contracts)`);
  }
  if (task.classification !== undefined && !TASK_CLASSIFICATIONS.has(task.classification)) {
    throw Error(`Ungueltige Klassifikation ${task.classification}`);
  }
  if (task.priority !== undefined && !TASK_PRIORITIES.has(task.priority)) {
    throw Error(`Ungueltige Prioritaet ${task.priority}`);
  }

  const tasks = [...(state.tasks ?? []), ...archivedTasks];
  const byId = new Map(tasks.map(entry => [entry.id, entry]));
  for (const dependency of task.dependencies ?? []) {
    if (dependency === task.id) throw Error(`${task.id} darf nicht von sich selbst abhaengen`);
    if (!byId.has(dependency)) throw Error(`Unbekannte Abhaengigkeit ${dependency}`);
  }
  byId.set(task.id, task);

  const visiting = new Set();
  const visited = new Set();
  const visit = id => {
    if (visiting.has(id)) throw Error(`Dependency cycle at ${id}`);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of byId.get(id)?.dependencies ?? []) {
      if (byId.has(dependency)) visit(dependency);
    }
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of byId.keys()) visit(id);
}
