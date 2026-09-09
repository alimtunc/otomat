import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";

import { z } from "zod";

const contextSchema = z.object({
  type: z.literal("turn_context"),
  payload: z.object({
    approval_policy: z.string(),
    approvals_reviewer: z.string().optional(),
    sandbox_policy: z.object({ type: z.string() }),
  }),
});

type CodexSmokeContext = z.infer<typeof contextSchema>["payload"];

export async function startCodexSmokeProvider(home: string): Promise<() => Promise<void>> {
  const server = createServer((request, response) => {
    request.resume();
    request.on("end", () => {
      if (!request.url?.endsWith("/responses")) {
        response.writeHead(404).end();
        return;
      }
      const item = {
        type: "message",
        id: "msg_smoke",
        role: "assistant",
        status: "completed",
        content: [{ type: "output_text", text: "OK", annotations: [] }],
      };
      const events = [
        {
          type: "response.created",
          response: { id: "resp_smoke", status: "in_progress", output: [] },
        },
        { type: "response.output_item.added", output_index: 0, item: { ...item, content: [] } },
        {
          type: "response.output_text.delta",
          output_index: 0,
          content_index: 0,
          item_id: item.id,
          delta: "OK",
        },
        { type: "response.output_item.done", output_index: 0, item },
        {
          type: "response.completed",
          response: {
            id: "resp_smoke",
            status: "completed",
            output: [item],
            usage: {
              input_tokens: 1,
              output_tokens: 1,
              total_tokens: 2,
              input_tokens_details: { cached_tokens: 0 },
            },
          },
        },
      ];
      response.writeHead(200, { "Content-Type": "text/event-stream" });
      response.end(
        events.map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(""),
      );
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (address === null || typeof address === "string")
    throw new Error("missing smoke server address");
  writeFileSync(
    join(home, "config.toml"),
    [
      'model = "fixture"',
      'model_provider = "fixture"',
      'sandbox_mode = "read-only"',
      'approval_policy = "on-request"',
      "[features]",
      "shell_snapshot = false",
      "[model_providers.fixture]",
      'name = "Local smoke fixture"',
      `base_url = "http://127.0.0.1:${address.port}/v1"`,
      'wire_api = "responses"',
      "requires_openai_auth = false",
    ].join("\n"),
  );
  return () =>
    new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

export function codexSmokeContexts(home: string, sessionId: string): CodexSmokeContext[] {
  return readdirSync(join(home, "sessions"), { recursive: true, withFileTypes: true })
    .filter((file) => file.isFile() && file.name.endsWith(`${sessionId}.jsonl`))
    .flatMap((file) =>
      readFileSync(join(file.parentPath, file.name), "utf8")
        .trim()
        .split("\n")
        .map((line) => contextSchema.safeParse(JSON.parse(line))),
    )
    .flatMap((frame) => (frame.success ? [frame.data.payload] : []));
}
