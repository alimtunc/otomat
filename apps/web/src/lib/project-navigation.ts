/** Switching project must leave a detail view — the entity belongs to the previously selected project; list routes re-filter in place instead. */
const PROJECT_DETAIL_PATTERNS = [/^\/runs\/[^/]+/, /^\/issues\/[^/]+/, /^\/pull-requests\/[^/]+/];

export function isProjectScopedDetail(pathname: string): boolean {
  return PROJECT_DETAIL_PATTERNS.some((pattern) => pattern.test(pathname));
}

const PROJECT_ROUTES = ["/issues", "/runs", "/reviews", "/pull-requests", "/usage"];

/** Which routes a project's tab remembers: the rest of the cockpit answers for every project at once. */
export function isProjectRoute(pathname: string): boolean {
  return PROJECT_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}
