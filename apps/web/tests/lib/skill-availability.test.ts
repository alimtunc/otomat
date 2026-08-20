import type { SkillContract } from "@otomat/domain";
import { skillAvailability, skillAvailabilityLabel } from "@web/lib/skill-availability";
import { describe, expect, it } from "vitest";

function skill(overrides: Partial<SkillContract> = {}): SkillContract {
  return {
    id: "skill-1",
    source: "project",
    canonical_path: "/repo/.agents/skills/review/SKILL.md",
    name: "Review",
    description: "Review a diff",
    content_hash: "abc",
    status: "available",
    invalid_reason: null,
    enabled: true,
    ...overrides,
  };
}

describe("skillAvailability", () => {
  it("reports a skill the catalog no longer holds as missing", () => {
    const availability = skillAvailability("skill-gone", [skill()]);

    expect(availability).toEqual({ status: "missing", skill: null });
    expect(skillAvailabilityLabel(availability, "otomat-vps")).toBe("Not found on otomat-vps");
  });

  it("reports a disabled catalog entry as disabled, not as available", () => {
    const availability = skillAvailability("skill-1", [skill({ enabled: false })]);

    expect(availability.status).toBe("disabled");
    expect(skillAvailabilityLabel(availability, "otomat-vps")).toBe(
      "Disabled in the skill catalog",
    );
  });

  it("names why an invalid skill cannot be activated", () => {
    const availability = skillAvailability("skill-1", [
      skill({ status: "invalid", invalid_reason: "path_missing" }),
    ]);

    expect(availability.status).toBe("invalid");
    expect(skillAvailabilityLabel(availability, "this host")).toBe(
      "File no longer on disk on this host",
    );
  });

  it("names the host an available skill was discovered on", () => {
    const availability = skillAvailability("skill-1", [skill()]);

    expect(availability.status).toBe("available");
    expect(skillAvailabilityLabel(availability, "the local host")).toBe(
      "Available on the local host",
    );
  });
});
