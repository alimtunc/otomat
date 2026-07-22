import { z } from "zod";

import { skillContractSchema } from "./entities.js";

/** The full local skills catalog after discovery reconciliation. */
export const skillCatalogSchema = z.array(skillContractSchema);

/** Toggle whether a discovered skill may be activated by a profile. */
export const setSkillEnabledRequestSchema = z
  .object({
    enabled: z.boolean(),
  })
  .strict();
export type SetSkillEnabledRequest = z.infer<typeof setSkillEnabledRequestSchema>;
