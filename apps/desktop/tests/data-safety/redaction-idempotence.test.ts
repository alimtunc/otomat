import { expect, it } from "vitest";

import { redactLogText } from "#main/data-safety/redaction";

const CASES = [
  "token=ghp_abcdef1234 listening on port 4319",
  "authorization: Bearer abc123 then more text",
  '{"api_key":"secret","run_id":"r1"}',
  "token=[first, second] tail",
  "prompt: do the thing",
  "api_key = {a:1} trailing",
  "nothing sensitive here",
];

it("is idempotent so re-redaction never destroys surrounding diagnostics", () => {
  for (const input of CASES) {
    const once = redactLogText(input);
    expect(redactLogText(once), input).toBe(once);
  }
});

it("still redacts the secret and keeps the rest of the line", () => {
  const once = redactLogText("token=ghp_abcdef1234 listening on port 4319");
  expect(once).not.toContain("ghp_abcdef1234");
  expect(redactLogText(once)).toContain("listening on port 4319");
});

it("still eats a structured credential value", () => {
  expect(redactLogText("token=[first, second] tail")).not.toContain("first");
});
