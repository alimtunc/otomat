import { expect, it, vi } from "vitest";

import { pushLinearKey } from "#shared/linear-handoff";

const CONNECTED = {
  status: "connected",
  workspace_id: "workspace-1",
  workspace_name: "Otomat",
  user_name: "Alim",
  error_code: null,
  error_message: null,
} as const;

it("accepts a key only when the daemon connected", async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json(CONNECTED));

  await expect(
    pushLinearKey({ daemonUrl: "http://127.0.0.1:4319", apiKey: "lin_api_key", fetch }),
  ).resolves.toEqual(CONNECTED);
});

it("rejects an HTTP-success response when Linear refused the key", async () => {
  const fetch = vi.fn().mockResolvedValue(
    Response.json({
      status: "failed",
      workspace_id: null,
      workspace_name: null,
      user_name: null,
      error_code: "linear_unauthorized",
      error_message: "Linear rejected the API key.",
    }),
  );

  await expect(
    pushLinearKey({ daemonUrl: "http://127.0.0.1:4319", apiKey: "bad-key", fetch }),
  ).rejects.toThrow("Linear rejected the API key.");
});

it("surfaces a typed daemon refusal from a non-success response", async () => {
  const fetch = vi.fn().mockResolvedValue(
    Response.json(
      {
        error: "linear_request_superseded",
        message: "A newer Linear connection state replaced this request.",
      },
      { status: 502 },
    ),
  );

  await expect(
    pushLinearKey({ daemonUrl: "http://127.0.0.1:4319", apiKey: "first-key", fetch }),
  ).rejects.toThrow("A newer Linear connection state replaced this request.");
});
