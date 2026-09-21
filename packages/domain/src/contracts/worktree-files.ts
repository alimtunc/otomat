import { z } from "zod";

import { diffMediaTypeSchema } from "./diff.js";

/** Text past this is viewed through an outside editor. */
export const WORKTREE_FILE_MAX_BYTES = 1024 * 1024;

export const WORKTREE_FILE_KINDS = ["file", "directory", "symlink", "submodule"] as const;
export const worktreeFileEntrySchema = z.object({
  path: z.string(),
  kind: z.enum(WORKTREE_FILE_KINDS),
  size: z.number().int().nonnegative(),
  /** Git excludes it from the tree, the diff and a PR; a listing never carries one, a creation reports it. */
  ignored: z.boolean(),
});
export type WorktreeFileEntry = z.infer<typeof worktreeFileEntrySchema>;

export const worktreeFilesResponseSchema = z.object({
  run_id: z.string(),
  /** False once only the archived branch tip remains: readable, never written. */
  editable: z.boolean(),
  entries: z.array(worktreeFileEntrySchema),
});
export type WorktreeFilesResponse = z.infer<typeof worktreeFilesResponseSchema>;

export const repositoryTreeResponseSchema = z.object({
  repository_id: z.string(),
  branch: z.string(),
  entries: z.array(worktreeFileEntrySchema),
});
export type RepositoryTreeResponse = z.infer<typeof repositoryTreeResponseSchema>;

/** `revision` is the blob id the content was read at; a save must present it back. */
export const worktreeFileContentSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("text"),
    path: z.string(),
    revision: z.string(),
    bytes: z.number().int().nonnegative(),
    text: z.string(),
    ignored: z.boolean(),
  }),
  z.object({
    kind: z.literal("media"),
    path: z.string(),
    revision: z.string(),
    bytes: z.number().int().nonnegative(),
    data: z.string(),
    media_type: diffMediaTypeSchema,
  }),
]);
export type WorktreeFileContent = z.infer<typeof worktreeFileContentSchema>;

export const saveWorktreeFileRequestSchema = z.object({
  path: z.string().min(1),
  revision: z.string().min(1),
  text: z.string(),
});
export type SaveWorktreeFileRequest = z.infer<typeof saveWorktreeFileRequestSchema>;

export const worktreeFileSavedSchema = z.object({
  path: z.string(),
  revision: z.string(),
});
export type WorktreeFileSaved = z.infer<typeof worktreeFileSavedSchema>;

export const createWorktreeEntryRequestSchema = z.object({
  path: z.string().min(1),
  kind: worktreeFileEntrySchema.shape.kind.extract(["file", "directory"]),
});
export type CreateWorktreeEntryRequest = z.infer<typeof createWorktreeEntryRequestSchema>;

export const WORKTREE_FILE_ERRORS = [
  "workspace_unavailable",
  "workspace_read_only",
  "path_invalid",
  "file_not_found",
  "file_symlink",
  "file_binary",
  "file_too_large",
  "file_revision_stale",
  "path_exists",
  "parent_not_found",
] as const;
export type WorktreeFileError = (typeof WORKTREE_FILE_ERRORS)[number];

export const worktreeFileErrorSchema = z.object({
  error: z.enum(WORKTREE_FILE_ERRORS),
  message: z.string(),
});
