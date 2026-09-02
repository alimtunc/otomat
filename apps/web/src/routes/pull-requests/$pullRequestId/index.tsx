import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/pull-requests/$pullRequestId/")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/pull-requests/$pullRequestId/overview", params });
  },
});
