/** Appends a `<style id=…>` to head exactly once; no-op on the server and on re-render. */
export function injectStyleOnce(id: string, css: string): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(id)) return;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = css;
  document.head.appendChild(style);
}
