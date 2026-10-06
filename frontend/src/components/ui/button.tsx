import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-60 motion-reduce:transition-none",
  {
    variants: {
      variant: {
        primary: "bg-brand text-card hover:bg-brand-hover",
        secondary: "border border-border bg-card text-text hover:bg-page",
        sidebar: "text-card hover:bg-sidebar-active",
      },
    },
    defaultVariants: { variant: "primary" },
  },
);

type ButtonProps = ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({
  className,
  variant,
  asChild = false,
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot : "button";
  return (
    <Component
      type="button"
      className={cn(buttonVariants({ variant, className }))}
      {...props}
    />
  );
}
