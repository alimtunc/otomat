import { z } from "zod";

import { RUN_INTERACTION_KINDS, RUN_STATES, STEP_RUN_STATES } from "./entity-states.js";

const conversationParticipantSchema = z.object({
  runtime: z.string().min(1),
  profile_name: z.string().nullable(),
  /** The model the provider reported for the latest turn, else the one the configuration requested. */
  model: z.string().nullable(),
  effort: z.string().nullable(),
});
export type ConversationParticipant = z.infer<typeof conversationParticipantSchema>;

export const conversationEntrySchema = z.object({
  /** `conversation:<step_run_id>`: the id an `inbox_marks` row is keyed by. */
  id: z.string().min(1),
  project: z.object({ id: z.string().min(1), name: z.string() }),
  issue: z.object({
    id: z.string().min(1),
    identifier: z.string().nullable(),
    title: z.string(),
  }),
  run_id: z.string().min(1),
  run_status: z.enum(RUN_STATES),
  step_run_id: z.string().min(1),
  step_name: z.string(),
  step_status: z.enum(STEP_RUN_STATES),
  participant: conversationParticipantSchema.nullable(),
  last: z
    .object({
      kind: z.enum(["agent", "user", "interaction"]),
      text: z.string(),
      at: z.iso.datetime(),
    })
    .nullable(),
  pending_interaction: z
    .object({ kind: z.enum(RUN_INTERACTION_KINDS), prompt: z.string() })
    .nullable(),
  queued_contributions: z.number().int().nonnegative(),
  /** When the thread last had something new to read, not when any row of it was written. */
  updated_at: z.iso.datetime(),
  read: z.boolean(),
  archived: z.boolean(),
});
export type ConversationEntry = z.infer<typeof conversationEntrySchema>;

export const conversationSnapshotSchema = z.object({
  entries: z.array(conversationEntrySchema),
  observed_at: z.iso.datetime(),
});
export type ConversationSnapshot = z.infer<typeof conversationSnapshotSchema>;
