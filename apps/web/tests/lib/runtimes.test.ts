import type { RuntimeAvailability, RuntimeDescriptor, RuntimeKind } from "@otomat/domain";
import { hasLaunchableRuntime, resolveRuntimeChoice } from "@web/lib/runtimes";
import { describe, expect, it } from "vitest";

function descriptor(
  id: string,
  kind: RuntimeKind,
  availability: RuntimeAvailability,
): RuntimeDescriptor {
  return {
    id,
    display_name: id,
    kind,
    capabilities: {
      stream: true,
      steering: "turn_boundary",
      abort: true,
      resume: true,
      permissions: false,
      diff_hints: false,
      provider_limit: "unsupported",
    },
    availability,
  };
}

const AVAILABLE: RuntimeAvailability = { status: "available", version: null };
const NOT_INSTALLED: RuntimeAvailability = { status: "unavailable", reason: "binary_not_found" };

describe("resolveRuntimeChoice", () => {
  it("keeps the user's choice while it is listed and available", () => {
    const descriptors = [
      descriptor("claude", "real", AVAILABLE),
      descriptor("codex", "real", AVAILABLE),
    ];
    expect(resolveRuntimeChoice(descriptors, "codex")).toBe("codex");
  });

  it("falls back to the first available real runtime when the choice is gone or unavailable", () => {
    const descriptors = [
      descriptor("claude", "real", NOT_INSTALLED),
      descriptor("codex", "real", AVAILABLE),
    ];
    expect(resolveRuntimeChoice(descriptors, "claude")).toBe("codex");
    expect(resolveRuntimeChoice(descriptors, "vanished")).toBe("codex");
    expect(resolveRuntimeChoice(descriptors, null)).toBe("codex");
  });

  it("prefers an available real runtime over a listed simulated one", () => {
    const descriptors = [
      descriptor("codex", "real", AVAILABLE),
      descriptor("fake", "simulated", AVAILABLE),
    ];
    expect(resolveRuntimeChoice(descriptors, null)).toBe("codex");
    expect(resolveRuntimeChoice(descriptors, "fake")).toBe("fake");
  });

  it("falls back to a simulated runtime when no real one is available", () => {
    const descriptors = [
      descriptor("claude", "real", NOT_INSTALLED),
      descriptor("fake", "simulated", AVAILABLE),
    ];
    expect(resolveRuntimeChoice(descriptors, null)).toBe("fake");
    expect(hasLaunchableRuntime(descriptors)).toBe(true);
  });

  it("returns null when nothing is available", () => {
    const descriptors = [
      descriptor("claude", "real", NOT_INSTALLED),
      descriptor("codex", "real", NOT_INSTALLED),
    ];
    expect(resolveRuntimeChoice(descriptors, "claude")).toBeNull();
    expect(hasLaunchableRuntime(descriptors)).toBe(false);
  });
});
