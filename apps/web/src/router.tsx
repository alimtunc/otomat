import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from "@tanstack/react-router";

import { IssueDetailRoute } from "./routes/issue-detail";
import { IssuesRoute } from "./routes/issues";
import { RunCockpitRoute, RunDiffRoute, RunTimelineRoute } from "./routes/run-cockpit";
import { SettingsRoute } from "./routes/settings";
import { AppearanceSection } from "./routes/settings-appearance";
import {
  AboutSection,
  AgentsSection,
  RepositoriesSection,
  RuntimesSection,
} from "./routes/settings-sections";

const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: "/issues" });
  },
});

const issuesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/issues",
  component: IssuesRoute,
});

const issueDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/issues/$issueId",
  component: IssueDetailRoute,
});

const runRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/runs/$runId",
  component: RunCockpitRoute,
});

const runTimelineRoute = createRoute({
  getParentRoute: () => runRoute,
  path: "/",
  component: RunTimelineRoute,
});

const runDiffRoute = createRoute({
  getParentRoute: () => runRoute,
  path: "diff",
  component: RunDiffRoute,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: SettingsRoute,
});

const settingsIndexRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: "/settings/repositories" });
  },
});

const repositoriesRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: "repositories",
  component: RepositoriesSection,
});

const runtimesRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: "runtimes",
  component: RuntimesSection,
});

const agentsRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: "agents",
  component: AgentsSection,
});

const appearanceRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: "appearance",
  component: AppearanceSection,
});

const aboutRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: "about",
  component: AboutSection,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  issuesRoute,
  issueDetailRoute,
  runRoute.addChildren([runTimelineRoute, runDiffRoute]),
  settingsRoute.addChildren([
    settingsIndexRoute,
    repositoriesRoute,
    runtimesRoute,
    agentsRoute,
    appearanceRoute,
    aboutRoute,
  ]),
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
