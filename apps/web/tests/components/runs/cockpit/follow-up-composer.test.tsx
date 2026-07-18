import type { FollowUpRunRequest, RunDetail, RunState, RuntimeDescriptor } from "@otomat/domain";
// @vitest-environment happy-dom
import type { ConnectionState } from "@otomat/ui";
import { FollowUpComposer } from "@web/components/runs/cockpit/follow-up-composer";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const mutateAsync = vi.fn(async (_request: FollowUpRunRequest) => ({}));
let connectionState: ConnectionState = "online";
let runtimesData: RuntimeDescriptor[] | undefined;

vi.mock("@web/api/runs/mutations", () => ({
  useFollowUpRun: () => ({ mutateAsync, isPending: false }),
}));

vi.mock("@web/api/daemon/queries", () => ({
  useDaemonStatus: () => ({ connectionState, lastSyncAt: null, retry: vi.fn() }),
  useRuntimes: () => ({ data: runtimesData }),
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function runDetail(status: RunState, providerSessionId: string | null = "ps-1"): RunDetail {
  return {
    run: {
      id: "run-1",
      issue_id: "i1",
      status,
      branch: "otomat/run/run-1",
      plan_json: {
        version: 1,
        steps: [{ id: "s1", name: "Agent turn", agent: "claude", prompt: "p", depends_on: [] }],
      },
    },
    steps: [],
    sessions: [
      {
        id: "as1",
        step_run_id: "s1",
        agent_id: "claude",
        status: "awaiting_input",
        provider_session_id: providerSessionId,
      },
    ],
    worktree_path: null,
  };
}

function claudeDescriptor(): RuntimeDescriptor {
  return {
    id: "claude",
    display_name: "Claude Code",
    kind: "real",
    capabilities: {
      stream: true,
      send_message: true,
      abort: true,
      resume: true,
      permissions: false,
      diff_hints: false,
    },
    availability: { status: "available", version: null },
  };
}

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  document.body.replaceChildren();
  mutateAsync.mockClear();
  connectionState = "online";
  runtimesData = undefined;
});

async function renderComposer(detail: RunDetail) {
  const container = document.createElement("div");
  document.body.append(container);
  const root: Root = createRoot(container);
  await act(async () => {
    root.render(<FollowUpComposer detail={detail} />);
  });
  cleanups.push(async () => {
    await act(async () => root.unmount());
  });
}

function promptTextarea(): HTMLTextAreaElement {
  const textarea = document.querySelector<HTMLTextAreaElement>(
    "textarea[aria-label='Follow-up prompt']",
  );
  if (!textarea) throw new Error("follow-up textarea not found");
  return textarea;
}

function sendButton(): HTMLButtonElement {
  const button = [...document.querySelectorAll("button")].find((candidate) =>
    candidate.textContent?.includes("Send follow-up"),
  );
  if (!button) throw new Error("send button not found");
  return button;
}

async function typePrompt(value: string) {
  const textarea = promptTextarea();
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(textarea, value);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("FollowUpComposer", () => {
  it("sends the trimmed prompt on Cmd+Enter and clears the draft", async () => {
    runtimesData = [claudeDescriptor()];
    await renderComposer(runDetail("awaiting_human"));
    await typePrompt("  add error handling  ");

    await act(async () => {
      promptTextarea().dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", metaKey: true, bubbles: true }),
      );
    });

    expect(mutateAsync).toHaveBeenCalledWith({ prompt: "add error handling" });
    expect(promptTextarea().value).toBe("");
  });

  it("submits via the button on a review-ready run", async () => {
    runtimesData = [claudeDescriptor()];
    await renderComposer(runDetail("review_ready"));
    await typePrompt("rename the helper");

    await act(async () => {
      sendButton().click();
    });

    expect(mutateAsync).toHaveBeenCalledWith({ prompt: "rename the helper" });
  });

  it("does not submit a blank prompt", async () => {
    runtimesData = [claudeDescriptor()];
    await renderComposer(runDetail("awaiting_human"));
    await typePrompt("   ");

    await act(async () => {
      promptTextarea().dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, bubbles: true }),
      );
    });

    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("disables the action and ignores Cmd+Enter while the run is active", async () => {
    runtimesData = [claudeDescriptor()];
    await renderComposer(runDetail("running"));
    await typePrompt("too early");

    await act(async () => {
      promptTextarea().dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", metaKey: true, bubbles: true }),
      );
    });

    expect(mutateAsync).not.toHaveBeenCalled();
    expect(sendButton().disabled).toBe(true);
    expect(document.body.textContent).toContain("The agent is working");
  });

  it("disables the action while the daemon is offline", async () => {
    runtimesData = [claudeDescriptor()];
    connectionState = "offline";
    await renderComposer(runDetail("awaiting_human"));

    expect(sendButton().disabled).toBe(true);
    expect(document.body.textContent).toContain("Daemon offline");
  });

  it("explains when the runtime cannot resume", async () => {
    runtimesData = [];
    await renderComposer(runDetail("awaiting_human"));

    expect(sendButton().disabled).toBe(true);
    expect(document.body.textContent).toContain("runtime is not registered");
  });
});
