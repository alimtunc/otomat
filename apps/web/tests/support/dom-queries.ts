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

/** Menu entries render as `role="menuitem"` elements, not buttons. */
export function findMenuItem(text: string): HTMLElement | undefined {
  return [...document.body.querySelectorAll<HTMLElement>("[role='menuitem']")].find(
    (item) => item.textContent?.trim() === text,
  );
}

export function menuSectionLabels(): HTMLElement[] {
  return [...document.body.querySelectorAll<HTMLElement>("[role='group']")].flatMap((group) => {
    const id = group.getAttribute("aria-labelledby");
    const label = id === null ? null : document.getElementById(id);
    return label === null ? [] : [label];
  });
}

export function findRefreshButton(container: ParentNode): HTMLButtonElement | null {
  return container.querySelector<HTMLButtonElement>("button[aria-label^='Refresh issues']");
}
