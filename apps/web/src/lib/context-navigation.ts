export const CONTEXT_NAVIGATION_EVENT = "otomat:context-navigation";

export function confirmContextNavigation(): boolean {
  return window.dispatchEvent(new Event(CONTEXT_NAVIGATION_EVENT, { cancelable: true }));
}
