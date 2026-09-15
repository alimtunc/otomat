import {
  diffMediaTypeForPath,
  saveWorktreeFileRequestSchema,
  MEDIA_BLOB_MAX_BYTES,
  WORKTREE_FILE_MAX_BYTES,
  type WorktreeFileContent,
  type WorktreeFileError,
  type WorktreeFileSaved,
  type WorktreeFilesResponse,
} from "@otomat/domain";
import { Hono, type Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import type { ApiDeps } from "#api/deps";
import { runGuard, validateJson, type RunEnv } from "#api/guards";
import { refusalJson } from "#api/refusal";
import {
  isRepositoryRelative,
  normalizeRepositoryPath,
  worktreeTreeOrNull,
  writeWorktreeFile,
  type WorktreeTree,
} from "#git";

const REFUSALS = {
  workspace_unavailable: [409, "This run has no worktree left to browse."],
  workspace_read_only: [409, "This workspace has no live worktree, so its files are read-only."],
  path_invalid: [400, "The path must name a file inside the worktree."],
  file_not_found: [404, "No file exists at this path in the worktree."],
  file_symlink: [409, "This path is a symlink, which Otomat never follows."],
  file_binary: [409, "This file is binary and has no text to show."],
  file_too_large: [413, "This file is larger than what Otomat opens in place."],
  file_revision_stale: [409, "This file changed in the worktree since it was opened."],
} satisfies Record<WorktreeFileError, [ContentfulStatusCode, string]>;

function refuse(c: Context<RunEnv>, error: WorktreeFileError) {
  const [status, message] = REFUSALS[error];
  return refusalJson(c, { status, error, message });
}

function runTree(deps: ApiDeps, runId: string): WorktreeTree | null {
  const binding = deps.repositories.forRun(runId);
  return binding === null ? null : worktreeTreeOrNull(binding.service, runId);
}

/** Mounted at `/api/runs`: the worktree's own file tree, one file's content at a revision, and the save that presents it back. */
export function createRunFileRoutes(deps: ApiDeps): Hono<RunEnv> {
  const routes = new Hono<RunEnv>();

  routes.get("/:id/files", runGuard(deps.db), (c) => {
    const run = c.get("run");
    const tree = runTree(deps, run.id);
    if (tree === null) return refuse(c, "workspace_unavailable");
    const response: WorktreeFilesResponse = {
      run_id: run.id,
      editable: tree.worktreePath !== null,
      entries: tree.entries(),
    };
    return c.json(response);
  });

  routes.get("/:id/files/content", runGuard(deps.db), (c) => {
    const run = c.get("run");
    const path = normalizeRepositoryPath(c.req.query("path") ?? "");
    if (!isRepositoryRelative(path)) return refuse(c, "path_invalid");
    const tree = runTree(deps, run.id);
    if (tree === null) return refuse(c, "workspace_unavailable");
    const mediaType = diffMediaTypeForPath(path);
    const read = tree.readFile(path, {
      maxBytes: mediaType === null ? WORKTREE_FILE_MAX_BYTES : MEDIA_BLOB_MAX_BYTES,
    });
    switch (read.kind) {
      case "text": {
        const content: WorktreeFileContent = {
          kind: "text",
          path,
          revision: read.oid,
          bytes: read.bytes,
          text: read.text,
        };
        return c.json(content);
      }
      case "binary": {
        if (mediaType === null) return refuse(c, "file_binary");
        const content: WorktreeFileContent = {
          kind: "media",
          path,
          revision: read.oid,
          bytes: read.bytes,
          data: tree.readBlob(read.oid).toString("base64"),
          media_type: mediaType,
        };
        return c.json(content);
      }
      case "too_large":
        return refuse(c, "file_too_large");
      case "symlink":
        return refuse(c, "file_symlink");
      case "directory":
      case "missing":
        return refuse(c, "file_not_found");
    }
  });

  routes.put(
    "/:id/files/content",
    runGuard(deps.db),
    validateJson(saveWorktreeFileRequestSchema),
    (c) => {
      const run = c.get("run");
      const body = c.req.valid("json");
      const path = normalizeRepositoryPath(body.path);
      if (!isRepositoryRelative(path)) return refuse(c, "path_invalid");
      if (Buffer.byteLength(body.text, "utf8") > WORKTREE_FILE_MAX_BYTES) {
        return refuse(c, "file_too_large");
      }
      const tree = runTree(deps, run.id);
      if (tree === null) return refuse(c, "workspace_unavailable");
      if (tree.worktreePath === null) return refuse(c, "workspace_read_only");
      const result = writeWorktreeFile(tree.worktreePath, path, body.revision, body.text);
      switch (result.kind) {
        case "written": {
          const saved: WorktreeFileSaved = { path, revision: result.revision };
          return c.json(saved);
        }
        case "stale":
          return refuse(c, "file_revision_stale");
        case "symlink":
          return refuse(c, "file_symlink");
        case "missing":
          return refuse(c, "file_not_found");
      }
    },
  );

  return routes;
}
