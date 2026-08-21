import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const dockerfile = readFileSync(new URL("./Dockerfile", import.meta.url), "utf8");

test("enables the simulated runtime, the only one a preview container can run", () => {
  assert.match(dockerfile, /OTOMAT_ENABLE_FAKE_RUNTIME=1/);
});

test("installs no provider CLI, so a preview never claims a real runtime", () => {
  const base = readFileSync(new URL("./base.Dockerfile", import.meta.url), "utf8");
  for (const image of [dockerfile, base]) {
    assert.doesNotMatch(image, /@anthropic-ai\/claude-code|@openai\/codex/);
  }
});
