# Notifications and Inbox

Otomat has three surfaces for "something needs you", all projected from the same daemon state — a
run, a step or a pull request row — so they never disagree with each other.

## Activity Center

The activity button in the header opens the cross-project picture of the active host: work
**running** and work **queued & waiting** (for a session slot or a provider quota), clustered by
issue, plus one button counting what needs you that opens the Inbox. An entry deep-links to its
run or its pull request panel; a run that has not settled can be cancelled from there.
The badge counts what is running or queued, plus a pending update of the app.

An update of the app downloaded and waiting to be installed shows in the same list.

## Inbox

**Inbox**, in the sidebar, lists every entry that waits on you across the projects of the host,
each with the one action that clears it:

| Entry                  | Action                              |
| ---------------------- | ----------------------------------- |
| Run is waiting for you | Answer the run                      |
| Permission requested   | Grant or refuse the permission      |
| Candidates to compare  | Pick the candidate to keep          |
| Ready to review        | Review the diff                     |
| Run failed             | Resume or abandon the run           |
| Provider quota reached | Wait for the reset or resume now    |
| Publication stopped    | Retry the publication               |
| Review requested       | Review the pull request             |
| Pull request blocked   | Fix the failing checks or conflicts |

**Mark as read**, **Mark as unread** and **Archive** are your reading marks; they change nothing on
the run itself. A closed issue, an abandoned cycle or a newer run silences an entry rather than
moving it to a resolved list — it never completed. **Filters** narrow the list by project and type.

## Desktop notifications

The app watches every connected host — including while the window is hidden — and delivers one
notice per new event:

- an **in-app notice** when the cockpit is visible and focused;
- a **native macOS notification** when it is hidden, unfocused, minimised or the screen is locked.
  Clicking it selects the owning host and project and navigates to the request, the diff, the
  completion report or the pull request.

_Settings → All hosts → Notifications_ chooses which categories are delivered natively:
**Permission or choice requested**, **A question needs your answer**, **Work is ready to review**,
**Run completed**, **Work failed or is blocked**. Copy names the issue and its state, never a project name, a prompt, a path, code or an
answer, and a locked screen gets generic wording. macOS decides whether notifications from Otomat
are allowed at all; the page links to the system setting.

Nothing is sent anywhere: a notification is composed on your machine from the daemon's own state.
Reading or clicking one changes no Inbox mark and no run state.
