import { injectStyleOnce } from "./inject-style";

const SPIN_KEYFRAMES_ID = "otomat-spin";
const SPIN_KEYFRAMES_CSS = "@keyframes otomat-spin{to{transform:rotate(360deg)}}";

export function injectSpinKeyframes(): void {
  injectStyleOnce(SPIN_KEYFRAMES_ID, SPIN_KEYFRAMES_CSS);
}
