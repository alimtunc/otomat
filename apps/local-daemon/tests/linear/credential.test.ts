import { expect, it } from "vitest";

import { takeLinearKeyFromEnv } from "#linear";

it("removes the development key from the environment as it reads it", () => {
  const env: NodeJS.ProcessEnv = { OTOMAT_LINEAR_API_KEY: "lin_api_secret", PATH: "/usr/bin" };

  expect(takeLinearKeyFromEnv(env)).toBe("lin_api_secret");
  expect(env.OTOMAT_LINEAR_API_KEY).toBeUndefined();
  expect(Object.keys(env)).toEqual(["PATH"]);
  expect(takeLinearKeyFromEnv(env)).toBeNull();
});

it("treats an empty development key as absent", () => {
  expect(takeLinearKeyFromEnv({ OTOMAT_LINEAR_API_KEY: "" })).toBeNull();
  expect(takeLinearKeyFromEnv({})).toBeNull();
});
