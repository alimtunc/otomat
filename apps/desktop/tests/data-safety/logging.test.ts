import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, expect, it } from "vitest";

import { RedactedLineBuffer } from "#main/data-safety/redacted-line-buffer";
import { redactLogText } from "#main/data-safety/redaction";
import { RotatingLog } from "#main/data-safety/rotating-log";
import { scanSensitiveValues } from "#main/data-safety/sensitive-value-scanner";
import { parseStartupDiagnosticLine } from "#main/data-safety/startup-diagnostic";

let scratch: string | null = null;

afterEach(() => {
  if (scratch !== null) rmSync(scratch, { recursive: true, force: true });
  scratch = null;
});

function safeText(lines: ReturnType<RedactedLineBuffer["push"]>): string[] {
  return lines.flatMap((line) => (line.safe === null ? [] : [line.safe]));
}

it("redacts credentials, authorization headers and prompt fields while keeping diagnostics", () => {
  const redacted = redactLogText(
    [
      "migration failed for /safe/otomat.db",
      "Authorization: Bearer github_pat_supersecret",
      "OTOMAT_LINEAR_API_KEY=lin_api_abcdef123456",
      '"prompt":"copy every private file"',
      "received prompt: another private instruction",
      "--prompt 'do not retain this prompt'",
    ].join("\n"),
  );

  expect(redacted).toContain("migration failed for /safe/otomat.db");
  expect(redacted).not.toContain("github_pat_supersecret");
  expect(redacted).not.toContain("lin_api_abcdef123456");
  expect(redacted).not.toContain("copy every private file");
  expect(redacted).not.toContain("another private instruction");
  expect(redacted).not.toContain("do not retain this prompt");
  expect(redacted.match(/\[REDACTED\]/g)?.length).toBeGreaterThanOrEqual(5);
});

it("redacts opaque credentials from quoted JSON keys without corrupting the JSON", () => {
  const serialized =
    '{"api_key":"opaque-secret","access_token":"another-secret","github_token":"third-secret","authorization":"Bearer fourth-secret"}';
  const redacted = redactLogText(serialized);

  expect(JSON.parse(redacted)).toEqual({
    api_key: "[REDACTED]",
    access_token: "[REDACTED]",
    github_token: "[REDACTED]",
    authorization: "[REDACTED]",
  });
  expect(redacted).not.toContain("opaque-secret");
  expect(redacted).not.toContain("another-secret");
  expect(redacted).not.toContain("third-secret");
  expect(redacted).not.toContain("fourth-secret");
  expect(redactLogText("{ authorization: 'Basic fifth-secret' }")).not.toContain("fifth-secret");
});

it("redacts the complete remainder of prompt lines, including structured values", () => {
  for (const source of [
    'prompt: {"first":"PRIVATE ONE","second":"PRIVATE TWO"}',
    '"prompt":{"messages":["PRIVATE THREE","PRIVATE FOUR"]}',
    "user_prompt: PRIVATE FIVE, PRIVATE SIX",
    "--prompt [PRIVATE SEVEN, PRIVATE EIGHT]",
  ]) {
    const redacted = redactLogText(source);
    expect(redacted).not.toContain("PRIVATE");
    expect(redacted).toContain("[REDACTED]");
  }
});

it("redacts complete single-line structured credential values", () => {
  for (const source of [
    "api_key: { credentials: PRIVATE ONE } safe",
    "access_token=[PRIVATE TWO, PRIVATE THREE]",
  ]) {
    expect(redactLogText(source)).not.toContain("PRIVATE");
    const buffer = new RedactedLineBuffer();
    expect(safeText(buffer.push(`${source}\n`)).join("")).not.toContain("PRIVATE");
  }
});

it("redacts multiline sensitive values in direct log text", () => {
  const redacted = redactLogText(
    [
      'prompt="PRIVATE FIRST',
      'PRIVATE SECOND"',
      "api_key: {",
      'value: "PRIVATE CREDENTIAL"',
      "}",
      "Authorization:",
      "Bearer PRIVATE AUTHORIZATION",
      "safe diagnostic",
    ].join("\n"),
  );

  expect(redacted).not.toContain("PRIVATE");
  expect(redacted).toContain("safe diagnostic");
});

it("redacts CR-only multiline text", () => {
  const direct = redactLogText(
    'prompt="PRIVATE ONE\rPRIVATE TWO"\rauthorization: {\rPRIVATE THREE\r}\rsafe diagnostic',
  );
  expect(direct).not.toContain("PRIVATE");
  expect(direct).toContain("safe diagnostic");

  const buffer = new RedactedLineBuffer();
  expect(safeText(buffer.push('prompt="PRIVATE FOUR\rPRIVATE FIVE"\rsafe buffered\r'))).toEqual([
    "[REDACTED MULTILINE VALUE]\n",
  ]);
  expect(safeText(buffer.flush())).toEqual(["safe buffered\n"]);
});

it("resumes after a truncated line whose CR terminator is split across chunks", () => {
  for (const nextChunk of ["SAFE ONE\rSAFE TWO\r", "\nSAFE ONE\r\nSAFE TWO\r"]) {
    const buffer = new RedactedLineBuffer();
    expect(safeText(buffer.push(`${"x".repeat(70_000)}\r`))).toEqual(["[TRUNCATED OUTPUT LINE]\n"]);
    expect(safeText(buffer.push(nextChunk))).toContain("SAFE ONE\n");
    expect(safeText(buffer.flush())).toContain("SAFE TWO\n");
  }
});

it("redacts a credential split across process chunks and drops an overlong line", () => {
  const buffer = new RedactedLineBuffer();
  expect(safeText(buffer.push("token=ghp_secret"))).toEqual([]);
  expect(safeText(buffer.push('value prompt="private'))).toEqual([]);
  const completed = safeText(buffer.push(' instruction"\n'));
  expect(completed).toEqual(["token=[REDACTED] prompt=[REDACTED]\n"]);

  const overlong = safeText(buffer.push(`prompt: ${"private ".repeat(10_000)}`));
  expect(overlong).toEqual(["[TRUNCATED OUTPUT LINE]\n"]);
  expect(safeText(buffer.push("still private\nsafe diagnostic\n"))).toEqual(["safe diagnostic\n"]);
});

it("resumes logging after discarding an overlong quoted prompt", () => {
  const buffer = new RedactedLineBuffer();
  expect(safeText(buffer.push(`prompt="${"private ".repeat(10_000)}`))).toEqual([
    "[TRUNCATED OUTPUT LINE]\n",
  ]);
  expect(safeText(buffer.push('closing secret"\nsafe diagnostic\n'))).toEqual([
    "safe diagnostic\n",
  ]);
});

it("discards a quoted prompt continuation across physical log lines", () => {
  const buffer = new RedactedLineBuffer();
  expect(safeText(buffer.push('prompt: "first secret\n'))).toEqual([
    "[REDACTED MULTILINE VALUE]\n",
  ]);
  expect(safeText(buffer.push('second secret"\nsafe diagnostic\n'))).toEqual(["safe diagnostic\n"]);
  expect(safeText(buffer.push('{"prompt":"third secret\n'))).toEqual([
    "[REDACTED MULTILINE VALUE]\n",
  ]);
  expect(safeText(buffer.push('fourth secret"}\nnext diagnostic\n'))).toEqual([
    "}\n",
    "next diagnostic\n",
  ]);
});

it("preserves escaped prompt quotes across lines and truncated chunks", () => {
  const multiline = new RedactedLineBuffer();
  expect(safeText(multiline.push('prompt: "first secret\\\n'))).toEqual([
    "[REDACTED MULTILINE VALUE]\n",
  ]);
  expect(
    safeText(multiline.push('"still secret\nLEAKED SECRET\nclosing"\nsafe diagnostic\n')),
  ).toEqual(["safe diagnostic\n"]);

  const truncated = new RedactedLineBuffer();
  expect(safeText(truncated.push(`prompt="${"x".repeat(70_000)}\\`))).toEqual([
    "[TRUNCATED OUTPUT LINE]\n",
  ]);
  expect(
    safeText(truncated.push('"still secret\nLEAKED SECRET\nclosing"\nsafe diagnostic\n')),
  ).toEqual(["safe diagnostic\n"]);
});

it("detects a prompt opened after truncation even when its marker spans chunks", () => {
  const buffer = new RedactedLineBuffer();
  expect(safeText(buffer.push("x".repeat(70_000)))).toEqual(["[TRUNCATED OUTPUT LINE]\n"]);
  expect(safeText(buffer.push(" pro"))).toEqual([]);
  expect(safeText(buffer.push('mpt: "first secret\n'))).toEqual([]);
  expect(safeText(buffer.push('LEAKED SECRET\nclosing"\nsafe diagnostic\n'))).toEqual([
    "safe diagnostic\n",
  ]);
});

it("detects sensitive values after truncation across arbitrarily long whitespace", () => {
  for (const [opening, continuation] of [
    [" prompt:", '"PRIVATE PROMPT\n'],
    [' "access_token":', '"PRIVATE ACCESS TOKEN\n'],
    [" token=", '"PRIVATE TOKEN\n'],
  ]) {
    const buffer = new RedactedLineBuffer();
    expect(safeText(buffer.push("x".repeat(70_000)))).toEqual(["[TRUNCATED OUTPUT LINE]\n"]);
    expect(safeText(buffer.push(`${opening}${" ".repeat(300)}`))).toEqual([]);
    expect(safeText(buffer.push(continuation))).toEqual([]);
    expect(safeText(buffer.push('PRIVATE CONTINUATION"\nsafe diagnostic\n'))).toEqual([
      "safe diagnostic\n",
    ]);
  }

  const authorization = new RedactedLineBuffer();
  expect(safeText(authorization.push("x".repeat(70_000)))).toEqual(["[TRUNCATED OUTPUT LINE]\n"]);
  expect(safeText(authorization.push(` Authorization:${" ".repeat(300)}`))).toEqual([]);
  expect(safeText(authorization.push("Bearer\n"))).toEqual([]);
  expect(safeText(authorization.push("PRIVATE BEARER\nsafe diagnostic\n"))).toEqual([
    "safe diagnostic\n",
  ]);
});

it("discards multiline structured prompt values until their balanced close", () => {
  for (const [opening, closing] of [
    ['prompt: {"messages":[\n', "]}\n"],
    ['"user_prompt":[{"content":"PRIVATE OPEN\n', '"}]\n'],
  ]) {
    const buffer = new RedactedLineBuffer();
    expect(safeText(buffer.push(opening))).toEqual(["[REDACTED MULTILINE VALUE]\n"]);
    expect(safeText(buffer.push("PRIVATE MIDDLE\n"))).toEqual([]);
    expect(safeText(buffer.push(`${closing}safe diagnostic\n`))).toEqual(["safe diagnostic\n"]);
  }
});

it("discards multiline structured credentials", () => {
  for (const opening of ["authorization: {\n", "api_key: [\n"]) {
    const buffer = new RedactedLineBuffer();
    expect(safeText(buffer.push(opening))).toEqual(["[REDACTED MULTILINE VALUE]\n"]);
    expect(safeText(buffer.push("OPAQUE PRIVATE CREDENTIAL\n"))).toEqual([]);
    const closing = opening.includes("{") ? "}" : "]";
    expect(safeText(buffer.push(`${closing}\nsafe diagnostic\n`))).toEqual(["safe diagnostic\n"]);
  }
});

it("does not expose an inline secret when a multiline credential opens", () => {
  for (const source of [
    'api_key="PRIVATE FIRST\nSECOND"\n',
    '"access_token":"PRIVATE THIRD\nFOURTH"\n',
    "authorization: { credentials: PRIVATE FIFTH\n}\n",
  ]) {
    expect(redactLogText(source)).not.toContain("PRIVATE");
  }
});

it("discards sensitive assignments whose value starts on the next line", () => {
  for (const source of [
    '"authorization":\n"Bearer PRIVATE AUTH"\nsafe\n',
    '"access_token":\n"PRIVATE ACCESS"\nsafe\n',
    "api_key:\nPRIVATE KEY\nsafe\n",
  ]) {
    expect(redactLogText(source)).not.toContain("PRIVATE");
    const buffer = new RedactedLineBuffer();
    expect(safeText(buffer.push(source)).join("")).not.toContain("PRIVATE");
  }
});

it("bounds structured nesting and remains conservatively redacted after overflow", () => {
  let scan = scanSensitiveValues("prompt: [", null);
  for (let index = 0; index < 100; index += 1) {
    scan = scanSensitiveValues("[".repeat(1_000), scan.state);
  }

  expect(scan).toEqual({ state: { kind: "opaque" }, trailingText: "" });
  expect(scanSensitiveValues("]".repeat(100_001) + "PRIVATE", scan.state)).toEqual({
    state: { kind: "opaque" },
    trailingText: "",
  });
});

it("tracks quoted credentials and wrapped authorization values across lines", () => {
  for (const opening of [
    'token="first secret\n',
    '{"access_token":"first secret\n',
    "api_key='first secret\r\n",
    '{"authorization":"Bearer first secret\n',
    "authorization='Basic first secret\r\n",
  ]) {
    const buffer = new RedactedLineBuffer();
    expect(safeText(buffer.push(opening))).toEqual(["[REDACTED MULTILINE VALUE]\n"]);
    expect(
      safeText(buffer.push(`LEAKED CREDENTIAL\nclosing${opening.includes("'") ? "'" : '"'}\n`)),
    ).toEqual([]);
    expect(safeText(buffer.push("safe diagnostic\n"))).toEqual(["safe diagnostic\n"]);
  }

  const authorization = new RedactedLineBuffer();
  expect(safeText(authorization.push("Authorization: Bearer\r\n"))).toEqual([
    "Authorization: [REDACTED]\n",
  ]);
  expect(safeText(authorization.push("LEAKED BEARER\nsafe diagnostic\n"))).toEqual([
    "safe diagnostic\n",
  ]);

  const wrappedBeforeScheme = new RedactedLineBuffer();
  expect(safeText(wrappedBeforeScheme.push("Authorization:\r\n"))).toEqual([
    "[REDACTED MULTILINE VALUE]\n",
  ]);
  expect(safeText(wrappedBeforeScheme.push("Bearer\r\n"))).toEqual([]);
  expect(safeText(wrappedBeforeScheme.push("OPAQUE PRIVATE\r\nsafe diagnostic\r\n"))).toEqual([
    "safe diagnostic\n",
  ]);

  for (const longContinuation of [
    `Bearer${" ".repeat(70_000)}\n`,
    `${" ".repeat(70_000)}\nBearer\n`,
  ]) {
    const truncated = new RedactedLineBuffer();
    expect(safeText(truncated.push("Authorization:\n"))).toEqual(["[REDACTED MULTILINE VALUE]\n"]);
    expect(safeText(truncated.push(longContinuation))).toContain("[TRUNCATED OUTPUT LINE]\n");
    expect(safeText(truncated.push("OPAQUE PRIVATE\nsafe diagnostic\n"))).toEqual([
      "safe diagnostic\n",
    ]);
  }
});

it("redacts multi-word and escaped-quote prompt values", () => {
  const assigned = redactLogText("prompt=another private instruction");
  const flagged = redactLogText('--prompt "first \\"SECOND PRIVATE" --safe');

  expect(assigned).toBe("prompt=[REDACTED]");
  expect(assigned).not.toContain("private instruction");
  expect(flagged).toBe("--prompt [REDACTED]");
  expect(flagged).not.toContain("SECOND PRIVATE");
});

it("continues tracking when another prompt opens after a multiline closing quote", () => {
  for (const opening of ['prompt="first secret\n', `prompt="${"x".repeat(70_000)}`]) {
    const buffer = new RedactedLineBuffer();
    const firstOutput = safeText(buffer.push(opening));
    expect(firstOutput).toEqual([
      opening.length > 65_536 ? "[TRUNCATED OUTPUT LINE]\n" : "[REDACTED MULTILINE VALUE]\n",
    ]);
    expect(safeText(buffer.push('end" prompt="SECOND PRIVATE\n'))).toEqual([]);
    expect(safeText(buffer.push('THIRD PRIVATE" safe diagnostic\n'))).toEqual([
      " safe diagnostic\n",
    ]);
  }
});

it("handles even escapes, CRLF and flush without exposing a prompt continuation", () => {
  const even = new RedactedLineBuffer();
  expect(safeText(even.push('prompt: "secret\\\\\n'))).toEqual(["[REDACTED MULTILINE VALUE]\n"]);
  expect(safeText(even.push('" safe diagnostic\n'))).toEqual([" safe diagnostic\n"]);

  const oddCrLf = new RedactedLineBuffer();
  expect(safeText(oddCrLf.push('prompt: "secret\\\r\n'))).toEqual(["[REDACTED MULTILINE VALUE]\n"]);
  expect(safeText(oddCrLf.push('"still secret\r\nclosing"\r\nsafe diagnostic\r\n'))).toEqual([
    "safe diagnostic\n",
  ]);

  const openAtFlush = new RedactedLineBuffer();
  expect(safeText(openAtFlush.push('prompt="secret\n'))).toEqual(["[REDACTED MULTILINE VALUE]\n"]);
  expect(safeText(openAtFlush.push("still secret"))).toEqual([]);
  expect(safeText(openAtFlush.flush())).toEqual([]);

  const closeAtFlush = new RedactedLineBuffer();
  expect(safeText(closeAtFlush.push('prompt="secret\n'))).toEqual(["[REDACTED MULTILINE VALUE]\n"]);
  expect(safeText(closeAtFlush.push('closing" safe diagnostic'))).toEqual([]);
  expect(safeText(closeAtFlush.flush())).toEqual([" safe diagnostic\n"]);
});

it("parses the raw diagnostic before a log-safe copy can alter its JSON", () => {
  const line =
    '[otomat-startup-diagnostic] {"code":"database_corrupt","message":"Damaged","backup_path":"/tmp/token=secret/otomat-backup.sqlite","available_bytes":null,"required_bytes":null}';
  expect(parseStartupDiagnosticLine(line)).toMatchObject({
    kind: "valid",
    diagnostic: { backup_path: "/tmp/token=secret/otomat-backup.sqlite" },
  });
});

it("ignores a diagnostic marker that does not start the stderr line", () => {
  expect(
    parseStartupDiagnosticLine('Error: [otomat-startup-diagnostic] {"code":"database_missing"}'),
  ).toEqual({ kind: "none" });
});

it("rotates to a bounded number of already-redacted files", () => {
  scratch = mkdtempSync(join(tmpdir(), "otomat-rotating-log-"));
  const log = new RotatingLog(join(scratch, "daemon.log"), { maxBytes: 90, archives: 2 });

  for (let index = 0; index < 12; index += 1) {
    log.write(`entry ${index} token=ghp_secretvalue prompt="private ${index}" padding padding`);
  }

  const files = readdirSync(scratch).toSorted();
  expect(files).toEqual(["daemon.log", "daemon.log.1", "daemon.log.2"]);
  const contents = files.map((file) => readFileSync(join(scratch!, file), "utf8")).join("\n");
  expect(contents).not.toContain("ghp_secretvalue");
  expect(contents).not.toContain("private");
  expect(contents).toContain("[REDACTED]");
});

it("refuses a symlinked log without reading or mutating its target", () => {
  scratch = mkdtempSync(join(tmpdir(), "otomat-log-link-"));
  const target = join(scratch, "outside.log");
  const logPath = join(scratch, "daemon.log");
  writeFileSync(target, "private target");
  symlinkSync(target, logPath);
  const log = new RotatingLog(logPath, { maxBytes: 90, archives: 2 });

  expect(() => log.read()).toThrow(/regular file/);
  expect(() => log.write("new content")).toThrow(/regular file/);
  expect(readFileSync(target, "utf8")).toBe("private target");
});

it("refuses a dangling symlinked log instead of creating its target", () => {
  scratch = mkdtempSync(join(tmpdir(), "otomat-log-dangling-link-"));
  const target = join(scratch, "missing-target.log");
  const logPath = join(scratch, "daemon.log");
  symlinkSync(target, logPath);
  const log = new RotatingLog(logPath, { maxBytes: 90, archives: 2 });

  expect(() => log.write("new content")).toThrow(/regular file/);
  expect(existsSync(target)).toBe(false);
});
