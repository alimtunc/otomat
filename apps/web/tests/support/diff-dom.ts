export const MODIFIED_FILE_PATCH = `diff --git a/src/index.ts b/src/index.ts
index 0000001..0000002 100644
--- a/src/index.ts
+++ b/src/index.ts
@@ -1,3 +1,3 @@
 line one
-line two
+line two changed
 line three
`;

export function diffLineRow(operator: string, id: string): string {
  return `<tr class="diff-line" id="${id}"><td><span class="diff-line-content-operator">${operator}</span></td></tr>`;
}

/** happy-dom lays nothing out, so every rect the diff surface reads is one a test hands it. */
export function domRect(top: number, height: number): DOMRect {
  return {
    x: 0,
    y: top,
    width: 800,
    height,
    top,
    left: 0,
    right: 800,
    bottom: top + height,
    toJSON: () => ({}),
  };
}

/** @git-diff-view hides a comment widget whose wrapper measures zero. */
export function stubDiffLayout(): void {
  Element.prototype.getBoundingClientRect = () => domRect(0, 20);
}

/** Tailwind writes the `overflow` shorthand; happy-dom only resolves the longhand it is asked for. */
export function overflowLonghandStyle(): HTMLStyleElement {
  const style = document.createElement("style");
  style.textContent = ".overflow-auto { overflow-y: auto; }";
  return style;
}

/** happy-dom has no canvas 2d context; @git-diff-view measures line-number width with it. */
export function stubDiffCanvas(): void {
  // SAFETY: @git-diff-view only reads font and measureText from the 2d context.
  (HTMLCanvasElement.prototype as { getContext: unknown }).getContext = () => ({
    font: "",
    measureText: (text: string) => ({ width: text.length * 7 }),
  });
}
