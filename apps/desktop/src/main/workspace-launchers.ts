import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { app, shell } from "electron";

import type { WorkspaceLaunchers } from "./remote/host/open-workspace.js";

const execFileAsync = promisify(execFile);

export const electronWorkspaceLaunchers: WorkspaceLaunchers = {
  platform: process.platform,
  protocolHandler: (url) => app.getApplicationNameForProtocol(url),
  openExternal: (url) => shell.openExternal(url),
  launch: async (file, args) => {
    await execFileAsync(file, args);
  },
};
