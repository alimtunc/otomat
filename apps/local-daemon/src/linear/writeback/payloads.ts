import { z } from "zod";

const statusPayloadSchema = z.object({ state_id: z.string() });
const commentPayloadSchema = z.object({ body: z.string(), parent_id: z.string().nullable() });
const prLinkPayloadSchema = z.object({ url: z.string(), title: z.string() });

function parsePayload<T>(schema: z.ZodType<T>, payload: unknown): T {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) throw new Error("linear write payload is corrupted");
  return parsed.data;
}

export function parseStatusPayload(payload: unknown) {
  return parsePayload(statusPayloadSchema, payload);
}

export function parseCommentPayload(payload: unknown) {
  return parsePayload(commentPayloadSchema, payload);
}

export function parsePrLinkPayload(payload: unknown) {
  return parsePayload(prLinkPayloadSchema, payload);
}
