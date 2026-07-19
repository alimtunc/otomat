import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createClient, listAgentSessionsForRun, listStepRunsForRun, type Db } from "@otomat/db";
import { runContractSchema, runDetailSchema, type RunDetail } from "@otomat/domain";
import { expect, it } from "vitest";
import { z } from "zod";

import { readRunEvents, sessionDir } from "#events";
import { killProcessGroup } from "#supervisor";
import { readProcessStartTime, WORKER_IDENTITY_FILE } from "#supervisor/identity";

import { setupTestRepo } from "../support/git.js";
import { waitFor } from "../support/poll.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const DAEMON_ENTRY = resolve(HERE, "..", "..", "src", "index.ts");
const workerIdentitySchema = z.object({
  pid: z.number().int().positive(),
  pgid: z.number().int().positive(),
  start_time: z.string().min(1),
});
type WorkerIdentity = z.infer<typeof workerIdentitySchema>;

const COMPETE_PLAN = {
  version: 1 as const,
  steps: [
    {
      id: "approach",
      name: "Choose an approach",
      depends_on: [],
      compete: [
        { id: "direct", name: "Direct", agent: "fake", prompt: "direct" },
        { id: "layered", name: "Layered", agent: "fake", prompt: "layered" },
      ],
    },
  ],
};

interface RunningDaemon {
  child: ChildProcess;
  origin: string;
}

function daemonEnv(
  port: number,
  dbPath: string,
  projectRoot: string,
  barrierPath: string,
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    OTOMAT_DAEMON_HOST: "127.0.0.1",
    OTOMAT_DAEMON_PORT: String(port),
    OTOMAT_DB_PATH: dbPath,
    OTOMAT_PROJECT_ROOT: projectRoot,
    OTOMAT_ENABLE_FAKE_RUNTIME: "1",
    OTOMAT_FAKE_RUNTIME_BARRIER_PATH: barrierPath,
  };
  delete env.VITEST;
  delete env.VITEST_WORKER_ID;
  delete env.VITEST_POOL_ID;
  return env;
}

async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("missing daemon port");
  await new Promise<void>((resolveClose, reject) =>
    server.close((error) => (error ? reject(error) : resolveClose())),
  );
  return address.port;
}

async function waitForAsync(
  predicate: () => Promise<boolean>,
  timeoutMs: number,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return true;
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 25));
  }
  return predicate();
}

async function startDaemon(
  dbPath: string,
  projectRoot: string,
  barrierPath: string,
): Promise<RunningDaemon> {
  const port = await freePort();
  const child = spawn(process.execPath, ["--import", "tsx", DAEMON_ENTRY], {
    env: daemonEnv(port, dbPath, projectRoot, barrierPath),
    stdio: ["ignore", "pipe", "pipe"],
  });
  const diagnostics: string[] = [];
  child.stdout?.on("data", (chunk: Buffer) => diagnostics.push(chunk.toString()));
  child.stderr?.on("data", (chunk: Buffer) => diagnostics.push(chunk.toString()));
  const origin = `http://127.0.0.1:${port}`;
  const healthy = await waitForAsync(async () => {
    if (child.exitCode !== null) return false;
    try {
      return (await fetch(`${origin}/api/health`)).ok;
    } catch {
      return false;
    }
  }, 15_000);
  if (!healthy) {
    await stopProcess(child, "SIGKILL");
    throw new Error(
      `daemon failed to start (exit ${child.exitCode ?? "pending"}): ${diagnostics.join("").slice(-2_000)}`,
    );
  }
  return { child, origin };
}

async function stopProcess(child: ChildProcess, signal: NodeJS.Signals): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill(signal);
  await once(child, "exit");
}

async function readDetail(origin: string, runId: string): Promise<RunDetail> {
  const response = await fetch(`${origin}/api/runs/${runId}`);
  if (!response.ok) throw new Error(`run detail returned ${response.status}`);
  return runDetailSchema.parse(await response.json());
}

async function withDatabase<T>(dbPath: string, read: (db: Db) => T | Promise<T>): Promise<T> {
  const client = createClient(dbPath);
  try {
    return await read(client.db);
  } finally {
    client.sqlite.close();
  }
}

function isIdentityAlive(identity: WorkerIdentity): boolean {
  return readProcessStartTime(identity.pid) === identity.start_time;
}

it(
  "recovers a competition after the daemon and one worker are killed without duplicate work or lost events",
  { timeout: 40_000 },
  async () => {
    const dataDir = mkdtempSync(join(tmpdir(), "otomat-daemon-restart-"));
    const dbPath = join(dataDir, "otomat.db");
    const barrierPath = join(dataDir, "release-fake-runtime");
    const repo = setupTestRepo();
    let daemon: RunningDaemon | null = null;
    const workerIdentities: WorkerIdentity[] = [];

    try {
      daemon = await startDaemon(dbPath, repo.root, barrierPath);
      const launchResponse = await fetch(`${daemon.origin}/api/runs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: "restart proof", runtime: "fake", plan: COMPETE_PLAN }),
      });
      expect(launchResponse.status).toBe(201);
      const launchedRun = runContractSchema.parse(await launchResponse.json());

      const { originalSessions, persistedEvents } = await withDatabase(dbPath, async (db) => {
        expect(
          await waitFor(() => {
            const sessions = listAgentSessionsForRun(db, launchedRun.id);
            return (
              sessions.length === 2 &&
              sessions.every((session) => session.pid !== null && session.pgid !== null) &&
              readRunEvents(db, launchedRun.id).filter(
                (event) => event.type === "runtime.provider_session",
              ).length === 2
            );
          }, 10_000),
        ).toBe(true);
        return {
          originalSessions: listAgentSessionsForRun(db, launchedRun.id),
          persistedEvents: readRunEvents(db, launchedRun.id),
        };
      });
      const originalProcesses = new Map<string, WorkerIdentity>();
      for (const session of originalSessions) {
        if (session.pid === null || session.pgid === null) {
          throw new Error(`session ${session.id} has no durable process identity`);
        }
        const identity = workerIdentitySchema.parse(
          JSON.parse(
            readFileSync(
              join(sessionDir(dataDir, launchedRun.id, session.id), WORKER_IDENTITY_FILE),
              "utf8",
            ),
          ),
        );
        expect(identity).toMatchObject({ pid: session.pid, pgid: session.pgid });
        originalProcesses.set(session.id, identity);
        workerIdentities.push(identity);
      }
      expect(new Set([...originalProcesses.values()].map((process) => process.pid)).size).toBe(2);
      expect(new Set([...originalProcesses.values()].map((process) => process.pgid)).size).toBe(2);
      const persistedEventIds = persistedEvents.map((event) => event.id);
      expect(
        persistedEvents
          .filter((event) => event.type === "runtime.provider_session")
          .map((event) => event.payload["provider_session_id"])
          .toSorted(),
      ).toEqual(originalSessions.map((session) => `fake-session-${session.id}`).toSorted());
      const killedWorker = originalProcesses.get(originalSessions[0]?.id ?? "");
      if (!killedWorker) throw new Error("worker process group was not recorded");
      await stopProcess(daemon.child, "SIGKILL");
      daemon = null;
      killProcessGroup(killedWorker.pgid, "SIGKILL");
      expect(await waitFor(() => !isIdentityAlive(killedWorker))).toBe(true);

      const restartedDaemon = await startDaemon(dbPath, repo.root, barrierPath);
      daemon = restartedDaemon;
      expect(
        await waitFor(() =>
          [...originalProcesses.values()].every((identity) => !isIdentityAlive(identity)),
        ),
      ).toBe(true);
      expect(
        await waitForAsync(
          async () =>
            (await readDetail(restartedDaemon.origin, launchedRun.id)).run.status ===
            "awaiting_human",
          10_000,
        ),
      ).toBe(true);

      const interrupted = await readDetail(restartedDaemon.origin, launchedRun.id);
      expect(interrupted.steps).toHaveLength(2);
      expect(interrupted.steps.every((step) => step.status === "awaiting_human")).toBe(true);
      expect(interrupted.sessions.map((session) => session.id)).toEqual(
        originalSessions.map((session) => session.id),
      );
      expect(new Set(interrupted.sessions.map((session) => session.provider_session_id)).size).toBe(
        2,
      );

      const reconciledEvents = await withDatabase(dbPath, (db) =>
        readRunEvents(db, launchedRun.id),
      );
      expect(reconciledEvents.map((event) => event.id)).toEqual(
        expect.arrayContaining(persistedEventIds),
      );
      expect(new Set(reconciledEvents.map((event) => event.id)).size).toBe(reconciledEvents.length);
      writeFileSync(barrierPath, "resume");
      const resumeResponse = await fetch(
        `${restartedDaemon.origin}/api/runs/${launchedRun.id}/resume`,
        { method: "POST" },
      );
      expect(resumeResponse.ok).toBe(true);
      expect(
        await waitForAsync(
          async () =>
            (await readDetail(restartedDaemon.origin, launchedRun.id)).run.status ===
            "awaiting_selection",
          10_000,
        ),
      ).toBe(true);

      const { completedSteps, completedSessions, completedEvents } = await withDatabase(
        dbPath,
        (db) => ({
          completedSteps: listStepRunsForRun(db, launchedRun.id),
          completedSessions: listAgentSessionsForRun(db, launchedRun.id),
          completedEvents: readRunEvents(db, launchedRun.id),
        }),
      );
      expect(completedSteps).toHaveLength(2);
      expect(completedSessions).toHaveLength(2);
      const resumedPids: number[] = [];
      for (const session of completedSessions) {
        if (session.pid === null || session.pgid === null) {
          throw new Error(`resumed session ${session.id} has no process identity`);
        }
        const originalProcess = originalProcesses.get(session.id);
        if (!originalProcess)
          throw new Error(`session ${session.id} was not present before restart`);
        resumedPids.push(session.pid);
        const resumedIdentity = workerIdentitySchema.parse(
          JSON.parse(
            readFileSync(
              join(sessionDir(dataDir, launchedRun.id, session.id), WORKER_IDENTITY_FILE),
              "utf8",
            ),
          ),
        );
        expect(resumedIdentity).toMatchObject({ pid: session.pid, pgid: session.pgid });
        expect(resumedIdentity).not.toEqual(originalProcess);
        workerIdentities.push(resumedIdentity);
      }
      expect(new Set(resumedPids).size).toBe(2);
      const resumedIdentities = workerIdentities.slice(-2);
      expect(
        await waitFor(() => resumedIdentities.every((identity) => !isIdentityAlive(identity))),
      ).toBe(true);
      expect(new Set(completedEvents.map((event) => event.id)).size).toBe(completedEvents.length);
      for (const session of completedSessions) {
        const sessionEvents = completedEvents.filter(
          (event) => event.agent_session_id === session.id,
        );
        expect(
          sessionEvents.filter((event) => event.type === "runtime.provider_session"),
        ).toHaveLength(1);
        expect(sessionEvents.filter((event) => event.type === "runtime.usage")).toHaveLength(1);
        expect(
          sessionEvents.filter(
            (event) =>
              event.type === "run.lifecycle" && event.payload["final_status"] === "completed",
          ),
        ).toHaveLength(1);
      }
    } finally {
      if (daemon) await stopProcess(daemon.child, "SIGTERM");
      for (const identity of workerIdentities) {
        if (isIdentityAlive(identity)) killProcessGroup(identity.pgid, "SIGKILL");
      }
      repo.cleanup();
      rmSync(dataDir, { recursive: true, force: true });
    }
  },
);
