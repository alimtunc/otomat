import { z } from "zod";

/** Toggle whether a discovered skill may be activated by a profile. */
export const setSkillEnabledRequestSchema = z
  .object({
    enabled: z.boolean(),
  })
  .strict();
export type SetSkillEnabledRequest = z.infer<typeof setSkillEnabledRequestSchema>;
