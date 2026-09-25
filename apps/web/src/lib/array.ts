export function withItemMoved<T>(list: readonly T[], from: number, offset: number): T[] | null {
  const to = from + offset;
  if (from < 0 || from >= list.length || to < 0 || to >= list.length) return null;
  const moved = [...list];
  moved.splice(to, 0, ...moved.splice(from, 1));
  return moved;
}
