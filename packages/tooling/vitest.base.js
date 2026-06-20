/** Shared Vitest defaults for every Otomat package. */
export default {
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    passWithNoTests: false,
  },
};
