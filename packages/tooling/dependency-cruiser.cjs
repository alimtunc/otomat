// Otomat import-boundary ruleset. Enforced by `pnpm build`.
//
// Conceptual layers (see docs/ai/import-boundaries.md):
//   shared:   domain
//   frontend: ui, client, domains            (apps/web, future apps/{desktop,mobile})
//   backend:  db, runtime, events, git, api, supervisor, integrations, review
//   tooling:  tooling
//   apps:     apps/web (frontend), apps/local-daemon (backend)
//
// Future packages are matched by regex even though only domain/db/tooling exist
// in OTO-5 — adding them later does not require editing these rules.
//
// Enforcement notes:
// - Cross-package imports use the `@otomat/<name>` specifier, which pnpm resolves
//   to the in-repo realpath `packages/<name>/...`, so target rules key on that.
// - With pnpm's non-hoisted node_modules, an UNDECLARED bare specifier (e.g.
//   `import "react"` from domain) does not resolve, so it is caught by both the
//   specifier-name match below AND `not-to-unresolvable`. The specifier-name
//   rules are ordered before `not-to-unresolvable` so the targeted, accurate
//   message wins for the heavy-lib case.

const BACKEND = "db|runtime|events|git|api|supervisor|integrations|review";
const FRONTEND = "ui|client|domains";

/** @param {string} group */
const pkgTargets = (group) => [`^packages/(${group})(/|$)`, `/@otomat/(${group})(/|$)`];

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      comment: "Circular dependencies make build order and reasoning fragile.",
      from: {},
      to: { circular: true },
    },
    {
      name: "domain-no-heavy-libs",
      severity: "error",
      comment: "packages/domain must not import React, DOM/UI, Drizzle, or better-sqlite3.",
      from: { path: "^packages/domain" },
      to: {
        path: [
          // resolved node_modules path (declared dep) ...
          "node_modules/(react|react-dom|better-sqlite3|drizzle-orm|drizzle-kit)(/|$)",
          // ... or the bare specifier itself (undeclared dep, unresolvable).
          "^(react|react-dom|better-sqlite3|drizzle-orm|drizzle-kit)(/|$)",
        ],
      },
    },
    {
      name: "frontend-not-to-backend",
      severity: "error",
      comment:
        "Frontend (apps/web + ui/client/domains) must never import a backend package. External state is mirrored by the local daemon.",
      from: { path: `^(apps/web|packages/(${FRONTEND}))` },
      to: { path: pkgTargets(BACKEND) },
    },
    {
      name: "backend-not-to-frontend",
      severity: "error",
      comment: "Backend packages and the local daemon must not import frontend UI packages.",
      from: { path: `^(apps/local-daemon|packages/(${BACKEND}))` },
      to: { path: pkgTargets(FRONTEND) },
    },
    {
      name: "domain-stays-pure-vs-packages",
      severity: "error",
      comment:
        "packages/domain is pure shared TypeScript: no app-specific or backend/frontend package imports.",
      from: { path: "^packages/domain" },
      to: { path: pkgTargets(`${BACKEND}|${FRONTEND}`) },
    },
    {
      name: "domain-no-node-core",
      severity: "error",
      comment: "packages/domain must stay environment-agnostic: no Node-only builtins.",
      from: { path: "^packages/domain" },
      to: { dependencyTypes: ["core"] },
    },
    {
      name: "not-to-unresolvable",
      severity: "error",
      comment:
        "An import that does not resolve is either a typo or a cross-package import whose dependency was never declared — both must fail the build.",
      from: {},
      to: { couldNotResolve: true },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsConfig: { fileName: "tsconfig.json" },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default", "types"],
      mainFields: ["module", "main", "types"],
    },
  },
};
