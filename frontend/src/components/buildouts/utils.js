export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function toRadians(value) {
  return (value * Math.PI) / 180;
}

export function formatCoord(value) {
  return Number(value || 0).toFixed(1);
}

export function projectIsoPoint(coordinates, camera, scale = 1) {
  const [x, y, z] = coordinates;
  const cosYaw = Math.cos(camera.yaw);
  const sinYaw = Math.sin(camera.yaw);
  const cosPitch = Math.cos(camera.pitch);
  const sinPitch = Math.sin(camera.pitch);

  const yawX = x * cosYaw - z * sinYaw;
  const yawZ = x * sinYaw + z * cosYaw;

  const pitchY = y * cosPitch - yawZ * sinPitch;
  const pitchZ = y * sinPitch + yawZ * cosPitch;

  return {
    x: yawX * scale,
    y: pitchY * scale,
    depth: pitchZ,
    scale: clamp(0.72 + ((pitchZ + 8160) / 16320) * 0.52, 0.72, 1.26),
  };
}

export async function copyText(value, label, setToast) {
  if (!value) return;

  try {
    await navigator.clipboard.writeText(value);
    setToast(`${label} copied`);
  } catch {
    setToast(`Could not copy ${label.toLowerCase()}`);
  }
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
