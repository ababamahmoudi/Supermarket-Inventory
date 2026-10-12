import type { ReactNode } from "react";
import { useDemo } from "./store";

export interface ValidationIssue {
  id: string;
  message: string;
  fieldId: string;
}

// Shared validation navigation is intentionally exported with its presentation.
// eslint-disable-next-line react-refresh/only-export-components
export function focusValidationField(fieldId: string) {
  const field = document.getElementById(fieldId);
  if (!field) return;
  field.scrollIntoView?.({
    behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth",
    block: "center",
  });
  const eligible = (element: HTMLElement) => {
    if (
      element.matches(
        'input[type="file"], input[type="hidden"], .ui-file-input',
      ) ||
      element.closest("[hidden]")
    )
      return false;
    const style = getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden";
  };
  const candidates = field.matches("input,textarea,button,[tabindex]")
    ? [field]
    : Array.from(
        field.querySelectorAll<HTMLElement>("input,textarea,button,[tabindex]"),
      );
  const target = candidates.find(eligible);
  target?.focus({ preventScroll: true });
  field.classList.add("validation-field-highlight");
  window.setTimeout(
    () => field.classList.remove("validation-field-highlight"),
    2500,
  );
}

export function WhatsMissing({
  issues,
  title,
}: {
  issues: readonly ValidationIssue[];
  title?: string;
}) {
  const { t } = useDemo();
  if (!issues.length) return null;
  return (
    <section
      className="whats-missing"
      role="alert"
      aria-label={title ?? t("What's missing", "موارد ناقص")}
    >
      <h3>{title ?? t("What's missing", "موارد ناقص")}</h3>
      <ul>
        {issues.map((issue) => (
          <li key={issue.id}>
            <a
              href={`#${issue.fieldId}`}
              onClick={(event) => {
                event.preventDefault();
                focusValidationField(issue.fieldId);
              }}
            >
              {issue.message}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function FieldError({
  id,
  children,
}: {
  id?: string;
  children: ReactNode;
}) {
  return children ? (
    <p id={id} className="form-error" role="alert">
      {children}
    </p>
  ) : null;
}
