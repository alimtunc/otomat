# Agent operation in Otomat

`AGENTS.md` owns the repository's business rules, quality requirements and
completion contract. `CLAUDE.md` imports it. Harness settings select capabilities;
they do not redefine those requirements. The [dated audit](audits/oto-177-instructions-audit.md)
records the evidence and model documentation; its host observations are snapshots.

## Start an implementation

1. Confirm the active worktree, branch and diff before editing. Read the attached
   issue, applicable repository guides and `first-pass-quality`; load architecture
   references only for the modules involved.
2. Map acceptance criteria to their owning modules and verification commands.
   Use the implementation and handoff sequence in `AGENTS.md → Protocol`.
3. Keep the model, harness, profile and host configuration separate in reports.
   An alias such as Astra does not specify tools, context size, permissions or cost.
   Inspect the installed runtime's model/options catalog before changing a setting.

The root guide makes the implementation skill reachable even without an Otomat
profile. Discovery alone does not activate an Otomat skill. For repeated work,
select `first-pass-quality` in a **project-scoped** profile. A global profile may
select user skills, but cannot activate a project's skill. Do not weaken this scope
restriction or create daemon-owned default profiles.

## Instruction sources

| Surface | Source and loading | Scope |
| --- | --- | --- |
| Codex native repository guide | Applicable `AGENTS.md` chain, including overrides supported by the installed harness | Startup directory and applicable ancestors; host instructions remain separate |
| Claude native repository guide | Root `CLAUDE.md` imports `AGENTS.md`; nested guides/rules follow Claude's loading rules | Paths where the native harness loads them |
| Native skills | Codex discovers `.agents/skills`; Claude discovers `.claude/skills` links | Harness discovery and invocation semantics, not Otomat's catalog |
| Otomat user catalog | `~/.agents/skills`, then legacy `~/.claude/skills`, then `~/.codex/skills` | One directory deep; no recursive plugin or `.system` scan |
| Otomat project catalog | Registered project's `root_path/.agents/skills` and `.claude/skills` | That project's profiles, not arbitrary run worktrees |
| Selected Otomat skills | Profile ids resolve to canonical paths; bodies and hashes freeze into the plan | Both runtime adapters receive the same selected text |
| Otomat context | Captured issue/workspace/plan dossier and optional user note | User task context; a node label is never a directive |

Otomat de-duplicates by realpath, not name. User roots are scanned before project
roots so a project link to a user skill does not change its ownership. Distinct
skills with the same name remain separate entries; inspect their source before
selection. Do not rely on identical naming to override a personal skill.

The project catalog comes from the registered checkout, while native discovery
uses the active workspace. Editing a skill in a worktree therefore does not update
the selected catalog body. To exercise that edit, invoke its exact worktree path
natively, or register an isolated test project with that worktree as its root.
Do not add every run worktree to the global catalog: that would change ownership,
pollute selections and bypass the existing frozen-source contract.

## Selected skill context

`agents/prompt.ts` labels profile guidance as task guidance and includes each
selected skill's canonical file, resource directory and content hash. The text
instructs the agent to resolve relative references from that source directory,
even when the runtime's cwd is a different worktree, and to report missing
resources instead of substituting a homonymous skill. Otomat does not load those
resources on the agent's behalf.

The selected body is frozen; ancillary files read later are live. This is not a
hermetic skill bundle. For reproducible evaluation, pin and hash ancillary files
as well as `SKILL.md`. Otomat does not execute skill frontmatter: `allowed-tools`,
`context`, hooks and invocation flags do not grant native tools or permissions
when carried as prompt text. Use a native invocation when the task requires those
native mechanics; if unavailable, report the limitation.

A fresh session receives the frozen guidance and bodies. A native resume keeps
its provider conversation and receives only the new prompt. Recovery into a fresh
session receives the frozen configuration again. `composeTurnPrompt` adds no
filesystem reads; attached repository references retain the Git snapshot and
symlink protections in `context/files.ts`.

## Configure the host

Use Settings → Agents on the intended execution host, or its existing
`/api/agent-profiles` API. Read the current profile first and retain unrelated
fields. Never write the SQLite database directly. Updates affect future
resolutions; do not rewrite launched plans or sessions.

- For Codex implementation, select `workspace-write` and a model announced by the
  installed runtime. The subprocess runs non-interactively: an approval policy
  cannot create an interaction channel. `danger-full-access` removes filesystem
  confinement; it is not a way to improve first-pass quality.
- For Claude, keep the detected `auto` mode when available, or the supported
  fallback. Otomat relays Claude permission requests through its interaction
  channel. `bypassPermissions` remains an explicit dangerous choice.
- Start with the installed model's default effort or a justified moderate level.
  Increase it for a difficult diagnosis or coupled contract change only when
  evidence warrants the latency and cost. Equal effort labels across providers
  do not imply equal computation.
- Keep guidance short: name the intended workflow and attached source. Put shared
  repository requirements in the root guide instead of copying them into each
  profile. The ticket workflow's mode controls its planning checkpoint; `--auto`
  does not authorize publication or wider permissions.

The host rollout payload and patches prepared for the audited installation are
listed in [the implementation record](audits/oto-177-implementation.md). They are
not installed settings and must not be treated as completed host changes.

## Maintain shared skills

Keep one canonical body plus relative Claude discovery links. Preserve upstream
licences and pin information; record local patches explicitly instead of claiming
modified vendor files are verbatim. Test discovery with an empty fake home, both
harness links, homonymous files and a project other than the skill owner.

Use the exact repository path `.agents/skills/prototype/SKILL.md` for the UI picker
until the prepared rename to `prototype-ui-variants` is installed. The personal
`prototype` workflow is different; its shortcut testing or commit instructions
cannot override this repository's gates and publication rules.

Use [the comparison protocol](audits/oto-177-comparison-protocol.md) for model
evaluation. A passing fixture or test measures the product behavior it checks;
it does not demonstrate a first-pass model improvement. Paid runs require the
specified budget and authorization before launch.
