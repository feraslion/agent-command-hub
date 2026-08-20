export const MAX_MANUAL_MULTI_FILE_SELECTION = 24;

export function isEligibleMultiFilePath(path: string) {
  return /^(?:source|tests)\/.+\.(?:ts|mts|cts)$/u.test(path);
}

export function toggleMultiFileSelection(paths: string[], path: string) {
  if (!isEligibleMultiFilePath(path)) return paths;
  if (paths.includes(path)) return paths.filter((item) => item !== path);
  if (paths.length >= MAX_MANUAL_MULTI_FILE_SELECTION) return paths;
  return [...paths, path];
}

export function hasValidManualMultiFileBundle(entryPath: string | null, paths: string[]) {
  return Boolean(entryPath && paths.length >= 2 && paths.includes(entryPath) && isEligibleMultiFilePath(entryPath));
}

export function applySavedMultiFileTemplate(template: { entryPath: string; paths: string[] }, availablePaths: string[]) {
  const available = new Set(availablePaths.filter(isEligibleMultiFilePath));
  const paths = [...new Set(template.paths)].filter((path) => available.has(path));
  const entryPath = paths.includes(template.entryPath) ? template.entryPath : paths[0] ?? null;
  return { paths, entryPath, skippedCount: template.paths.length - paths.length };
}
