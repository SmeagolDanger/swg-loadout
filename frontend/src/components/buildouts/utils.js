export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function formatCoord(value) {
  return Number(value || 0).toFixed(1);
}

export function getSpawnCoords(spawn) {
  if (Array.isArray(spawn?.coordinates) && spawn.coordinates.length >= 3) {
    return spawn.coordinates;
  }
  return [Number(spawn?.x || 0), Number(spawn?.y || 0), Number(spawn?.z || 0)];
}

export function projectMapPoint(point, size, padding, bounds) {
  const safePoint = Array.isArray(point) ? point : [0, 0, 0];
  const span = bounds.max - bounds.min || 1;
  const usable = size - padding * 2;
  const x = padding + ((safePoint[0] - bounds.min) / span) * usable;
  const y = size - padding - ((safePoint[2] - bounds.min) / span) * usable;
  return [x, y];
}

export async function copyText(value, label, setToast) {
  if (!value) return;
  await navigator.clipboard.writeText(value);
  setToast(`${label} copied`);
}

export function getSearchText(spawn) {
  return [spawn.name, spawn.spawner_type, spawn.behavior, ...(spawn.ships || [])]
    .join(' ')
    .toLowerCase();
}

export function joinSelectedWaypoints(spawns) {
  return (spawns || []).map((spawn) => spawn.waypoint).filter(Boolean).join('');
}
