/** Shared Vitest defaults for every Otomat package. */
export default {
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    passWithNoTests: false,
  },
};
