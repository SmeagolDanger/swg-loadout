export function formatCoord(value) {
  return Number(value || 0).toFixed(1);
}

export function projectPoint(point, axes, size, padding, bounds) {
  const [axisX, axisY] = axes;
  const span = bounds.max - bounds.min || 1;
  const usable = size - padding * 2;
  const scale = usable / span;
  const x = padding + (point[axisX] - bounds.min) * scale;
  const y = size - padding - (point[axisY] - bounds.min) * scale;
  return [x, y];
}

export async function copyText(value, label, setToast) {
  if (!value) return;
  await navigator.clipboard.writeText(value);
  setToast(`${label} copied`);
}

export function getSearchText(spawn) {
  return [
    spawn.name,
    spawn.spawner_type,
    spawn.behavior,
    ...(spawn.ships || []),
  ]
    .join(' ')
    .toLowerCase();
}
