# Cycle de vie d'une run

> **Vue riche** (SVG rendu, couleurs, barres d'activation) :
> [`run-lifecycle-visual-map.html`](run-lifecycle-visual-map.html) — à ouvrir en local
> (GitHub affiche le `.html` en source brute, pas rendu).

Un tour d'agent supervisé. Le parent `fork` un worker enfant — **seul écrivain
durable** — qui écrit dans `events.jsonl` ; le parent *tail* ce ledger et pilote les
state machines du domaine. La vérité de fin de run vient toujours du **ledger**
(terminal marker), jamais d'une supposition du parent.

**Flux nominal :** `POST /api/runs` → `startRun` → `prepareRun` (rows + plan figé +
worktree) → `spawnTurn` (slot + `queued→running` + fork) → worker écrit les events →
`proc.exited` → `settleRun` (classe + drive vers terminal) → `notifyAfterSettle` (SSE).

## Flux nominal — start → settle

```mermaid
sequenceDiagram
    autonumber
    actor UI as Client · web / SSE
    participant API as API · Hono routes
    participant SUP as Supervisor · commands / lifecycle
    participant W as Worker · child (durable)
    participant ST as State · ledger / domain

    UI->>API: POST /api/runs
    API->>SUP: startRun(request)
    Note over SUP: prepareRun() — rows · plan figé · worktree
    SUP->>ST: driveRunTo · queued → running
    SUP-)W: fork · state.spawn()
    SUP->>ST: startSessionTail()
    API-->>UI: 201 { run } · running

    activate W
    loop pendant le tour
        W->>ST: emit events → events.jsonl
        ST-->>UI: SSE /:id/events (via tail)
    end
    W->>ST: writeTerminalMarker
    W--)SUP: process.exit
    deactivate W

    SUP->>ST: drain + read final status
    SUP->>ST: classify → driveRunTo(terminal)
    SUP-->>UI: notifyAfterSettle → SSE
```

## Reprises & abort — greffent sur la même `spawnTurn`

```mermaid
flowchart LR
    subgraph T["Reprises d'un tour"]
      direction TB
      A["awaiting_human"] -->|POST /:id/resume| resumeRun
      B["review_ready"] -->|POST /:id/review/fix| fixRun
      resumeRun --> sft["spawnFollowUpTurn<br/>(même provider session)"]
      fixRun -->|prompt = commentaires| sft
      sft --> spawnTurn["spawnTurn('resume')"]
    end
    subgraph AB["Abort / crash"]
      direction TB
      X["POST /:id/abort"] --> abortRun["abortRun<br/>SIGTERM 2s → SIGKILL"]
      Y["daemon reboot"] --> reconcile["reconcile()<br/>settleRun (mode boot)"]
      abortRun --> settle["settleRun"]
      reconcile --> settle
    end
```

## Domain — `runMachine` (transition illégale → throw)

```mermaid
stateDiagram-v2
    direction LR
    [*] --> queued
    queued --> preparing
    preparing --> running
    running --> awaiting_permission
    running --> awaiting_human
    running --> awaiting_selection
    running --> review_ready
    awaiting_permission --> running
    awaiting_human --> running
    awaiting_selection --> running
    review_ready --> running
    review_ready --> completed
    completed --> [*]
    failed --> [*]
    canceled --> [*]
    note right of running
      Depuis tout état non-terminal :
      aussi → failed et → canceled
      (omis ici pour la lisibilité)
    end note
```

## Fichiers

| Rôle | Fichier |
| --- | --- |
| Surface HTTP (start · resume · abort · fix · SSE) | [`api/routes/runs.ts`](../../apps/local-daemon/src/api/routes/runs.ts) · [`review.ts`](../../apps/local-daemon/src/api/routes/review.ts) |
| Commandes du supervisor | [`supervisor/commands.ts`](../../apps/local-daemon/src/supervisor/commands.ts) |
| Matérialisation (rows · plan · worktree) | [`supervisor/prepare.ts`](../../apps/local-daemon/src/supervisor/prepare.ts) |
| Exécution (spawn · activation · tail) | [`supervisor/lifecycle.ts`](../../apps/local-daemon/src/supervisor/lifecycle.ts) |
| Worker enfant (durable) | [`supervisor/worker.ts`](../../apps/local-daemon/src/supervisor/worker.ts) |
| Finalisation (live · abort · boot) | [`supervisor/settle.ts`](../../apps/local-daemon/src/supervisor/settle.ts) |
| Traduction machine → DB | [`supervisor/transitions.ts`](../../apps/local-daemon/src/supervisor/transitions.ts) |
| State machine | [`domain/state-machines/run.ts`](../../packages/domain/src/state-machines/run.ts) |
