import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, expect, it } from "vitest";

import { findLatestManagedBackup } from "#main/data-safety/backup-discovery";
import { prepareDataDirectory } from "#main/data-safety/directory";

let scratch: string | null = null;

afterEach(() => {
  if (scratch !== null) rmSync(scratch, { recursive: true, force: true });
  scratch = null;
});

it("creates and revalidates a versioned managed layout without moving legacy data", () => {
  scratch = mkdtempSync(join(tmpdir(), "otomat-data-layout-"));
  const legacyDb = join(scratch, "otomat.db");
  writeFileSync(legacyDb, "legacy-bytes");

  const layout = prepareDataDirectory(scratch);
  expect(layout.dbPath).toBe(legacyDb);
  expect(existsSync(layout.backupsDir)).toBe(true);
  expect(existsSync(layout.logsDir)).toBe(true);
  expect(JSON.parse(readFileSync(layout.manifestPath, "utf8"))).toMatchObject({
    version: 1,
  });

  expect(prepareDataDirectory(scratch)).toEqual(layout);
  expect(readFileSync(legacyDb, "utf8")).toBe("legacy-bytes");
});

it("removes only interrupted managed manifest copies before publishing the layout", () => {
  scratch = mkdtempSync(join(tmpdir(), "otomat-data-layout-interrupted-"));
  const interrupted = join(
    scratch,
    "data-layout.json.123e4567-e89b-42d3-a456-426614174000.partial",
  );
  const interruptedLink = join(
    scratch,
    "data-layout.json.123e4567-e89b-42d3-a456-426614174001.partial",
  );
  const linkTarget = join(scratch, "link-target");
  const nearMatch = join(scratch, "data-layout.json.123e4567-e89b-52d3-a456-426614174002.partial");
  const unrelated = join(scratch, "unrelated.partial");
  writeFileSync(interrupted, "incomplete");
  writeFileSync(linkTarget, "preserve");
  symlinkSync(linkTarget, interruptedLink);
  writeFileSync(nearMatch, "preserve");
  writeFileSync(unrelated, "preserve");

  const layout = prepareDataDirectory(scratch);

  expect(existsSync(layout.manifestPath)).toBe(true);
  expect(existsSync(interrupted)).toBe(false);
  expect(existsSync(interruptedLink)).toBe(false);
  expect(readFileSync(linkTarget, "utf8")).toBe("preserve");
  expect(readFileSync(nearMatch, "utf8")).toBe("preserve");
  expect(readFileSync(unrelated, "utf8")).toBe("preserve");
});

it("rejects an unsupported manifest without deleting the database", () => {
  const dir = mkdtempSync(join(tmpdir(), "otomat-data-version-"));
  scratch = dir;
  const dbPath = join(dir, "otomat.db");
  writeFileSync(dbPath, "keep-me");
  writeFileSync(
    join(dir, "data-layout.json"),
    JSON.stringify({ version: 2, created_at: "2026-07-23T10:00:00.000Z" }),
  );

  expect(() => prepareDataDirectory(dir)).toThrow(
    expect.objectContaining({ code: "unsupported_layout" }),
  );
  expect(readFileSync(dbPath, "utf8")).toBe("keep-me");
});

it("rejects a known directory path when it is a file", () => {
  const dir = mkdtempSync(join(tmpdir(), "otomat-data-shape-"));
  scratch = dir;
  writeFileSync(join(dir, "runs"), "not a directory");

  expect(() => prepareDataDirectory(dir)).toThrow(
    expect.objectContaining({ code: "invalid_structure" }),
  );
  expect(readFileSync(join(dir, "runs"), "utf8")).toBe("not a directory");
});

it("rejects a symlinked data-layout manifest without reading its target", () => {
  scratch = mkdtempSync(join(tmpdir(), "otomat-data-manifest-link-"));
  const target = join(scratch, "outside.json");
  writeFileSync(target, JSON.stringify({ version: 1, created_at: "2026-07-23T10:00:00.000Z" }));
  symlinkSync(target, join(scratch, "data-layout.json"));

  expect(() => prepareDataDirectory(scratch!)).toThrow(
    expect.objectContaining({ code: "invalid_structure" }),
  );
  expect(readFileSync(target, "utf8")).toContain('"version":1');
});

it("rejects dangling symlinks for managed database and manifest paths", () => {
  scratch = mkdtempSync(join(tmpdir(), "otomat-data-dangling-links-"));
  const missingDatabase = join(scratch, "missing-database");
  symlinkSync(missingDatabase, join(scratch, "otomat.db"));

  expect(() => prepareDataDirectory(scratch!)).toThrow(
    expect.objectContaining({ code: "invalid_structure" }),
  );
  expect(existsSync(missingDatabase)).toBe(false);

  rmSync(join(scratch, "otomat.db"));
  const missingManifest = join(scratch, "missing-manifest");
  symlinkSync(missingManifest, join(scratch, "data-layout.json"));
  expect(() => prepareDataDirectory(scratch!)).toThrow(
    expect.objectContaining({ code: "invalid_structure" }),
  );
  expect(existsSync(missingManifest)).toBe(false);
});

it("rejects a data root that is not a regular directory", () => {
  scratch = mkdtempSync(join(tmpdir(), "otomat-data-root-"));
  const root = join(scratch, "user-data");
  writeFileSync(root, "not a directory");

  expect(() => prepareDataDirectory(root)).toThrow(
    expect.objectContaining({ code: "invalid_structure" }),
  );
  expect(readFileSync(root, "utf8")).toBe("not a directory");
});

it("selects only the newest regular managed SQLite backup", () => {
  const dir = mkdtempSync(join(tmpdir(), "otomat-data-backups-"));
  scratch = dir;
  const layout = prepareDataDirectory(dir);
  const older = join(
    layout.backupsDir,
    "otomat-backup-2026-07-23T10-00-00.000Z-123e4567-e89b-42d3-a456-426614174000.sqlite",
  );
  const newer = join(
    layout.backupsDir,
    "otomat-backup-2026-07-23T11-00-00.000Z-123e4567-e89b-42d3-b456-426614174001.sqlite",
  );
  const unrelated = join(
    layout.backupsDir,
    "otomat-backup-2026-99-99T99-99-99.999Z-123e4567-e89b-42d3-a456-426614174000.sqlite",
  );
  writeFileSync(older, "old");
  writeFileSync(newer, "new");
  writeFileSync(unrelated, "not managed");
  const now = new Date();
  const earlier = new Date(now.getTime() - 10_000);
  utimesSync(older, earlier, earlier);
  utimesSync(newer, now, now);
  utimesSync(unrelated, new Date(now.getTime() + 10_000), new Date(now.getTime() + 10_000));
  writeFileSync(join(layout.backupsDir, "ignored.txt"), "not a backup");

  expect(findLatestManagedBackup(layout.backupsDir, "otomat.db")).toBe(newer);
  expect(findLatestManagedBackup(layout.backupsDir, "otomat.db", new Set([newer]))).toBe(older);
});
