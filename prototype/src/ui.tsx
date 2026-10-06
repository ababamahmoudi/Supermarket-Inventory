import {
  useEffect,
  useId,
  useRef,
  cloneElement,
  isValidElement,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
} from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  CheckCircle2,
  CircleDashed,
  Clock3,
  Info,
  TriangleAlert,
} from "lucide-react";
import { useDemo } from "./store";

export function cn(...values: ClassValue[]) {
  return twMerge(clsx(values));
}
const buttonVariants = cva("button", {
  variants: {
    variant: {
      primary: "button-primary",
      secondary: "button-secondary",
      danger: "button-danger",
      ghost: "button-ghost",
    },
    size: { default: "", sm: "button-sm" },
  },
  defaultVariants: { variant: "primary", size: "default" },
});
export function Button({
  variant = "primary",
  size = "default",
  asChild = false,
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "default" | "sm";
  asChild?: boolean;
}) {
  const Component = asChild ? Slot : "button";
  return (
    <Component
      className={cn(buttonVariants({ variant, size }), className)}
      type={type}
      {...props}
    />
  );
}
export function Card({
  title,
  children,
  className,
  ...props
}: HTMLAttributes<HTMLElement> & { title?: string }) {
  return (
    <section className={cn("card", className)} {...props}>
      {title && <h2>{title}</h2>}
      {children}
    </section>
  );
}
const badgeIcons = {
  pending: Clock3,
  approved: CheckCircle2,
  danger: TriangleAlert,
  info: Info,
  neutral: CircleDashed,
};
export function Badge({
  tone = "neutral",
  children,
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof badgeIcons }) {
  const Icon = badgeIcons[tone];
  return (
    <span className={cn("badge", tone, className)} {...props}>
      <Icon size={14} aria-hidden="true" />
      {children}
    </span>
  );
}
export function Field({
  label,
  children,
  error,
  hint,
  className,
}: {
  label: string;
  children: ReactNode;
  error?: string;
  hint?: string;
  className?: string;
}) {
  const generated = useId();
  const child = isValidElement(children)
    ? (children as ReactElement<{
        id?: string;
        "aria-describedby"?: string;
        "aria-invalid"?: boolean;
      }>)
    : null;
  const id = child?.props.id ?? generated;
  const descriptionId = `${id}-help`;
  return (
    <div className={cn("field", className)}>
      <label htmlFor={id}>{label}</label>
      {child
        ? cloneElement(child, {
            id,
            "aria-describedby": error || hint ? descriptionId : undefined,
            "aria-invalid": Boolean(error),
          })
        : children}
      {(error || hint) && (
        <p id={descriptionId} className={error ? "form-error" : "helper"}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {description && <p className="muted">{description}</p>}
      </div>
      {actions && <div className="actions">{actions}</div>}
    </header>
  );
}
export function DataTable({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("table-wrap", className)} tabIndex={0} {...props}>
      <table>{children}</table>
    </div>
  );
}
export function EmptyState({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <p>{children}</p>
      {action}
    </div>
  );
}
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  children?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const { t } = useDemo();
  useEffect(() => {
    if (open && !ref.current?.open) ref.current?.showModal();
    if (!open && ref.current?.open) ref.current?.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="confirm-dialog"
      aria-labelledby={titleId}
      onCancel={() => onOpenChange(false)}
      onClose={() => onOpenChange(false)}
    >
      <h2 id={titleId}>{title}</h2>
      <p className="muted">{description}</p>
      {children}
      <div className="actions">
        <Button variant="secondary" onClick={() => onOpenChange(false)}>
          {t("Cancel", "انصراف")}
        </Button>
        <Button
          onClick={() => {
            onConfirm();
            onOpenChange(false);
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
