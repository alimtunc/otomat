---
name: update-atlas
description: Use when docs/ai/otomat-visual-map.html may be stale or when Otomat's architecture, data flow, packages, database, runtime, boundaries, tooling, or key entry points changed.
---

# Update Atlas

Keep `docs/ai/otomat-visual-map.html` aligned with the stable repository. Treat
committed source as evidence and the atlas as a curated explanation, not a
generated file inventory.

## Workflow

1. Resolve local `main` as the target commit. Use another committed ref only
   when the user explicitly requests it. Do not fetch or switch branches.
2. Read the atlas baseline from `otomat-baseline` metadata or its visible commit.
   Diff that commit against the target; perform a full audit when the baseline is
   absent, unknown, or not an ancestor.
3. Check the working tree. Exclude every uncommitted source change from claims.
   If the atlas itself is already modified, ask before reconciling it.
4. Re-read stable source for each affected section:
   - apps, packages, manifests and composition roots → topology;
   - API, client and SSE → interactions;
   - schema, migrations and repositories → database;
   - supervisor, runtime, events, review, Git and GitHub → runtime traces;
   - dependency rules, guardrails and toolchain → boundaries and technologies;
   - ownership and entry points → change map and key files.
5. Update only evidence-backed claims, diagrams, counts, links, traces and
   unknowns. Preserve the visual language. Never present planned work as
   implemented.
6. Record the full target SHA in
   `<meta name="otomat-baseline" content="…">`, update the visible commit and
   date, and change `README.md` or `AGENTS.md` only if either contradicts the
   stable architecture.
7. Verify navigation targets, repository-relative links, standalone assets,
   whitespace, browser console, and layouts at desktop and mobile widths.
8. Report the baseline, updated sections, evidence, excluded dirty paths,
   validation results and unresolved unknowns.

If no architecture-affecting change exists, validate the atlas and leave it
unchanged. Do not fix unrelated product or test failures.
