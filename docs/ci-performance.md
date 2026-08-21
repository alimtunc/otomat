# CI Performance Baseline and Cache Contract

Measured at 2026-08-20 from GitHub-hosted runner timestamps and job logs. Queue time means workflow
creation to the first job start; setup includes job initialization, checkout, pnpm and Node. A cache
is cold only when the `Setup Node` log says no matching pnpm cache was found.

## Baseline samples

### Pull requests

| Run | Cache | Queue | Setup | Install | `pnpm check` | Total |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| [32381428063](https://github.com/alimtunc/otomat/actions/runs/32381428063) | hit | 3s | 26s | 4s | 5m03s | 5m40s |
| [32382856589](https://github.com/alimtunc/otomat/actions/runs/32382856589) | hit | 4s | 20s | 5s | 5m16s | 5m50s |
| [32388151211](https://github.com/alimtunc/otomat/actions/runs/32388151211) | hit | 3s | 20s | 5s | 5m03s | 5m37s |
| [32422838348](https://github.com/alimtunc/otomat/actions/runs/32422838348) | miss | 3s | 11s | 14s | 5m38s | 6m15s |
| [32423534548](https://github.com/alimtunc/otomat/actions/runs/32423534548) | miss | 3s | 15s | 12s | 5m31s | 6m10s |

The warm median is **5m40s** total and **5m03s** inside `pnpm check`. Timestamp boundaries from
run 32382856589 split that check into format 1.02s, lint 1.92s, guardrails 1.51s, preview script
tests 0.58s, build and boundaries 8.99s, typecheck 8.98s, dist smoke 1.94s, and workspace tests
about 290s. Tests occupy about 92% of the gate; pnpm cache misses are not the critical problem.

The workspace test command already overlaps packages on one two-core runner. Its two largest suites
were web at 262s and local-daemon at 223s in run 32382856589, while the desktop and package suites
finished in at most 34s. CI therefore gives those heavy suites separate runners and keeps an
aggregator named `check` as the required status.

### Main

| Run | Result | Check green | Daemon ready | macOS end | Critical path |
| --- | --- | ---: | ---: | ---: | ---: |
| [32143942672](https://github.com/alimtunc/otomat/actions/runs/32143942672) | success | 4m34s | 5m14s | 11m38s | 11m39s |
| [32383159066](https://github.com/alimtunc/otomat/actions/runs/32383159066) | cross-commit smoke failed | 6m00s | 6m50s | 11m44s | 11m44s to failure |
| [32388760977](https://github.com/alimtunc/otomat/actions/runs/32388760977) | cross-commit smoke failed | 5m19s | 5m58s | 11m17s | 11m18s to failure |

The successful run's daemon job took 38s: 14s setup, 6s install, 9s build, 1s deployed-tree smoke,
2s pack and 3s upload. Its macOS job took 7m01s: 20s setup, 12s install, 2m06s package, 44s packaged
smoke and 3m34s cross-commit smoke. The old DAG did not start either until the 4m34 check stage had
finished.

The package log also spent roughly 60s downloading Electron, the icon bundle and the arm64 DMG
builder. That observation is the evidence for caching those download directories. Recent failed
macOS jobs repeatedly missed the pnpm cache because a failed job never reached its post-job cache
save; the cache miss remains a correct, supported path.

### Web preview and release

| Shape | Representative runs | Median total |
| --- | --- | ---: |
| Two jobs with daemon artifact handoff | [32376809905](https://github.com/alimtunc/otomat/actions/runs/32376809905), [32381428274](https://github.com/alimtunc/otomat/actions/runs/32381428274), [32382856695](https://github.com/alimtunc/otomat/actions/runs/32382856695) | 2m30s |
| One deploy job, no handoff | [32386355954](https://github.com/alimtunc/otomat/actions/runs/32386355954), [32420339072](https://github.com/alimtunc/otomat/actions/runs/32420339072), [32421739256](https://github.com/alimtunc/otomat/actions/runs/32421739256), [32423534668](https://github.com/alimtunc/otomat/actions/runs/32423534668) | 1m56.5s |

The observed consolidated preview is 22.3% faster despite also warming the new container. Cleanup
runs completed in 16s before container/image deletion and 34s after it was added.

`release-macos.yml` has no run in GitHub Actions, so signed build, notarization, upload and publish
have no honest baseline. A manual dispatch is required before and after changes can be compared;
the unsigned `package-macos` job is not a substitute for a release measurement.

## Before and after

| Outcome | Before | After | Evidence |
| --- | ---: | ---: | --- |
| Warm PR required check | 5m40s median | pending real PR | the new critical path is the slower isolated web/daemon suite plus setup and aggregation |
| Main daemon availability | 5m14s | pending merge | candidate build takes about 38s, but its public name waits for the new `check` |
| Main macOS package/smokes | 11m39s | about 7m01s DAG bound | same measured macOS job starts immediately; download cache gain is not credited |
| Web preview | 2m30s median | 1m56.5s median | observed GitHub runs, 22.3% reduction |
| Signed macOS release | no run | pending dispatch | no baseline exists |

The main figures are critical-path calculations from measured jobs, not replacement runs. The PR
target remains at least 25%; record warm and cold PR runs here after the workflow is pushed. A result
above 4m15s needs step-level evidence explaining the runner-bound limit before the target can be
considered unattainable.

## Repeated work and retained changes

| Previous repetition | Decision |
| --- | --- |
| One runner executes web and daemon tests under contention | isolate the two suites and aggregate every gate under `check` |
| Main waits before daemon build and native macOS work | build a full-SHA daemon candidate and macOS package immediately; expose the daemon only after `check` |
| Preview uploads/downloads a daemon tarball and repeats checkout/setup/install/domain build | provision in the job that built the tarball |
| Web and daemon filtered builds each rebuild shared packages | pass both filters to one recursive build |
| Every macOS run redownloads Electron builder archives | cache download archives only, never native outputs or `node_modules` |
| Preview container runs `apt-get` for every PR commit | rebuild the shared `preview-base:node22` only when `base.Dockerfile` changes |

Generic build caches, path filters, Dockerized Linux gates, self-hosted runners, `node_modules`
caches and a remote-cache orchestrator were rejected: the measurements do not justify their
complexity or they could hide a regression. PR CI checks a merge ref while preview checks the PR
head, so their dist trees are not interchangeable. Main daemon and macOS work are short enough to
start independently; cross-OS artifact reuse would be unsafe.

## Cache and artifact contract

- `actions/setup-node` caches the pnpm store under its OS/architecture/package-manager/lockfile key.
  Logs expose the full `node-cache-<OS>-<arch>-pnpm-<lock-hash>` key. It never caches `node_modules`.
- Electron caches contain `~/Library/Caches/electron` and
  `~/Library/Caches/electron-builder`. Their key is
  `electron-<OS>-<arch>-<hash(lockfile, desktop package)>`, so Electron and builder version changes
  invalidate it. There is no broad restore key; a miss downloads the official archives normally.
- `preview-base:node22` is a shared Linux/amd64 runtime input, not a PR resource. Its workflow runs
  only when `base.Dockerfile` changes or an operator dispatches it.
- The daemon candidate is rebuilt and smoke-tested from `github.sha`, carries the full SHA in its
  internal artifact name and is retained one day. Only a job that needs `check` republishes the
  short-SHA name consumed by desktop, retained seven days. The preview passes no cross-job artifact:
  Pages receives the full PR head SHA and Cloudflare images are removed on close.
- No output crosses OS or architecture boundaries. better-sqlite3 and packaged Electron binaries
  are always produced on their target runner.

For a suspect cache, open `Setup Node` or `Restore Electron downloads` and compare the printed key
with runner OS/architecture, `pnpm-lock.yaml` and `apps/desktop/package.json`. Re-run with a miss to
prove correctness; do not add a restore prefix or cache native output to turn a miss into a hit.

## Measurement after rollout

Measure at least two warm PR synchronizations, one lockfile-changing cold PR, one successful merge
to `main`, one preview close/reopen cycle and one `release-macos` manual dispatch. Record workflow
creation, job start/end and every named step from `gh run view <id> --json jobs`. Verify that a
second push cancels the older CI and preview runs, while a `closed` cleanup queues and completes.
