import { unsupportedDiscovery, type RuntimeModelSupport } from "#runtime/models/support";

/** A closed catalog: the simulated runtime drives no provider, so it takes no custom identifier. */
export const FAKE_MODEL_SUPPORT: RuntimeModelSupport = {
  allowsCustom: false,
  staticModels: [
    {
      id: "fake-fast",
      label: "Simulated fast",
      description: "Simulated catalog entry; no provider is contacted.",
      source: "static",
    },
    {
      id: "fake-thorough",
      label: "Simulated thorough",
      description: "Simulated catalog entry; no provider is contacted.",
      source: "static",
    },
  ],
  discover: () =>
    unsupportedDiscovery("The simulated runtime has no provider binary to list models from."),
};
