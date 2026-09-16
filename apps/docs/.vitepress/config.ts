import { defineConfig } from "vitepress";

const REPOSITORY = "https://github.com/alimtunc/otomat";

export default defineConfig({
  title: "Otomat",
  description:
    "Local-first, issue-first cockpit for running coding agents, reviewing real git diffs and shipping pull requests.",
  lang: "en-US",
  cleanUrls: true,
  lastUpdated: true,
  themeConfig: {
    nav: [
      { text: "Guide", link: "/guide/introduction", activeMatch: "/guide/" },
      { text: "Download", link: `${REPOSITORY}/releases` },
    ],
    sidebar: {
      "/guide/": [
        {
          text: "Getting started",
          items: [
            { text: "Introduction", link: "/guide/introduction" },
            { text: "Install on macOS", link: "/guide/install" },
            { text: "Prerequisites", link: "/guide/prerequisites" },
            { text: "Add a project", link: "/guide/projects" },
          ],
        },
        {
          text: "Working with agents",
          items: [
            { text: "Launch a run", link: "/guide/runs" },
            { text: "Steer a run", link: "/guide/steering" },
            { text: "Review and publish", link: "/guide/review" },
            { text: "Workspaces and files", link: "/guide/workspaces" },
            { text: "Notifications and Inbox", link: "/guide/notifications" },
          ],
        },
        {
          text: "Operate",
          items: [
            { text: "Data, privacy and security", link: "/guide/data-and-security" },
            { text: "Troubleshooting", link: "/guide/troubleshooting" },
            { text: "Contributing", link: "/guide/contributing" },
          ],
        },
      ],
    },
    socialLinks: [{ icon: "github", link: REPOSITORY }],
    editLink: {
      pattern: `${REPOSITORY}/edit/main/apps/docs/:path`,
      text: "Edit this page on GitHub",
    },
    search: { provider: "local" },
    outline: { level: [2, 3] },
    footer: {
      message: "Otomat is in alpha. macOS on Apple Silicon only.",
    },
  },
});
