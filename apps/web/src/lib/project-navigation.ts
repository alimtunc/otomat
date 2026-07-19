/**
 * Whether `pathname` is a project-scoped entity detail (a run or an issue).
 * Switching project there must leave the view — the entity belongs to the
 * previously selected project; list routes re-filter in place instead.
 */
export function isProjectScopedDetail(pathname: string): boolean {
  return /^\/runs\/[^/]+/.test(pathname) || /^\/issues\/[^/]+/.test(pathname);
}
