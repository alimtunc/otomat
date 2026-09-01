import {
  agentProfileAvailability,
  agentProfileAvailabilityLabel,
} from "@web/lib/agent/profile-availability";
import { describe, expect, it } from "vitest";

import { agentProfile, runtimeDescriptor, skillContract } from "#support/agent";

const crm = skillContract({
  id: "crm",
  project_id: "proj-1",
  canonical_path: "/repo/.agents/skills/crm/SKILL.md",
  name: "CRM",
});

const label = (
  profile: Parameters<typeof agentProfileAvailability>[0],
  descriptors: Parameters<typeof agentProfileAvailability>[1],
  skills: Parameters<typeof agentProfileAvailability>[2],
) => agentProfileAvailabilityLabel(agentProfileAvailability(profile, descriptors, skills), "Local");

describe("agentProfileAvailability", () => {
  it("names the host a ready profile can launch on", () => {
    const availability = agentProfileAvailability(agentProfile(), [runtimeDescriptor()], []);

    expect(availability.usable).toBe(true);
    expect(agentProfileAvailabilityLabel(availability, "otomat-vps")).toBe(
      "Available on otomat-vps",
    );
  });

  it("blames the runtime this host does not offer, before any skill", () => {
    const unavailable = runtimeDescriptor({
      availability: { status: "unavailable", reason: "binary_not_found" },
    });
    const profile = agentProfile({ skill_ids: ["crm"] });

    expect(agentProfileAvailability(profile, [unavailable], []).usable).toBe(false);
    expect(label(profile, [unavailable], [])).toBe("CLI not found on Local");
  });

  it("blames a runtime this host does not report at all", () => {
    const profile = agentProfile({ runtime: "ghost" });

    expect(agentProfileAvailability(profile, [], []).usable).toBe(false);
    expect(label(profile, [], [])).toBe("Not reported on Local");
  });

  it("refuses a global profile that depends on a project skill", () => {
    const profile = agentProfile({ skill_ids: ["crm"] });

    expect(agentProfileAvailability(profile, [runtimeDescriptor()], [crm]).usable).toBe(false);
    expect(label(profile, [runtimeDescriptor()], [crm])).toBe(
      "Skill “CRM”: Belongs to another project",
    );
  });

  it("accepts the same skill on a profile of that project", () => {
    const availability = agentProfileAvailability(
      agentProfile({ project_id: "proj-1", skill_ids: ["crm"] }),
      [runtimeDescriptor()],
      [crm],
    );

    expect(availability.usable).toBe(true);
  });

  it("names no identifier for a skill this host's catalog does not hold", () => {
    const profile = agentProfile({ project_id: "proj-1", skill_ids: ["crm"] });

    expect(agentProfileAvailability(profile, [runtimeDescriptor()], []).usable).toBe(false);
    expect(label(profile, [runtimeDescriptor()], [])).toBe(
      "A configured skill: Not found on Local",
    );
  });

  it("refuses a skill the user disabled in the catalog", () => {
    const disabled = [skillContract({ ...crm, enabled: false })];
    const profile = agentProfile({ project_id: "proj-1", skill_ids: ["crm"] });

    expect(agentProfileAvailability(profile, [runtimeDescriptor()], disabled).usable).toBe(false);
    expect(label(profile, [runtimeDescriptor()], disabled)).toBe(
      "Skill “CRM”: Disabled in the skill catalog",
    );
  });

  it("refuses a skill whose file this host no longer has", () => {
    const gone = [skillContract({ ...crm, status: "invalid", invalid_reason: "path_missing" })];
    const profile = agentProfile({ project_id: "proj-1", skill_ids: ["crm"] });

    expect(agentProfileAvailability(profile, [runtimeDescriptor()], gone).usable).toBe(false);
    expect(label(profile, [runtimeDescriptor()], gone)).toBe(
      "Skill “CRM”: File no longer on disk on Local",
    );
  });
});
