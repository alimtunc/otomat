import { z } from "zod";

import { diffFileContractSchema, diffSideSchema, type DiffFileContract } from "./diff.js";

export const COMMIT_MESSAGE_MAX_LENGTH = 10_000;

export const checkoutTargetSchema = z.object({
  kind: z.enum(["repository", "run"]),
  id: z.string().min(1),
});
export type CheckoutTarget = z.infer<typeof checkoutTargetSchema>;

export const sourceControlResponseSchema = z.object({
  branch: z.string(),
  revision: z.string(),
  staged: z.array(diffFileContractSchema),
  unstaged: z.array(diffFileContractSchema),
  conflicts: z.array(z.string()),
});
export type SourceControlResponse = z.infer<typeof sourceControlResponseSchema>;

export const changeSelectionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("hunk"), index: z.number().int().nonnegative() }),
  z
    .object({
      kind: z.literal("lines"),
      side: diffSideSchema,
      start: z.number().int().positive(),
      end: z.number().int().positive(),
    })
    .refine((range) => range.end >= range.start),
]);
export type ChangeSelection = z.infer<typeof changeSelectionSchema>;

/** Git applies a partial patch only to text a plain modification produced; renames, additions and binaries move whole. */
export function changeSupportsSelection(file: DiffFileContract): boolean {
  return file.status === "modified" && file.old_path === null && !file.binary;
}

export const sourceControlActionSchema = z.enum(["stage", "unstage", "discard"]);
export type SourceControlAction = z.infer<typeof sourceControlActionSchema>;

export const changeFilesRequestSchema = z
  .object({
    revision: z.string().min(1),
    path: z.string().min(1).optional(),
    all: z.literal(true).optional(),
    action: sourceControlActionSchema,
    selection: changeSelectionSchema.optional(),
  })
  .refine(
    ({ all, path, selection }) =>
      all === true ? path === undefined && selection === undefined : path !== undefined,
    "Choose one file or all changes.",
  );
export type ChangeFilesRequest = z.infer<typeof changeFilesRequestSchema>;

export const commitFilesRequestSchema = z.object({
  revision: z.string().min(1),
  message: z.string().trim().min(1).max(COMMIT_MESSAGE_MAX_LENGTH),
});
export type CommitFilesRequest = z.infer<typeof commitFilesRequestSchema>;

export const commitFilesResponseSchema = z.object({ sha: z.string().min(1) });
export type CommitFilesResponse = z.infer<typeof commitFilesResponseSchema>;
