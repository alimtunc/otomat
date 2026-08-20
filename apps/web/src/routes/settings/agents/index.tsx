import { createFileRoute } from "@tanstack/react-router";
import {
  isProfileFilter,
  type AgentsSearch,
} from "@web/components/agents/agent-profile/list/profile-filter";
import { AgentProfilesSection } from "@web/components/agents/agent-profile/list/section";

export const Route = createFileRoute("/settings/agents/")({
  validateSearch: (search: Record<string, unknown>): AgentsSearch => {
    const filter = search.filter;
    if (typeof filter !== "string" || !isProfileFilter(filter) || filter === "all") {
      return { filter: undefined };
    }
    return { filter };
  },
  component: AgentProfilesSection,
});
