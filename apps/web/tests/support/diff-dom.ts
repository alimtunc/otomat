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

/** happy-dom lays nothing out; @git-diff-view hides a comment widget whose wrapper measures zero. */
export function stubDiffLayout(): void {
  Element.prototype.getBoundingClientRect = () => ({
    x: 0,
    y: 0,
    width: 800,
    height: 20,
    top: 0,
    left: 0,
    right: 800,
    bottom: 20,
    toJSON: () => ({}),
  });
}

/** happy-dom has no canvas 2d context; @git-diff-view measures line-number width with it. */
export function stubDiffCanvas(): void {
  // SAFETY: @git-diff-view only reads font and measureText from the 2d context.
  (HTMLCanvasElement.prototype as { getContext: unknown }).getContext = () => ({
    font: "",
    measureText: (text: string) => ({ width: text.length * 7 }),
  });
}
