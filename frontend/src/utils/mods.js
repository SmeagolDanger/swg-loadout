export function slugifyModTitle(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

export function splitModTags(value) {
  return String(value || '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function downloadZipName(mod) {
  const slug = slugifyModTitle(mod?.slug || mod?.title || 'mod-bundle') || 'mod-bundle';
  const version = String(mod?.version || 'bundle').trim();
  return `${slug}-${version}.zip`;
}
