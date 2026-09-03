# Agent skills

`first-pass-quality` and `update-atlas` are Otomat's own skills. The five below
are vendored verbatim from Emil Kowalski's
[skills](https://github.com/emilkowalski/skills) repository (MIT, see
`emil-design-eng/LICENSE`), at revision `d23d7f88a2e21c9e4b1418c7abe420f5c1052ba7`
(2026-08-21), evaluated for OTO-166 on 2026-09-03. Only the skills that audit
touched are kept; re-vendor from the same revision rather than editing them.

| Skill | Role in Otomat |
| --- | --- |
| `improve-animations` | Initial motion audit (eight categories, severity by frequency) |
| `find-animation-opportunities` | Gate for adding motion: frequency, purpose, speed, function |
| `prototype` | Picker harness to compare variants before choosing one |
| `emil-design-eng` | Implementation reference: easing, duration, physicality, a11y |
| `review-animations` | Strict final review of animation diffs |

`.claude/skills/<name>` symlinks point here so Claude Code and Codex read one copy.
