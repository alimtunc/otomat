export function findButton(text: string): HTMLButtonElement | undefined {
  return [...document.body.querySelectorAll("button")].find(
    (button) => button.textContent?.trim() === text,
  ) as HTMLButtonElement | undefined;
}

/** Icon-only controls carry their name in `aria-label`, so text matching cannot reach them. */
export function findLabelled(label: string): HTMLElement | undefined {
  return (
    document.body.querySelector<HTMLElement>(`[aria-label="${CSS.escape(label)}"]`) ?? undefined
  );
}
