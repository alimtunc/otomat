// @vitest-environment happy-dom
import { IssueDescription } from "@web/components/issues/issue/description";
import { act } from "react";
import { expect, it } from "vitest";

import { mount } from "#support/mount";

it("keeps the preview inert and preserves the editor when its description is folded", async () => {
  const view = await mount(
    <IssueDescription
      body="[Attachment](https://example.test)"
      collapsed
      comments={<textarea aria-label="Comment on issue" defaultValue="Unsent comment" />}
    >
      <button type="button" data-editor>
        Edit description
      </button>
    </IssueDescription>,
  );
  try {
    const trigger = view.container.querySelector<HTMLButtonElement>("button[aria-expanded]");
    const editor = view.container.querySelector<HTMLButtonElement>("[data-editor]");
    const comment = view.container.querySelector<HTMLTextAreaElement>("textarea");
    expect(trigger?.getAttribute("aria-expanded")).toBe("false");
    expect(trigger?.textContent).toContain("Open description and comments");
    expect(view.container.querySelector("[inert] a")).not.toBeNull();
    expect(editor?.closest("[hidden]")).not.toBeNull();
    expect(comment?.closest("[hidden]")).toBe(editor?.closest("[hidden]"));

    await act(async () => trigger?.click());
    expect(trigger?.getAttribute("aria-expanded")).toBe("true");
    expect(editor?.closest("[hidden]")).toBeNull();
    expect(comment?.closest("[hidden]")).toBeNull();
    await act(async () => {
      editor?.focus();
      editor?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(trigger?.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger);
    expect(view.container.querySelector("[data-editor]")).toBe(editor);
    expect(view.container.querySelector("textarea")).toBe(comment);
    expect(comment?.value).toBe("Unsent comment");
  } finally {
    await view.cleanup();
  }
});
