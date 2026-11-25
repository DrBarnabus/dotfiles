export function formatModel(modelId: string): string {
  const match = modelId.match(/^claude-([a-z]+)-(\d{1,2})(?:-(\d{1,2}))?(?:[-[]|$)/);
  const [, family, major, minor] = match ?? [];
  if (!family || !major) return modelId.replace(/\s*\(.*?\)/, "");

  const name = family.charAt(0).toUpperCase() + family.slice(1);
  return minor ? `${name} ${major}.${minor}` : `${name} ${major}`;
}
