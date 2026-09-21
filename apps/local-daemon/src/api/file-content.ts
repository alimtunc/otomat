import {
  diffMediaTypeForPath,
  MEDIA_BLOB_MAX_BYTES,
  WORKTREE_FILE_MAX_BYTES,
  type WorktreeFileContent,
  type WorktreeFileError,
  type WorktreeFileSaved,
  type SaveWorktreeFileRequest,
  type CreateWorktreeEntryRequest,
} from "@otomat/domain";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import {
  isCreatableRepositoryPath,
  isRepositoryRelative,
  normalizeRepositoryPath,
  writeWorktreeFile,
  createWorktreeEntry,
  readIgnoredFile,
  type WorktreeTree,
} from "#git";

import { refusalJson } from "./refusal.js";

const REFUSALS = {
  workspace_unavailable: [409, "This workspace is no longer available."],
  workspace_read_only: [409, "This workspace is read-only."],
  path_invalid: [400, "The path must name a file inside the workspace."],
  file_not_found: [404, "No file exists at this path."],
  file_symlink: [409, "This path is a symlink, which Otomat never follows."],
  file_binary: [409, "This file is binary and has no text to show."],
  file_too_large: [413, "This file is larger than what Otomat opens in place."],
  file_revision_stale: [409, "This file changed since it was opened."],
  path_exists: [409, "A file or folder already exists at this path."],
  parent_not_found: [409, "The parent folder does not exist."],
} satisfies Record<WorktreeFileError, [ContentfulStatusCode, string]>;

export function refuseFile(c: Context, error: WorktreeFileError) {
  const [status, message] = REFUSALS[error];
  return refusalJson(c, { status, error, message });
}

export function createEntryResponse(c: Context, cwd: string, request: CreateWorktreeEntryRequest) {
  const path = normalizeRepositoryPath(request.path);
  if (!isCreatableRepositoryPath(path)) return refuseFile(c, "path_invalid");
  const created = createWorktreeEntry(cwd, { ...request, path });
  return typeof created === "string" ? refuseFile(c, created) : c.json(created, 201);
}

export function saveFileResponse(c: Context, cwd: string, request: SaveWorktreeFileRequest) {
  const path = normalizeRepositoryPath(request.path);
  if (!isRepositoryRelative(path)) return refuseFile(c, "path_invalid");
  if (Buffer.byteLength(request.text, "utf8") > WORKTREE_FILE_MAX_BYTES)
    return refuseFile(c, "file_too_large");
  const result = writeWorktreeFile(cwd, path, request.revision, request.text);
  switch (result.kind) {
    case "written":
      return c.json({ path, revision: result.revision } satisfies WorktreeFileSaved);
    case "stale":
      return refuseFile(c, "file_revision_stale");
    case "symlink":
      return refuseFile(c, "file_symlink");
    case "missing":
      return refuseFile(c, "file_not_found");
  }
}

export function fileContentResponse(c: Context, tree: WorktreeTree, path: string) {
  const mediaType = diffMediaTypeForPath(path);
  const captured = tree.readFile(path, {
    maxBytes: mediaType === null ? WORKTREE_FILE_MAX_BYTES : MEDIA_BLOB_MAX_BYTES,
  });
  const live = captured.kind === "missing" ? tree.worktreePath : null;
  const read =
    live === null ? captured : readIgnoredFile(live, path, { maxBytes: WORKTREE_FILE_MAX_BYTES });
  switch (read.kind) {
    case "text":
      return c.json({
        kind: "text",
        path,
        revision: read.oid,
        bytes: read.bytes,
        text: read.text,
        ignored: live !== null,
      } satisfies WorktreeFileContent);
    case "binary":
      if (mediaType === null || live !== null) return refuseFile(c, "file_binary");
      return c.json({
        kind: "media",
        path,
        revision: read.oid,
        bytes: read.bytes,
        data: tree.readBlob(read.oid).toString("base64"),
        media_type: mediaType,
      } satisfies WorktreeFileContent);
    case "too_large":
      return refuseFile(c, "file_too_large");
    case "symlink":
      return refuseFile(c, "file_symlink");
    case "directory":
    case "missing":
      return refuseFile(c, "file_not_found");
  }
}
