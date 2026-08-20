---
name: first-pass-quality
description: Execute a clean first implementation pass in this repository. Use when adding, changing, fixing, or refactoring code before handoff, including non-ticket work that still needs the repository's reuse, ownership, and verification discipline.
---

# First-pass quality

## Workflow

1. Read the applicable repository rules and the target module. Search for the
   owning module, current seams, and reusable helpers before designing additions.
   Finish when every planned helper, export, option, and abstraction has a current
   consumer and an explicit owner.
2. Implement one acceptance criterion at a time. Keep the change inside existing
   boundaries and run the narrowest relevant check after each criterion.
3. Inspect the complete diff. Apply the repository's final diff pass exactly;
   resolve comments, duplication, mixed concerns, misplaced ownership, and
   consumerless abstractions before proceeding.
4. Run the configured project gate. When React files changed and
   `.turkit.yaml → commands.react_review` exists, run that gate too. Fix root
   causes; leave no suppression or baseline entry merely to make the gate green.
5. Hand off the criteria-to-change mapping, exact checks, residual risks, and
   `New comments: <n>` with a `file:line — reason` entry for each retained comment.

Keep review proportional to evidence. This skill performs self-review; it never
invokes a reviewer, `goal-review`, commit, push, or PR workflow.
