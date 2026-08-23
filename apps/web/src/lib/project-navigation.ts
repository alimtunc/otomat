/** Switching project must leave a detail view — the entity belongs to the previously selected project; list routes re-filter in place instead. */
export function isProjectScopedDetail(pathname: string): boolean {
  return /^\/runs\/[^/]+/.test(pathname) || /^\/issues\/[^/]+/.test(pathname);
}
