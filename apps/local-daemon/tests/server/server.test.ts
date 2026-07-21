import { mkdtempSync, rmSync } from "node:fs";
import { get } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, expect, it, vi } from "vitest";

import { startDaemon, type DaemonHandle } from "#server";

interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

async function healthStatus(port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const request = get(`http://127.0.0.1:${port}/api/health`, (response) => {
      response.resume();
      response.on("end", () => resolve(response.statusCode ?? 0));
    });
    request.on("error", reject);
  });
}

let daemon: DaemonHandle | null = null;
let scratch: string | null = null;

afterEach(async () => {
  await daemon?.close();
  daemon = null;
  if (scratch !== null) rmSync(scratch, { recursive: true, force: true });
  scratch = null;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete process.env.OTOMAT_LINEAR_API_KEY;
});

it("exposes the daemon before the development Linear connection settles", async () => {
  scratch = mkdtempSync(join(tmpdir(), "otomat-server-"));
  process.env.OTOMAT_LINEAR_API_KEY = "lin_api_development";
  const linearResponse = deferred<Response>();
  const fetchMock = vi.fn(() => linearResponse.promise);
  vi.stubGlobal("fetch", fetchMock);

  let startedHandle: DaemonHandle | null = null;
  const startup = startDaemon({ port: 0, dbPath: join(scratch, "otomat.db") }).then((handle) => {
    startedHandle = handle;
    return handle;
  });
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());

  const startupOrder = await Promise.race([
    startup.then(() => "started" as const),
    new Promise<"blocked">((resolve) => setTimeout(() => resolve("blocked"), 100)),
  ]);

  const response = new Response(
    JSON.stringify({
      data: {
        viewer: { name: "Ada" },
        organization: { id: "workspace-1", name: "Otomat" },
      },
    }),
    { status: 200 },
  );
  if (startupOrder === "blocked") {
    linearResponse.resolve(response);
    startedHandle = await startup;
  }
  daemon = startedHandle;

  expect(startupOrder).toBe("started");
  if (daemon === null) throw new Error("daemon did not start");
  expect(await healthStatus(daemon.port)).toBe(200);
  expect(process.env.OTOMAT_LINEAR_API_KEY).toBeUndefined();

  linearResponse.resolve(response);
});
