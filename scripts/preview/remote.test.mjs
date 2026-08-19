import assert from "node:assert/strict";
import { test } from "node:test";

import {
  INGRESS_MARKER,
  listScript,
  parseInstances,
  parseOutcome,
  provisionScript,
  teardownScript,
} from "./remote.mjs";

const INSTANCE = {
  homeSuffix: ".otomat/instances/1a2b3c4",
  port: 43142,
  hostname: "otomat-pr-142.preview.example.com",
  pullRequest: 142,
  build: "1a2b3c4",
};

test("provisioning keeps every instance disjoint from the stable deployment", () => {
  const script = provisionScript(INSTANCE);
  assert.match(script, /HOME_DIR="\$HOME\/\.otomat\/instances\/1a2b3c4"/);
  assert.match(script, /OTOMAT_DB_PATH="\$HOME_DIR\/data\/otomat\.db"/);
  assert.match(script, /OTOMAT_DAEMON_PORT=43142/);
  assert.ok(!script.includes("$HOME/.otomat/daemon"), "must never touch the stable deployment");
});

test("provisioning binds loopback and relaxes no daemon protection", () => {
  const script = provisionScript(INSTANCE);
  assert.match(script, /OTOMAT_DAEMON_HOST=127\.0\.0\.1/);
  assert.ok(
    !script.includes("OTOMAT_ALLOWED_ORIGINS"),
    "the façade forwards no Origin, so no origin may be allowlisted",
  );
});

test("provisioning is idempotent: an instance already carrying this commit is left alone", () => {
  const script = provisionScript(INSTANCE);
  assert.match(script, /if \[ ! -f "\$HOME_DIR\/daemon\/dist\/index\.js" \]/);
  assert.match(script, /if \[ ! -d "\$HOME_DIR\/data\/test-repo\/\.git" \]/);
  assert.match(script, /grep -aqF "\$ENTRY"/);
});

test("the tunnel only ever reaches loopback, with the daemon's own Host", () => {
  const script = provisionScript(INSTANCE);
  assert.match(script, /service: http:\/\/127\.0\.0\.1/);
  assert.match(script, /httpHostHeader: 127\.0\.0\.1/);
});

test("ingress is re-derived from the instances on disk, under a lock, below the operator's marker", () => {
  for (const script of [provisionScript(INSTANCE), teardownScript(INSTANCE)]) {
    assert.ok(script.includes(INGRESS_MARKER));
    assert.match(script, /flock 9/);
    assert.match(script, /for route in "\$HOME\/\.otomat\/instances"\/\*\/instance\.route/);
  }
});

test("a tunnel config without the marker fails closed instead of being rewritten", () => {
  assert.match(provisionScript(INSTANCE), /NO_INGRESS_MARKER/);
});

test("teardown removes only this instance", () => {
  const script = teardownScript(INSTANCE);
  assert.match(script, /rm -rf "\$HOME_DIR"/);
  assert.ok(!script.includes("rm -rf \"$HOME/.otomat/instances\""));
});

test("a truncated listing never reads as no instances", () => {
  assert.equal(parseInstances("OTOMAT_PREVIEW:INSTANCE:1a2b3c4:142:host:43142\n"), null);
});

test("a complete listing names each instance's pull request and route", () => {
  const stdout = [
    "some login banner",
    "OTOMAT_PREVIEW:INSTANCE:1a2b3c4:142:otomat-pr-142.preview.example.com:43142",
    "OTOMAT_PREVIEW:END:-",
  ].join("\n");
  assert.deepEqual(parseInstances(stdout), [
    {
      build: "1a2b3c4",
      pullRequest: 142,
      hostname: "otomat-pr-142.preview.example.com",
      port: 43142,
    },
  ]);
  assert.match(listScript(), /OTOMAT_PREVIEW:END/);
});

test("the last token is the outcome, so login noise cannot be mistaken for one", () => {
  assert.deepEqual(parseOutcome("noise\nOTOMAT_PREVIEW:STARTED:9\nOTOMAT_PREVIEW:READY:host"), {
    kind: "READY",
    detail: "host",
  });
  assert.equal(parseOutcome("no tokens at all"), null);
});
