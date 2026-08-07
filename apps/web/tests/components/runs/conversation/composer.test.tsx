import type {
  CreateRunContributionRequest,
  RunDetail,
  RunState,
  RuntimeDescriptor,
} from "@otomat/domain";
// @vitest-environment happy-dom
import type { ConnectionState } from "@otomat/ui";
import { ConversationComposer } from "@web/components/runs/conversation/composer";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const mutateAsync = vi.fn(async (_request: CreateRunContributionRequest) => ({}));
const onSent = vi.fn();
let connectionState: ConnectionState = "online";
let runtimesData: RuntimeDescriptor[] | undefined;

vi.mock("@web/api/runs/mutations", () => ({
  useCreateRunContribution: () => ({ mutateAsync, isPending: false }),
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
      updated_at: "2026-07-25T10:00:00.000Z",
    },
    steps: [
      {
        id: "s1",
        run_id: "run-1",
        idx: 0,
        name: "Agent turn",
        status: "succeeded",
        compete_group_id: null,
        worktree_id: null,
        branch: null,
        worktree_status: null,
      },
    ],
    sessions: [
      {
        id: "as1",
        step_run_id: "s1",
        agent_id: "claude",
        status: "awaiting_input",
        provider_session_id: providerSessionId,
      },
    ],
    compete_groups: [],
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
    provider_options: [],
  };
}

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  document.body.replaceChildren();
  mutateAsync.mockClear();
  onSent.mockClear();
  connectionState = "online";
  runtimesData = undefined;
});

async function renderComposer(detail: RunDetail) {
  const container = document.createElement("div");
  document.body.append(container);
  const root: Root = createRoot(container);
  await act(async () => {
    root.render(<ConversationComposer detail={detail} onSent={onSent} />);
  });
  cleanups.push(async () => {
    await act(async () => root.unmount());
  });
}

function promptTextarea(): HTMLTextAreaElement {
  const textarea = document.querySelector<HTMLTextAreaElement>(
    "textarea[aria-label='Run message']",
  );
  if (!textarea) throw new Error("run message textarea not found");
  return textarea;
}

function sendButton(): HTMLButtonElement {
  const button = [...document.querySelectorAll("button")].find((candidate) =>
    candidate.textContent?.includes("message"),
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

describe("ConversationComposer", () => {
  it("sends the trimmed prompt on Cmd+Enter and clears the draft", async () => {
    runtimesData = [claudeDescriptor()];
    await renderComposer(runDetail("awaiting_human"));
    await typePrompt("  add error handling  ");

    await act(async () => {
      promptTextarea().dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", metaKey: true, bubbles: true }),
      );
    });

    expect(mutateAsync).toHaveBeenCalledWith({ body: "add error handling" });
    expect(promptTextarea().value).toBe("");
    expect(onSent).toHaveBeenCalledTimes(1);
  });

  it("keeps the draft and reports no send when the mutation fails", async () => {
    runtimesData = [claudeDescriptor()];
    mutateAsync.mockRejectedValueOnce(new Error("daemon refused the message"));
    await renderComposer(runDetail("awaiting_human"));
    await typePrompt("add error handling");

    await act(async () => {
      promptTextarea().dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", metaKey: true, bubbles: true }),
      );
    });

    expect(promptTextarea().value).toBe("add error handling");
    expect(onSent).not.toHaveBeenCalled();
  });

  it("submits via the button on a review-ready run", async () => {
    runtimesData = [claudeDescriptor()];
    await renderComposer(runDetail("review_ready"));
    await typePrompt("rename the helper");

    await act(async () => {
      sendButton().click();
    });

    expect(mutateAsync).toHaveBeenCalledWith({ body: "rename the helper" });
  });

  it("does not submit a blank message", async () => {
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

  it("queues a message sent while the run is active instead of refusing it", async () => {
    runtimesData = [claudeDescriptor()];
    await renderComposer(runDetail("running"));
    await typePrompt("also add tests");

    expect(sendButton().disabled).toBe(false);
    expect(sendButton().textContent).toContain("Queue message");
    expect(document.body.textContent).toContain("queued for its next safe turn");

    await act(async () => {
      promptTextarea().dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", metaKey: true, bubbles: true }),
      );
    });

    expect(mutateAsync).toHaveBeenCalledWith({ body: "also add tests" });
  });

  it("refuses a message on a finished run", async () => {
    runtimesData = [claudeDescriptor()];
    await renderComposer(runDetail("completed"));

    expect(sendButton().disabled).toBe(true);
    expect(document.body.textContent).toContain("This run is finished");
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
