import { skillAvailability, skillAvailabilityLabel } from "@web/lib/skill-availability";
import { describe, expect, it } from "vitest";

import { skillContract as skill } from "#support/agent";

describe("skillAvailability", () => {
  it("reports a skill the catalog no longer holds as missing", () => {
    const availability = skillAvailability("skill-gone", [skill()], null);

    expect(availability).toEqual({ status: "missing", skill: null });
    expect(skillAvailabilityLabel(availability, "otomat-vps")).toBe("Not found on otomat-vps");
  });

  it("reports a disabled catalog entry as disabled, not as available", () => {
    const availability = skillAvailability("skill-1", [skill({ enabled: false })], null);

    expect(availability.status).toBe("disabled");
    expect(skillAvailabilityLabel(availability, "otomat-vps")).toBe(
      "Disabled in the skill catalog",
    );
  });

  it("names why an invalid skill cannot be activated", () => {
    const availability = skillAvailability(
      "skill-1",
      [skill({ status: "invalid", invalid_reason: "path_missing" })],
      null,
    );

    expect(availability.status).toBe("invalid");
    expect(skillAvailabilityLabel(availability, "this host")).toBe(
      "File no longer on disk on this host",
    );
  });

  it("names the host an available skill was discovered on", () => {
    const availability = skillAvailability("skill-1", [skill()], null);

    expect(availability.status).toBe("available");
    expect(skillAvailabilityLabel(availability, "the local host")).toBe(
      "Available on the local host",
    );
  });

  it("refuses a project skill to a global profile and grants it to that project's own", () => {
    const crm = skill({ project_id: "proj-1" });

    expect(skillAvailability("skill-1", [crm], null).status).toBe("out_of_scope");
    expect(skillAvailabilityLabel(skillAvailability("skill-1", [crm], null), "Local")).toBe(
      "Belongs to another project",
    );
    expect(skillAvailability("skill-1", [crm], "proj-1").status).toBe("available");
    expect(skillAvailability("skill-1", [crm], "proj-2").status).toBe("out_of_scope");
  });
});
