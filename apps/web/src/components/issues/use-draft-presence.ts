import { useEffect, useEffectEvent } from "react";

export function useDraftPresence(hasDraft: boolean, onChange?: (hasDraft: boolean) => void) {
  const report = useEffectEvent((value: boolean) => onChange?.(value));
  // otomat-allow-effect: publish form draft presence to the dialog's mode indicator.
  useEffect(() => {
    report(hasDraft);
  }, [hasDraft]);
}
