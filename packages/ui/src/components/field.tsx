import { useRender } from "@base-ui/react/use-render";
import {
  createContext,
  use,
  useId,
  type ComponentPropsWithoutRef,
  type ReactElement,
  type ReactNode,
} from "react";

import { cn } from "../lib/utils";

interface FieldContextValue {
  controlId: string;
  hintId: string;
  errorId: string;
  invalid: boolean;
  hasHint: boolean;
  hasError: boolean;
}

const FieldContext = createContext<FieldContextValue | null>(null);

function useFieldContext(component: string): FieldContextValue {
  const ctx = use(FieldContext);
  if (!ctx) {
    throw new Error(`<${component}> must be used within <Field>`);
  }
  return ctx;
}

export interface FieldProps extends ComponentPropsWithoutRef<"div"> {
  invalid?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
}

export function Field({ className, invalid = false, hint, error, children, ...props }: FieldProps) {
  const baseId = useId();
  const value: FieldContextValue = {
    controlId: `${baseId}-control`,
    hintId: `${baseId}-hint`,
    errorId: `${baseId}-error`,
    invalid,
    hasHint: hint != null,
    hasError: error != null,
  };

  return (
    <FieldContext.Provider value={value}>
      <div className={cn("flex flex-col gap-1.5", className)} {...props}>
        {children}
        {value.hasHint && !value.hasError ? (
          <p id={value.hintId} className="text-xs text-text-tertiary">
            {hint}
          </p>
        ) : null}
        {value.hasError ? (
          <p id={value.errorId} role="alert" className="text-xs text-danger">
            {error}
          </p>
        ) : null}
      </div>
    </FieldContext.Provider>
  );
}

export interface FieldLabelProps extends ComponentPropsWithoutRef<"label"> {}

export function FieldLabel({ className, ...props }: FieldLabelProps) {
  const { controlId } = useFieldContext("FieldLabel");
  return (
    <label
      htmlFor={controlId}
      className={cn("text-xs font-medium text-text-secondary", className)}
      {...props}
    />
  );
}

export interface FieldControlProps {
  children: ReactElement;
}

export function FieldControl({ children }: FieldControlProps) {
  const { controlId, hintId, errorId, invalid, hasHint, hasError } =
    useFieldContext("FieldControl");

  const describedBy =
    [hasError ? errorId : null, hasHint && !hasError ? hintId : null].filter(Boolean).join(" ") ||
    undefined;

  return useRender({
    render: children,
    props: {
      id: controlId,
      "aria-invalid": invalid || undefined,
      "aria-describedby": describedBy,
    },
  });
}
