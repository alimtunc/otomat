# Otomat

**Turn issues into reviewed pull requests from one agent cockpit.**

Otomat is a local-first desktop app for running coding agents on real issues. Pick an issue,
choose an agent, and Claude Code or Codex works on it in an isolated git worktree. Follow the run
live, answer its questions, review the actual diff, send your comments back to the agent, and open
the pull request — from one window, on machines you control.

**Documentation: [otomat-docs.pages.dev](https://otomat-docs.pages.dev)**

## What it does

- **Issue-first** — a Linear issue or a local one is the durable context of every run, step and
  pull request.
- **Single runs and workflows** — one agent on one task, or several steps with dependencies,
  competing candidates and saved presets.
- **Steering** — message a running agent, answer its permission requests and questions, change the
  model for the next turn, stop, resume and recover.
- **Review the real diff** — mark files reviewed, comment lines, and let an agent address the
  comments.
- **Ship deliberately** — Conventional Commit subjects, generated pull-request descriptions and a
  pull-request inbox with review and merge.
- **Local or remote execution** — the daemon runs on your Mac or on a Linux server you own,
  reached over SSH; the app stays the control plane.

## Status

Alpha. **macOS on Apple Silicon** only. The agent runtimes are the Claude Code and Codex CLIs you
already have; Otomat ships no model, no built-in agent and no telemetry.

## Install

Download the latest `.dmg` from the [releases page](https://github.com/alimtunc/otomat/releases),
drag **Otomat** to Applications and launch it. The release build is signed and notarized; Otomat
checks for updates itself and never installs one without asking.

You need `git`, the GitHub CLI (`gh auth login`) and at least one of `claude` / `codex` on your
login shell's `PATH`. Details: [Install](https://otomat-docs.pages.dev/guide/install) ·
[Prerequisites](https://otomat-docs.pages.dev/guide/prerequisites).

## Quick start

1. **Add project** from the project switcher and point it at a local git clone.
2. Create an agent under _Settings → Global · Local → Agents_: a runtime, a model, permissions.
3. Open an issue — **New issue**, or one mirrored from Linear — and **Launch run**.
4. Watch the **Conversation**, then read the **Diff** and comment it.
5. **Generate PR**, or **Customize PR** and **Create PR**.

The [guide](https://otomat-docs.pages.dev/guide/introduction) walks through each of these and the
rest of the product.

## Contributing

Otomat is a TypeScript monorepo built with pnpm. Read [`AGENTS.md`](AGENTS.md) — the contributor
and agent guide — and the
[contributing page](https://otomat-docs.pages.dev/guide/contributing), which points to the
architecture references under [`docs/`](docs/ai/codebase-map.md).

## Security

Otomat's security model and how to report a vulnerability:
[Data, privacy and security](https://otomat-docs.pages.dev/guide/data-and-security).

## License

Otomat has not published a license yet; the choice is pending and will land in this repository
as a `LICENSE` file.
