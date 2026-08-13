import { z } from "zod";

import { CONTEXT_FILE_PATH_MAX_LENGTH, CONTEXT_MAX_REFERENCES } from "./limits.js";

/** An identity, never copied text; a file is repository-relative so the same reference resolves on a remote host. */
export const contextReferenceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("issue"), issue_id: z.string().min(1) }),
  z.object({
    kind: z.literal("file"),
    path: z.string().trim().min(1).max(CONTEXT_FILE_PATH_MAX_LENGTH),
  }),
]);
export type ContextReference = z.infer<typeof contextReferenceSchema>;

export const contextReferencesSchema = z.array(contextReferenceSchema).max(CONTEXT_MAX_REFERENCES);

export function contextReferenceKey(reference: ContextReference): string {
  return reference.kind === "issue" ? `issue:${reference.issue_id}` : `file:${reference.path}`;
}
