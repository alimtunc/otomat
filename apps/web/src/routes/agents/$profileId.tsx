import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/agents/$profileId")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/settings/agents/$profileId", params });
  },
});
