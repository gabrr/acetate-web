const key = 'acetate-web-0.1.runs';

export function loadHistory(storage) {
  const saved = storage.getItem(key);
  if (!saved) return [];
  const data = JSON.parse(saved);
  if (data.schema !== 1 || !Array.isArray(data.groups) || data.groups.some(group =>
    typeof group.id !== 'string' || !Array.isArray(group.versions) || group.versions.some(run =>
      typeof run.id !== 'string' || run.file?.name !== group.id || !Array.isArray(run.steps)))) {
    throw new Error('Saved runs could not be read.');
  }
  return data.groups;
}

export function saveRun(groups, run, storage) {
  let group = groups.find(value => value.id === run.file.name);
  if (!group) {
    group = { id: run.file.name, versions: [] };
    groups.push(group);
  }
  const index = group.versions.findIndex(value => value.id === run.id);
  if (index === -1) group.versions.push(run);
  else group.versions[index] = run;
  storage.setItem(key, JSON.stringify({ schema: 1, groups }));
}
