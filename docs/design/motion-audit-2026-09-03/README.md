# Otomat motion audit — 2026-09-03 (OTO-166)

An audit of Otomat's interaction motion with Emil Kowalski's skills, the three
prototypes that followed, and the measurements behind the change that shipped.
Planning evidence, not a product contract: re-measure against the live product
before extending any of it.

## Method

- Upstream: [emilkowalski/skills](https://github.com/emilkowalski/skills) at
  `d23d7f88a2e21c9e4b1418c7abe420f5c1052ba7` (2026-08-21). The five skills used
  are vendored under `.agents/skills/` (see its README); nothing else was copied.
- Base: `main` at `592e601a`, after the recent UX/UI corrections.
- Instrument: headless Chromium (Playwright's build) driven over CDP against the
  real cockpit served by Vite with `/api` proxied to the live daemon. Every
  number below comes from `Animation.animationStarted` events (property,
  duration, easing), `getComputedStyle` sampled every 16 ms, and a
  `layout-shift` `PerformanceObserver`. Reduced motion was checked with
  `Emulation.setEmulatedMedia`, widths at 1440 and 1024 px, keyboard paths with
  synthetic key events.
- Skills: `improve-animations` (audit), `find-animation-opportunities` (gate),
  `prototype` (picker harness, PICKER.md verbatim), `emil-design-eng`
  (implementation), `review-animations` (final review). The audit and the review
  were run by hand against the rule catalogues; the harness was deleted after
  the choice, as the `prototype` skill requires.

## Phase 1 — Audit matrix

Frequency is per operator per day. "Cost" names the accessibility or
performance risk of animating.

### 1. Project switch and badge continuity

| Interaction | Observed | Problem | Frequency | Benefit of motion | Decision | Cost |
| --- | --- | --- | --- | --- | --- | --- |
| Open the project switcher (combobox) | 100 ms scale .95 + fade, Tailwind default curve, literal duration | Not on the design tokens; the literal duration escapes `prefers-reduced-motion` | Several | Continuity from the trigger | **reduce** to the shared 90 ms anchored entrance | None once on tokens |
| Switch to a project with cached data | Sidebar badges and live dot render from cache in the same frame | None: continuity holds | Several | — | **do not animate** | — |
| Switch to a project without cache | Reviews badge appears ~120 ms later, in place | A count popping in | Rare | Marginal | **do not animate** — a badge is data, and a fade would hide when the count is real | — |
| Live dot on Runs | 2.4 s breathe, zeroed under reduced motion | None | Continuous | — | keep | — |

### 2. Issues / Runs / Reviews navigation and tabs

| Interaction | Observed | Problem | Frequency | Benefit | Decision | Cost |
| --- | --- | --- | --- | --- | --- | --- |
| Sidebar route change | Cached views render instantly, no skeleton flash, layout shift 0 | None | 100+ | None — motion would delay reading | **do not animate** | — |
| Cockpit tabs (Conversation/Report/Logs/Diff/PR) | Instant swap; skeleton shimmer only on a cold tab | None | 100+ | None | **do not animate** | — |
| Saved-view tabs, pill tabs, segmented controls | `duration-[--motion-fast]` is Tailwind v3 syntax, so it emitted `--tw-duration: --motion-fast` and the colour fade ran at 0 s | Dead intent | Tens | Hover/active colour only | **reduce**: fix to `duration-(--motion-fast)`; the 90 ms colour fade the token promised, nothing more | None |
| Active-tab underline | Appears in place | None | 100+ | Emil's clip-path tab trick is decorative here | **do not animate** | — |

### 3. Popovers, menus, modals, confirmations, submit review

| Interaction | Observed | Problem | Frequency | Benefit | Decision | Cost |
| --- | --- | --- | --- | --- | --- | --- |
| Popover (Filter, activity, connection) | `opacity-0 data-[open]:opacity-100`; Base UI mounts with `data-open` already set, so the entrance **never ran** — popups popped in and faded out (90 ms) | Exit-only motion, reversed asymmetry | Tens | Spatial link to the trigger; no pop | **animate** (fix): 90 ms scale .97→1 + fade from the trigger origin | transform/opacity only |
| Dropdown menu (run actions, issue status) | `transition: all 0s` — no motion at all | Menus teleport | Tens | Same | **animate** with the same shared class | Same |
| Select (settings) | None | Same | Several | Same | **animate**, same class | Same |
| Tooltip | Same `data-[open]` defect: instant in, 90 ms out | Same | Tens | Feedback | **animate**, same class | Same |
| Dialog (new issue, submit review, confirmations) | Same defect; exit used the spring curve on a `.98` scale that never showed | Same, plus a first-frame content jump (234→204 px) when the auto-textarea mounts | Occasional | Preventing a jarring change | **animate**: 140 ms, centered, scale .97 + fade; the entrance fade now also covers the first-frame jump | Same |
| Command palette (⌘K) | No entrance (same defect), 140 ms spring exit | Motion on a keyboard surface | 100+ | None — Raycast rule | **do not animate**: remove the exit too | Removes work |

### 4. Live, error, stale and primary-action states

| Interaction | Observed | Problem | Frequency | Benefit | Decision | Cost |
| --- | --- | --- | --- | --- | --- | --- |
| Offline banner appears | Inserted in place; layout shift 0.030 measured (banner row + header label width) | A row teleports in | Rare | Preventing a jarring change | **animate**: fade + 4 px settle over 140 ms via `@starting-style` | The row insertion itself still shifts content; motion neither adds nor removes that |
| Stale notice (`QueryBoundary`) | Same | Same | Rare | Same | **animate**, same class | Same |
| Reconnecting bar | Keyframe animating `left` | Layout property on an infinite animation | Rare | — | **reduce**: animate `transform: translateX` instead | Off the layout path |
| Next-action strip (run cockpit) | 200 ms keyframe on remount, own CSS file | Keyframes restart from zero; a second copy of the same entrance | Occasional | State indication | **reduce**: same shared `@starting-style` class, file deleted | — |
| Connection label (Online → Offline · cached → Reconnecting…) | Width change moves the header cluster | Layout shift, not a motion problem | Rare | None | **do not animate**; left open (see below) | — |
| Primary CTA buttons | `active:translate-y-[0.5px]` press nudge, 90 ms colour | Fine at this frequency | 100+ | — | keep; Emil's `scale(.97)` press would be louder than the product | — |
| Skeletons, spinners, toasts (sonner) | Tokenised, reduced-motion aware | None | — | — | keep | — |

### What must not animate, and why

Route changes, cockpit and view tabs, the command palette, sidebar badges and
live dots, keyboard shortcuts (`c`, `[`, ⌘K), list hover and table rows. All are
100+ per day or keyboard-initiated; on those, motion delays the thing the
operator is looking at and reads as lag. The palette is the one place the audit
*removed* motion.

### Opportunity gate (`find-animation-opportunities`)

Accepted: the four rows marked **animate** above — all "preventing a jarring
change" or "spatial consistency", all inside Emil's budgets.

Rejected: a stagger on the issues board (functional data, tens/day), a
morphing status chip on issue status change (data the operator reads), a
press `scale(.97)` on every button (louder than the product's personality), a
crossfade on route content (100+/day), a delight moment on run completion
(the next-action strip already carries it).

## Phase 2 — Prototypes (three interactions, three variants each)

Harness: a throwaway Vite page rendering the real `@otomat/ui` primitives in a
realistic page (page bar, rows) behind the picker from `prototype/PICKER.md`,
one variant at a time, switched instantly by keys 1–3. Variant CSS overrode the
primitives with `!important`; production code was untouched during exploration.

| Interaction | Variant | Axis | Measured | Verdict |
| --- | --- | --- | --- | --- |
| Anchored surfaces + dialog | Instant | No entrance, 90 ms exit fade | Today's behaviour | Pops; exit-only asymmetry reads as a glitch |
|  | **Anchored** | scale .97→1 + fade from the trigger, 90 ms (dialog 140 ms) | Enter 0→.76→.91→.97 opacity over 3 frames at 1440 and 1024; keyboard open identical; reduced motion → 0 ms | **Chosen** — it is what the primitives already declared |
|  | Fade | Opacity only | Same timing, no origin story | Loses the spatial link for no cost saved |
| Command palette (⌘K) | **Instant** | No transition either way | Input focused on frame 0; rapid triple ⌘K ends open and visible | **Chosen** — Raycast rule |
|  | Fade | 140 ms opacity both ways | Input focused, first frames blank | Delays the keystroke the operator is already typing |
|  | Scale | Today's 140 ms spring, entrance fixed | Rapid triple ⌘K ended with the palette open at opacity 0 | Rejected: fragile under repeated toggles |
| Offline banner + stale notice | Instant | Inserted in place | — | Teleports |
|  | **Settle** | fade + 4 px slide over 140 ms | Opacity 0→.32→.57→.86→.97, translate −4→0 px; CLS unchanged by the motion; reduced motion → instant | **Chosen** |
|  | Fade | Opacity only | Same | Fine, but the settle explains "a row arrived" better for the same price |

## Phase 3 — What shipped

- `packages/ui/src/primitives/styles.ts`: `POPUP_MOTION_CLASS` /
  `POPUP_MOTION_STYLE` shared by popover, dropdown menu, select, combobox and
  tooltip (Base UI `data-starting-style` / `data-ending-style`, origin at the
  trigger, `--motion-fast`, `--ease` on opacity, `--ease-spring` on transform);
  the dialog overlay and popup use the same attributes centered.
- `packages/ui/src/components/command-palette.tsx`: no transition classes; the
  search reset moved from `onOpenChangeComplete` to `onOpenChange` since there
  is no exit to wait for.
- `packages/ui/src/lib/motion.ts`: `SETTLE_IN_CLASS` (`@starting-style`, opacity
  + `translate`, `--motion-base`) used by `OfflineBanner`, `StaleNotice` and
  `NextActionStrip`; `strip.css` deleted.
- `reconnecting-bar.tsx`: keyframe moved from `left` to `transform`.
- `tabs-variants.ts`, `toggle-strip.ts`: `duration-(--motion-fast)`.
- `docs/ai/codebase-map.md`: a "Motion" section carrying the rationale.

No dependency added. Tokens, curves and reduced-motion handling stay in
`tokens.css`.

## Before / after

Same viewport (1440×900), same states, same daemon data.

| Measure | Before | After |
| --- | --- | --- |
| Popover enter (`Animation.animationStarted`) | none | transform 90 ms spring, opacity 90 ms ease-out |
| Popover computed opacity at +0/+16/+32/+48 ms | 1 / 1 / 1 / 1 (pop) | 0 / 0 / .76 / .91 |
| Dropdown menu | `transition: all 0s` both ways | 90 ms in and out |
| Dialog enter | none | opacity + transform 140 ms |
| Command palette open / close | none / opacity 140 ms spring | none / none |
| Tooltip | exit-only 90 ms | 90 ms in and out |
| Offline banner appearance | none | translate + opacity 140 ms |
| Next-action strip | keyframe 200 ms (`--motion-medium`) | transition 140 ms (`--motion-base`) |
| Reduced motion, every surface above | none | none |
| Route change Issues → Runs → Reviews | instant, 0 skeletons, CLS 0 | unchanged |
| Cockpit tab switch | instant | unchanged (colour fade now 90 ms as declared) |
| Project switch, cached badges | present on frame 0 | unchanged |
| Layout shift introduced by the change | — | none: only `transform`, `translate` and `opacity` animate |
| Blocking animation | — | none: every transition is interruptible and shorter than 150 ms |

## `review-animations` on the final diff

| Before | After | Why |
| --- | --- | --- |
| `opacity-0 data-[open]:opacity-100` on popup/tooltip/dialog | `data-starting-style:` / `data-ending-style:` pair | Base UI sets `data-open` on mount, so the old pair only ever animated the exit |
| Menu and select with no transition | shared 90 ms anchored entrance | Menus teleported; now scale from the trigger |
| Combobox `duration-100` + default curve, `scale-95` | tokens, `scale(.97)` | Literal durations bypass the reduced-motion zeroing; one vocabulary |
| Palette `transition-[opacity,transform]` 140 ms spring | none | Keyboard surface, 100+/day |
| Keyframe `left` on the reconnect bar | `transform: translateX` | Layout property on an infinite animation |
| `strip.css` keyframe | `@starting-style` transition | Transitions retarget; one entrance for every flow row |

Verdict: **approve**. No `transition: all`, no `scale(0)`, no `ease-in`, no
layout property, nothing over 140 ms, reduced motion verified at 0 ms. Two
deviations accepted knowingly: the transform keeps the project's
`--ease-spring` (overshoot measured at 0.14 % of scale — invisible, and a token
the design system already committed to), and popups exit in the same 90 ms they
enter (already at the floor; a faster exit would be sub-frame).

## Value of the skills

| Recommendation | Outcome | Reason |
| --- | --- | --- |
| Frequency table → no motion on 100+/day and keyboard surfaces | **retained** | Drove the palette deletion and every "do not animate" row |
| `data-starting-style` / `@starting-style` entrances, transitions over keyframes | **retained** | Found the enter defect the audit is built on; replaced the strip keyframe |
| `transform`/`opacity` only, never `transition: all` | **retained** | Reconnect bar `left` → `transform` |
| Origin-aware popovers, `scale(.97)`, modals centered | **retained** | Already the primitives' intent; now real |
| Strong custom curves (`cubic-bezier(0.23, 1, 0.32, 1)`) | **rejected** | `tokens.css` already owns `--ease`; a second curve would split the vocabulary for no measured gain |
| Reduced motion "gentler, not zero" | **adapted** | The project zeroes durations at the token level; keeping opacity would need per-component rules. Recorded as an open policy question, not changed |
| Press `scale(.97)` on every button, 30–80 ms staggers, blur-masked crossfades | **rejected** | Louder than a crisp daily tool; gated out by frequency or function |
| Tooltips instant after the first (`data-instant`) | **deferred** | Needs a `Tooltip.Provider`; no consumer today |
| `prototype` picker | **retained** | Cheap to build, and the rapid-⌘K failure of the Scale variant only showed up there |

Net: the skills' catalogue found one real defect (entrances never ran), one
performance slip (`left`), one broken utility (`duration-[--motion-fast]`), and
argued convincingly *against* four decorative additions. Their value is the
restraint and the checklist, not the taste — every kept value already existed
as a token here.

## Open, deliberately

- The new-issue dialog's content still grows by 30 px on its second frame
  (auto-textarea mount); the entrance fade hides it, the layout cause remains.
- The connection label's width change moves the header cluster; a reserved
  width would fix it, which is layout work outside this ticket.
- Reduced-motion policy: durations are zeroed globally; Emil would keep the
  opacity fades.
- A pre-existing Base UI console error (`nativeButton` on a `Link` render in
  the runs list) is unrelated to motion.
