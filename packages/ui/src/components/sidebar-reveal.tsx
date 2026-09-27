import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { isOverlayTarget } from "../lib/keyboard";
import { useSidePanel } from "../lib/side-panel-context";
import { SidebarCollapsedContext } from "../lib/sidebar-collapsed";
import { useMediaQuery } from "../lib/use-media-query";

export function SidebarReveal({
  children,
  defaultWidth,
  railWidth,
}: {
  children: ReactNode;
  defaultWidth: number;
  railWidth: number;
}) {
  const panel = useSidePanel();
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const collapsed = panel?.collapsed ?? false;
  const [preview, setPreview] = useState(false);
  const [pointerMotion, setPointerMotion] = useState(false);
  const [geometry, setGeometry] = useState({ top: 0, left: 0, height: 0, width: defaultWidth });
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismissed = useRef(false);
  const cancel = () => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  };
  if (!collapsed && preview) setPreview(false);
  // otomat-allow-effect: measure the panel's screen bounds and retain its expanded width for the overlay.
  useLayoutEffect(() => {
    const element = ref.current;
    if (element === null) return;
    const measure = () => {
      const bounds = element.getBoundingClientRect();
      setGeometry((previous) => ({
        top: bounds.top,
        left: bounds.left,
        height: bounds.height,
        width: collapsed || bounds.width <= railWidth ? previous.width : bounds.width,
      }));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => {
      observer.disconnect();
      cancel();
    };
  }, [collapsed, railWidth]);
  const revealed = collapsed && preview;
  return (
    <div
      ref={ref}
      className="relative flex h-full min-h-0 flex-col"
      onPointerEnter={(event) => {
        if (!collapsed || event.pointerType !== "mouse") return;
        dismissed.current = false;
        cancel();
        setPointerMotion(true);
        timer.current = setTimeout(() => setPreview(true), 100);
      }}
      onPointerLeave={() => {
        cancel();
        dismissed.current = false;
        if (!ref.current?.querySelector(":focus-visible")) {
          setPointerMotion(true);
          setPreview(false);
        }
      }}
      onFocusCapture={(event) => {
        if (!collapsed || !event.target.matches(":focus-visible") || dismissed.current) return;
        cancel();
        setPointerMotion(false);
        setPreview(true);
      }}
      onBlurCapture={(event) => {
        if (isOverlayTarget(event.relatedTarget)) return;
        if (!event.currentTarget.contains(event.relatedTarget)) {
          dismissed.current = false;
          setPointerMotion(false);
          setPreview(false);
        }
      }}
      onKeyDownCapture={(event) => {
        if (event.key !== "Escape" || !revealed || isOverlayTarget(event.target)) return;
        event.preventDefault();
        event.stopPropagation();
        cancel();
        dismissed.current = true;
        setPointerMotion(false);
        setPreview(false);
        if (panel !== null)
          ref.current
            ?.querySelector<HTMLButtonElement>(
              `button[aria-controls="${CSS.escape(panel.panelId)}"]`,
            )
            ?.focus();
      }}
    >
      <div
        data-sidebar-preview={revealed ? "" : undefined}
        className="flex h-full min-h-0 flex-col overflow-hidden bg-sidebar"
        style={
          collapsed
            ? {
                position: "fixed",
                zIndex: 40,
                top: geometry.top,
                left: geometry.left,
                height: geometry.height || "100%",
                width: revealed ? `min(${geometry.width}px, calc(100vw - 48px))` : railWidth,
                boxShadow: revealed ? "var(--shadow-overlay)" : "none",
                transition:
                  pointerMotion && !reducedMotion
                    ? "width 140ms var(--ease-out), box-shadow 140ms var(--ease-out)"
                    : "none",
              }
            : undefined
        }
      >
        <SidebarCollapsedContext.Provider value={collapsed && !revealed}>
          {children}
        </SidebarCollapsedContext.Provider>
      </div>
    </div>
  );
}
