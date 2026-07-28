import { unsupportedDiscovery, type RuntimeModelSupport } from "#runtime/models/support";

/** A closed catalog: the simulated runtime drives no provider, so it takes no custom identifier. */
export const FAKE_MODEL_SUPPORT: RuntimeModelSupport = {
  allowsCustom: false,
  staticModels: [
    {
      id: "fake-fast",
      label: "Fake fast (simulated)",
      description: "Catalog entry of the test adapter; no provider is contacted.",
      source: "static",
    },
    {
      id: "fake-thorough",
      label: "Fake thorough (simulated)",
      description: "Catalog entry of the test adapter; no provider is contacted.",
      source: "static",
    },
  ],
  discover: () =>
    unsupportedDiscovery("The simulated runtime has no provider binary to list models from."),
};
