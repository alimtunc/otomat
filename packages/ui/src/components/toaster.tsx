import { AlertTriangle, CheckCircle2, Info, Loader2, XCircle } from "lucide-react";
import { type CSSProperties } from "react";
import { Toaster as SonnerToaster, toast } from "sonner";

import { useTheme } from "../lib/theme";

export { toast };

export type ToasterProps = {
  position?:
    | "top-left"
    | "top-center"
    | "top-right"
    | "bottom-left"
    | "bottom-center"
    | "bottom-right";
  closeButton?: boolean;
  duration?: number;
};

const toastStyle: CSSProperties = {
  background: "var(--surface-3)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-lg)",
  boxShadow: "var(--shadow-overlay)",
  color: "var(--foreground)",
  fontSize: "var(--text-sm)",
};

export function Toaster({
  position = "bottom-right",
  closeButton = true,
  duration = 5000,
}: ToasterProps) {
  const { theme } = useTheme();

  return (
    <SonnerToaster
      theme={theme}
      position={position}
      closeButton={closeButton}
      duration={duration}
      style={{ zIndex: "var(--z-toast)" } as CSSProperties}
      icons={{
        success: <CheckCircle2 className="h-4 w-4 text-success" />,
        error: <XCircle className="h-4 w-4 text-danger" />,
        warning: <AlertTriangle className="h-4 w-4 text-warning" />,
        info: <Info className="h-4 w-4 text-neutral" />,
        loading: (
          <Loader2 className="h-4 w-4 animate-spin text-iris-text motion-reduce:animate-none" />
        ),
      }}
      toastOptions={{
        style: toastStyle,
        classNames: {
          toast: "font-sans",
          description: "text-text-secondary",
          actionButton: "text-iris-text",
          cancelButton: "text-text-tertiary",
        },
      }}
    />
  );
}
