import type { ResolvedAgentConfig, RunDetail, RunState, RuntimeDescriptor } from "@otomat/domain";
// @vitest-environment happy-dom
import type { ConnectionState } from "@otomat/ui";
import type { CreateRunContributionVariables } from "@web/api/runs/mutations";
import { ConversationComposer } from "@web/components/runs/conversation/composer";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { findLabelled } from "#support/dom-queries";

let nextMutationError: Error | null = null;
let contributionError: Error | null = null;
const mutate = vi.fn(
  (_variables: CreateRunContributionVariables, callbacks?: { onSuccess?: () => void }) => {
    if (nextMutationError === null) {
      callbacks?.onSuccess?.();
      return;
    }
    contributionError = nextMutationError;
  },
);
const onSent = vi.fn();
let connectionState: ConnectionState = "online";
let runtimesData: RuntimeDescriptor[] | undefined;

const CONFIG: ResolvedAgentConfig = {
  runtime: "claude",
  profile_id: "profile-1",
  profile_name: "Implementer",
  options: {},
  model: { id: "claude-opus", source: "manual" },
  guidance: null,
  skills: [],
  sources: { runtime: "profile", model: "profile", options: {} },
  config_hash: "config-1",
};

vi.mock("@web/api/runs/mutations", () => ({
  useCreateRunContribution: () => ({ mutate, isPending: false, error: contributionError }),
}));

vi.mock("@web/api/daemon/queries", () => ({
  useDaemonStatus: () => ({ connectionState, lastSyncAt: null, retry: vi.fn() }),
  useRuntimes: () => ({ data: runtimesData }),
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
// happy-dom has no object URLs; the thumbnails only need a stable string per file.
Object.assign(URL, {
  createObjectURL: (file: File) => `blob:${file.name}`,
  revokeObjectURL: () => {},
});

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

function pngFile(name: string, size = PNG.length): File {
  const bytes = new Uint8Array(size);
  bytes.set(PNG);
  return new File([bytes], name, { type: "image/png" });
}

async function pickFiles(files: File[]) {
  const input = document.querySelector<HTMLInputElement>("input[type='file']");
  if (!input) throw new Error("file picker not found");
  Object.defineProperty(input, "files", { value: files, configurable: true });
  await act(async () => {
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  // The acceptance sniffs the file bytes asynchronously before the form takes the images.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function attachedThumbnails(): HTMLImageElement[] {
  return [...document.querySelectorAll<HTMLImageElement>("ul[aria-label='Attached images'] img")];
}

function runDetail(status: RunState, providerSessionId: string | null = "ps-1"): RunDetail {
  return {
    run: {
      id: "run-1",
      issue_id: "i1",
      status,
      branch: "otomat/run/run-1",
      plan_json: {
        version: 1,
        steps: [
          {
            id: "s1",
            name: "Agent turn",
            agent: "claude",
            prompt: "p",
            depends_on: [],
            config: CONFIG,
          },
        ],
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
        provider_wait: null,
        next_turn_config: null,
      },
    ],
    sessions: [
      {
        id: "as1",
        step_run_id: "s1",
        kind: "step" as const,
        agent_id: "claude",
        status: "awaiting_input",
        provider_session_id: providerSessionId,
        resumed_from_session_id: null,
        config: CONFIG,
        reported_model: null,
        started_at: "2026-07-25T10:00:00.000Z",
        boundary: {
          start_tree_sha: null,
          start_head_sha: null,
          end_tree_sha: null,
          end_head_sha: null,
          error: null,
        },
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
      steering: "turn_boundary",
      abort: true,
      resume: true,
      resume_model: { status: "supported" },
      permissions: false,
      diff_hints: false,
      images: { status: "supported", standalone: true },
    },
    availability: { status: "available", version: null },
  };
}

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  document.body.replaceChildren();
  mutate.mockClear();
  onSent.mockClear();
  connectionState = "online";
  runtimesData = undefined;
  nextMutationError = null;
  contributionError = null;
});

async function renderComposer(detail: RunDetail) {
  const container = document.createElement("div");
  document.body.append(container);
  const root: Root = createRoot(container);
  await act(async () => {
    root.render(<ConversationComposer detail={detail} stepRunId="s1" onSent={onSent} />);
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

    expect(mutate).toHaveBeenCalledWith(
      {
        request: {
          step_run_id: "s1",
          target_agent_session_id: "as1",
          target_config_hash: "config-1",
          body: "add error handling",
        },
        images: [],
      },
      expect.anything(),
    );
    expect(promptTextarea().value).toBe("");
    expect(onSent).toHaveBeenCalledTimes(1);
  });

  it("keeps the draft and reports no send when the mutation fails", async () => {
    runtimesData = [claudeDescriptor()];
    nextMutationError = new Error("daemon refused the message");
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

    expect(mutate).toHaveBeenCalledWith(
      {
        request: {
          step_run_id: "s1",
          target_agent_session_id: "as1",
          target_config_hash: "config-1",
          body: "rename the helper",
        },
        images: [],
      },
      expect.anything(),
    );
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

    expect(mutate).not.toHaveBeenCalled();
  });

  it("queues a message sent while the run is active instead of refusing it", async () => {
    runtimesData = [claudeDescriptor()];
    await renderComposer(runDetail("running"));
    await typePrompt("also add tests");

    expect(sendButton().disabled).toBe(false);
    expect(sendButton().textContent).toContain("Queue message");
    expect(sendButton().title).toContain("next safe turn");

    await act(async () => {
      promptTextarea().dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", metaKey: true, bubbles: true }),
      );
    });

    expect(mutate).toHaveBeenCalledWith(
      {
        request: {
          step_run_id: "s1",
          target_agent_session_id: "as1",
          target_config_hash: "config-1",
          body: "also add tests",
        },
        images: [],
      },
      expect.anything(),
    );
  });

  it("refuses a message on a finished run", async () => {
    runtimesData = [claudeDescriptor()];
    await renderComposer(runDetail("completed"));

    expect(sendButton().disabled).toBe(true);
    expect(document.body.textContent).toContain(
      "To: Agent turn · Implementer · claude · claude-opus · Session as1",
    );
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

  it("attaches, previews and removes images, then sends them with the text", async () => {
    runtimesData = [claudeDescriptor()];
    await renderComposer(runDetail("awaiting_human"));
    await typePrompt("what is wrong here");

    await pickFiles([pngFile("shot-1.png"), pngFile("shot-2.png")]);
    expect(attachedThumbnails().map((img) => img.alt)).toEqual(["Attachment 1", "Attachment 2"]);
    expect(document.body.textContent).toContain("2 images attached");

    const remove = findLabelled("Remove attachment 1");
    if (!remove) throw new Error("remove button not found");
    await act(async () => {
      remove.click();
    });
    expect(attachedThumbnails()).toHaveLength(1);

    await act(async () => {
      sendButton().click();
    });

    const variables = mutate.mock.calls[0]?.[0];
    expect(variables?.request.body).toBe("what is wrong here");
    expect(variables?.images.map((file) => file.name)).toEqual(["shot-2.png"]);
    expect(attachedThumbnails()).toHaveLength(0);
  });

  it("takes an image pasted into the message and sends it alone when the runtime allows", async () => {
    runtimesData = [claudeDescriptor()];
    await renderComposer(runDetail("awaiting_human"));

    expect(sendButton().disabled).toBe(true);
    const paste = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(paste, "clipboardData", { value: { files: [pngFile("pasted.png")] } });
    await act(async () => {
      promptTextarea().dispatchEvent(paste);
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(attachedThumbnails()).toHaveLength(1);
    expect(sendButton().disabled).toBe(false);
    await act(async () => {
      sendButton().click();
    });
    expect(mutate.mock.calls[0]?.[0]?.request.body).toBe("");
    expect(mutate.mock.calls[0]?.[0]?.images).toHaveLength(1);
  });

  it("refuses a file that is not an image without attaching it", async () => {
    runtimesData = [claudeDescriptor()];
    await renderComposer(runDetail("awaiting_human"));

    await pickFiles([
      new File([new TextEncoder().encode("<svg/>")], "evil.png", { type: "image/png" }),
    ]);

    expect(attachedThumbnails()).toHaveLength(0);
    expect(document.body.textContent).toContain("Image 1 is not a PNG, JPEG, GIF or WebP image.");
  });

  it("keeps the attach control off and says why when the runtime takes no images", async () => {
    const descriptor = claudeDescriptor();
    descriptor.capabilities.images = {
      status: "unsupported",
      reason: "This Codex CLI does not announce an image flag.",
    };
    runtimesData = [descriptor];
    await renderComposer(runDetail("awaiting_human"));

    const attach = findLabelled("Attach images");
    if (!(attach instanceof HTMLButtonElement)) throw new Error("attach button not found");
    expect(attach.disabled).toBe(true);
    expect(attach?.title).toBe("This Codex CLI does not announce an image flag.");
  });

  it("needs text next to an image when the runtime cannot take one alone", async () => {
    const descriptor = claudeDescriptor();
    descriptor.capabilities.images = { status: "supported", standalone: false };
    runtimesData = [descriptor];
    await renderComposer(runDetail("awaiting_human"));

    await pickFiles([pngFile("shot.png")]);
    expect(attachedThumbnails()).toHaveLength(1);
    expect(sendButton().disabled).toBe(true);

    await typePrompt("see the screenshot");
    expect(sendButton().disabled).toBe(false);
  });
});
