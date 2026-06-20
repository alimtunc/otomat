import { AlertTriangle, CheckCircle2, Info, Loader2, Undo2, XCircle } from "lucide-react";
import { type CSSProperties, type ReactNode } from "react";
import { Toaster as SonnerToaster, toast as sonnerToast } from "sonner";

import { useTheme } from "../lib/theme";

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

export type OptimisticRollbackOptions = {
  id?: string | number;
  message: ReactNode;
  description?: ReactNode;
  undoLabel?: string;
  onUndo: () => void;
  duration?: number;
};

function optimisticRollback({
  id,
  message,
  description,
  undoLabel = "Undo",
  onUndo,
  duration = 6000,
}: OptimisticRollbackOptions) {
  return sonnerToast.warning(message, {
    id,
    description,
    duration,
    icon: <Undo2 className="h-4 w-4 text-warning" />,
    action: { label: undoLabel, onClick: onUndo },
  });
}

export const toast: typeof sonnerToast & { optimisticRollback: typeof optimisticRollback } =
  Object.assign(sonnerToast, { optimisticRollback });
