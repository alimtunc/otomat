export function comparePersistedRows(
  left: { created_at: string; id: string },
  right: { created_at: string; id: string },
): number {
  return left.created_at.localeCompare(right.created_at) || left.id.localeCompare(right.id);
}
