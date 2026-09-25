# Add a project

A project is one git repository on one execution host. Everything Otomat launches for it — runs,
worktrees, agents, presets — belongs to that host's daemon.

## Add a local project

1. Open the **project switcher** at the top of the sidebar and choose **Add project**.
2. Enter the **Repository path** — the absolute path of an existing git clone — or click
   **Browse…** to pick the folder.
3. **Add project**. The project appears in the switcher and becomes the active one.

Otomat registers the path; it does not copy or move the repository. Runs work in
[workspaces](./workspaces.md) of their own.

### Per-project settings

_Settings → Project → This project_ holds what belongs to that repository:

- **Worktree init commands** — shell lines run in every new worktree before an agent starts
  (`pnpm install`, `pnpm build`, …). They run on the host that owns the project.
- **Linear sources** — the team and Linear project the issues are mirrored from (see below).
- **Run health check** — see [Project readiness](./prerequisites.md#project-readiness).

_Settings → Project → Workspaces_ lists the branches and worktrees the project holds, and
_Agents_ / _Skills_ the profiles and skills scoped to this project alone.

## Organize the navigation

Open the project switcher and choose **Organize projects…** to arrange how projects appear in the
switcher and in the tab bar:

- **Add group** creates a named group; each project's group picker moves it in or out, and dragging
  a project onto another row or group does the same.
- **Move up** / **Move down** reorder projects inside their group, and groups among themselves.
- A group's name is edited in place; deleting a group puts its projects back under _Not grouped_.
- The glyph before a project's name opens its icon choice; **Default icon** returns to the initial.

In the tab bar, clicking a group's name folds it: the group keeps its host tags and unread count,
and the project you are on stays visible. The arrangement is kept by this app on this machine. It
changes nothing about the projects themselves — hosts, settings, runs and worktrees stay as they
are. A newly added project appears at the end of the ungrouped projects, and a project on a host
that is temporarily unreachable returns to its group when the host answers again.

## Connect Linear

Local issues need no integration: **New issue** in the Issues view creates one. To work from
Linear:

1. _Settings → All hosts → Integrations → Linear_: **Add Linear workspace** with a name and a
   **Personal API key**. Disconnecting a workspace is the only action that removes the key (stored
   as described under [Credentials](./data-and-security.md#credentials)), and it lists the projects
   that lose their mapping first.
2. _Settings → Project → This project → Linear sources_: pick the **Linear connection**, then the
   **Linear team** and, optionally, the **Linear project** whose issues this Otomat project mirrors.
   A project maps to one connection; two projects may share it.
3. In the same card, map the workflow states Otomat writes back: **Run started** (the state an
   issue enters when a run is created on it) and **Pull request merged**. An unmapped phase writes
   nothing to Linear.

Issues sync when you open the project and when the window comes back to the foreground — unless
they were synced less than a minute ago — and when you click **Refresh issues** in the Issues view;
there are no webhooks. Beyond those two transitions, Otomat writes to Linear only what you publish
yourself from the issue page: **Publish to Linear** for edited fields, a status change, a
**Comment**, or a pull-request link.

Images and videos embedded in a Linear description or comment, and media attached to the issue,
display inline on the issue page — click an image to enlarge it; videos use the native player and
never autoplay. The daemon fetches them with the workspace key, which never reaches the app, and
keeps nothing on disk. A file Linear no longer serves, or one Otomat does not display inline, keeps
an **Open in Linear** link instead.

## Add a VPS as an execution host

The daemon can run on a Linux server you own while the desktop app stays the user interface.
Repositories, worktrees, the database and the agent CLIs then live on the server; the app reaches
them through an SSH tunnel and never exposes a port.

**On the server** you need: Linux with `bash`, Node.js 22 or newer on the login shell's `PATH`,
`git`, an authenticated `gh` (it also downloads the daemon build), and the `claude` / `codex` CLIs
you intend to use, signed in.

**On your Mac**:

1. Make sure `ssh <alias>` works from a terminal without any prompt — Otomat connects with the
   system `ssh` in batch mode, using a `Host` alias from `~/.ssh/config`. Accept the host key once
   from the terminal.
2. _Settings → All hosts → Execution hosts_: enter the **Remote host SSH alias** and **Save
   alias**. Nothing else is stored (see [Credentials](./data-and-security.md#credentials)).
3. Otomat starts the daemon on the host if it is absent, installs the exact daemon build this app
   expects when the one running differs (waiting for in-flight runs to finish first, and backing
   up the database before the swap), and opens the tunnel. The sidebar shows the progress; a first
   connection takes about half a minute.
4. **Add project** again, this time with **Host** set to the alias. Otomat lists the git
   repositories it finds under the server's home directory; pick one or type the path.

The host follows the project: choosing a VPS project in the switcher points the whole cockpit at
that daemon. Local and remote daemons keep separate databases and nothing is synchronised between
them. Closing the app closes the tunnel but leaves the remote daemon and its runs working; the next
connection finds them again. **Remove host** forgets the alias — the daemon and its data stay on
the server.

Details on the host layout and manual deployment are in the
[remote execution host reference](https://github.com/alimtunc/otomat/blob/main/docs/ai/remote-execution-host.md).
