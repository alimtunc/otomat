/** happy-dom has no Web Animations API; Base UI's popups and scroll areas poll it after mount. */
export function stubAnimations(): void {
  Object.assign(Element.prototype, { getAnimations: (): Animation[] => [] });
}
