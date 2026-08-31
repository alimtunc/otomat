import { afterEach, expect, it, vi } from "vitest";

import { pushLinearKey } from "#shared/linear-handoff";
import { connected, OTOMAT } from "#support/linear-daemons";

const CONNECTED = connected(OTOMAT.id, OTOMAT.label);

afterEach(() => {
  vi.unstubAllGlobals();
});

it("accepts a key only when the daemon connected", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(CONNECTED)));

  await expect(pushLinearKey("http://127.0.0.1:4319", OTOMAT)).resolves.toBeUndefined();
});

it("rejects an HTTP-success response when Linear refused the key", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      Response.json({
        ...CONNECTED,
        status: "failed",
        error_code: "linear_unauthorized",
        error_message: "Linear rejected the API key.",
      }),
    ),
  );

  await expect(pushLinearKey("http://127.0.0.1:4319", OTOMAT)).rejects.toThrow(
    "Linear rejected the API key.",
  );
});

it("rejects a daemon that answers without holding the key", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(Response.json({ ...CONNECTED, status: "disconnected" })),
  );

  await expect(pushLinearKey("http://127.0.0.1:4319", OTOMAT)).rejects.toThrow(
    "The daemon did not connect to Linear.",
  );
});

it("surfaces a typed daemon refusal from a non-success response", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      Response.json(
        {
          error: "linear_request_superseded",
          message: "A newer Linear connection state replaced this request.",
        },
        { status: 502 },
      ),
    ),
  );

  await expect(pushLinearKey("http://127.0.0.1:4319", OTOMAT)).rejects.toThrow(
    "A newer Linear connection state replaced this request.",
  );
});
