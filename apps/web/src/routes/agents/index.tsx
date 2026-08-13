import { createFileRoute } from "@tanstack/react-router";
import {
  isProfileFilter,
  type ProfileFilter,
} from "@web/components/agents/agent-profile/list/profile-filter";
import { AgentsView } from "@web/components/agents/agent-profile/list/view";

export const Route = createFileRoute("/agents/")({
  validateSearch: (search: Record<string, unknown>): { filter?: ProfileFilter } => {
    const filter = search.filter;
    if (typeof filter !== "string" || !isProfileFilter(filter) || filter === "all") {
      return { filter: undefined };
    }
    return { filter };
  },
  component: AgentsView,
});
