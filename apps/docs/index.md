---
layout: home

hero:
  name: Otomat
  text: Turn issues into reviewed pull requests.
  tagline: A local-first desktop cockpit that runs Claude Code or Codex on your issues, in isolated git worktrees, and lets you review the real diff before you ship it.
  actions:
    - theme: brand
      text: Get started
      link: /guide/introduction
    - theme: alt
      text: Install on macOS
      link: /guide/install
    - theme: alt
      text: GitHub
      link: https://github.com/alimtunc/otomat

features:
  - title: Issue-first
    details: Start from a Linear issue or a local one. The issue stays the context of every run, step and pull request that follows.
  - title: Isolated by default
    details: Every run works on its own branch and git worktree. Your checkout is never touched, and nothing is deleted without asking.
  - title: Review the real diff
    details: Read the branch, step or pull-request diff, mark files reviewed, leave comments, and send the ones you choose back to an agent.
  - title: Ship deliberately
    details: Generate a Conventional Commit and a pull request, push follow-ups, and keep issue, run and GitHub state linked.
  - title: Local-first
    details: The daemon, the SQLite database, repositories and credentials stay on machines you control — your Mac or a VPS you own.
  - title: Provider-agnostic
    details: Use the Claude Code and Codex CLIs and subscriptions you already have. Otomat adds no built-in agent, model or prompt.
---
