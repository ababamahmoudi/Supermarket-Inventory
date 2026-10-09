import {
  useEffect,
  useId,
  useRef,
  useState,
  createContext,
  useContext,
  cloneElement,
  isValidElement,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
  type InputHTMLAttributes,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Camera,
  FileText,
  Upload,
  X,
  Inbox,
  Search,
  ArrowUpRight,
} from "lucide-react";
import { useDemo } from "./store";
import "./controls.css";

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
      className={cn("ui-button", buttonVariants({ variant, size }), className)}
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
    <section className={cn("card ui-card", className)} {...props}>
      {title && <h2>{title}</h2>}
      {children}
    </section>
  );
}
type BadgeTone =
  "pending" | "approved" | "danger" | "info" | "neutral" | "progress";
function statusTone(children: ReactNode): BadgeTone | undefined {
  if (typeof children !== "string") return;
  const text = children.trim().toLowerCase();
  const groups: [BadgeTone, string[]][] = [
    [
      "progress",
      [
        "needs review",
        "processing",
        "ready to post",
        "partially resolved",
        "نیاز به بررسی",
        "در حال پردازش",
        "آماده ثبت",
        "آمادهٔ ثبت",
        "تا حدی حل‌شده",
        "تا حدی حل شده",
      ],
    ],
    [
      "pending",
      [
        "pending",
        "waiting for supplier",
        "expiring soon",
        "still pending",
        "در انتظار",
        "در انتظار تأمین‌کننده",
        "نزدیک انقضا",
        "نزدیک به انقضا",
        "همچنان در انتظار",
      ],
    ],
    [
      "approved",
      [
        "approved",
        "posted",
        "active",
        "resolved",
        "taken care of",
        "picked up",
        "تأییدشده",
        "ثبت‌شده",
        "فعال",
        "حل‌شده",
        "رسیدگی‌شده",
        "تحویل گرفته‌شده",
        "جمع‌آوری‌شده",
      ],
    ],
    [
      "info",
      [
        "open",
        "new product",
        "price change",
        "taxable",
        "intentional",
        "باز",
        "کالای جدید",
        "تغییر قیمت",
        "مشمول مالیات",
        "عمدی",
      ],
    ],
    [
      "neutral",
      [
        "draft",
        "cancelled",
        "rejected",
        "archived",
        "cleared",
        "stopped",
        "پیش‌نویس",
        "لغوشده",
        "ردشده",
        "بایگانی‌شده",
        "پاک‌شده",
        "متوقف‌شده",
      ],
    ],
    [
      "danger",
      [
        "short",
        "conflict",
        "expired",
        "overdue",
        "failed",
        "tax discrepancy",
        "کسری",
        "تعارض",
        "منقضی",
        "منقضی‌شده",
        "سررسید گذشته",
        "ناموفق",
        "اختلاف مالیات",
        "اختلاف مالیاتی",
      ],
    ],
  ];
  return groups.find(([, words]) => words.includes(text))?.[0];
}
export function Badge({
  tone = "neutral",
  children,
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  const resolvedTone = statusTone(children) ?? tone;
  const offer = typeof children === "string" && /^\d+\s+for\s+/i.test(children);
  return (
    <span
      className={cn(
        "badge ui-badge",
        resolvedTone,
        { "offer-pill": offer },
        className,
      )}
      {...props}
    >
      <span className="ui-status-dot" aria-hidden="true" />
      {children}
    </span>
  );
}
export const StatusBadge = Badge;
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
        "aria-label"?: string;
        "aria-labelledby"?: string;
        "aria-describedby"?: string;
        "aria-invalid"?: boolean;
      }>)
    : null;
  const id = child?.props.id ?? generated;
  const labelId = `${id}-label`;
  const descriptionId = `${id}-help`;
  return (
    <div className={cn("field", className)}>
      <label id={labelId} htmlFor={id}>
        {label}
      </label>
      {child
        ? cloneElement(child, {
            id,
            "aria-labelledby":
              child.props["aria-labelledby"] ??
              (child.props["aria-label"] ? undefined : labelId),
            "aria-describedby":
              [
                child.props["aria-describedby"],
                error || hint ? descriptionId : undefined,
              ]
                .filter(Boolean)
                .join(" ") || undefined,
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
    <div className="empty-state ui-empty-state">
      <span className="ui-empty-icon">
        <Inbox size={24} strokeWidth={1.5} aria-hidden="true" />
      </span>
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
      className="confirm-dialog ui-dialog"
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

type ControlAttributes = Pick<
  ButtonHTMLAttributes<HTMLButtonElement>,
  | "id"
  | "disabled"
  | "className"
  | "aria-label"
  | "aria-labelledby"
  | "aria-describedby"
  | "aria-invalid"
  | "dir"
  | "title"
>;
export type SelectOption = { value: string; label: string; disabled?: boolean };

function usePopover(minWidth = 224) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<CSSProperties>({});
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const measure = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(
      Math.max(rect.width, minWidth),
      window.innerWidth - 24,
    );
    const roomBelow = window.innerHeight - rect.bottom - 16;
    const above = roomBelow < 240 && rect.top > roomBelow;
    const rtl = document.documentElement.dir === "rtl";
    setPosition({
      position: "fixed",
      left: Math.max(
        12,
        Math.min(
          rtl ? rect.right - width : rect.left,
          window.innerWidth - width - 12,
        ),
      ),
      width,
      ...(above
        ? { bottom: window.innerHeight - rect.top + 8 }
        : { top: rect.bottom + 8 }),
      maxHeight: Math.max(120, above ? rect.top - 24 : roomBelow),
    });
  };
  const close = (restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  };
  const show = () => {
    measure();
    setPortalTarget(triggerRef.current?.closest("dialog") ?? document.body);
    setOpen(true);
  };
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !triggerRef.current?.contains(event.target) &&
        !popupRef.current?.contains(event.target)
      )
        close();
    };
    const blur = (event: FocusEvent) => {
      if (
        event.target instanceof Node &&
        !triggerRef.current?.contains(event.target) &&
        !popupRef.current?.contains(event.target)
      )
        close();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", blur);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("focusin", blur);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  });
  return { open, show, close, position, portalTarget, triggerRef, popupRef };
}

export function Select({
  value,
  onChange,
  options,
  searchable,
  className,
  disabled,
  ...attributes
}: ControlAttributes & {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  searchable?: boolean;
}) {
  const { t } = useDemo();
  const {
    open: popupOpen,
    show: showPopup,
    close: closePopup,
    position: popupPosition,
    portalTarget,
    triggerRef,
    popupRef,
  } = usePopover();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(value);
  const searchRef = useRef<HTMLInputElement>(null);
  const typeahead = useRef({ value: "", time: 0 });
  const canSearch = searchable ?? options.length > 8;
  const selected = options.find((option) => option.value === value);
  const filtered = options.filter((option) =>
    option.label.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  const enabled = filtered.filter((option) => !option.disabled);
  const open = (edge?: "first" | "last") => {
    setQuery("");
    const choices = options.filter((option) => !option.disabled);
    setActive(
      edge === "first"
        ? (choices[0]?.value ?? "")
        : edge === "last"
          ? (choices.at(-1)?.value ?? "")
          : (choices.find((option) => option.value === value)?.value ??
            choices[0]?.value ??
            ""),
    );
    showPopup();
    if (canSearch) requestAnimationFrame(() => searchRef.current?.focus());
  };
  const choose = (option: SelectOption) => {
    if (option.disabled) return;
    onChange(option.value);
    closePopup(true);
  };
  const keydown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape" && popupOpen) {
      event.preventDefault();
      event.stopPropagation();
      closePopup(true);
      return;
    }
    if (event.key === "Tab") {
      closePopup();
      return;
    }
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      if (!popupOpen) {
        open(
          event.key === "ArrowUp" || event.key === "End" ? "last" : undefined,
        );
        return;
      }
      const index = enabled.findIndex((option) => option.value === active);
      const next =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? enabled.length - 1
            : (index + (event.key === "ArrowUp" ? -1 : 1) + enabled.length) %
              enabled.length;
      setActive(enabled[next]?.value ?? "");
      return;
    }
    if (
      (event.key === "Enter" || event.key === " ") &&
      !(event.target instanceof HTMLInputElement && event.key === " ")
    ) {
      event.preventDefault();
      if (!popupOpen) open();
      else {
        const option = filtered.find((item) => item.value === active);
        if (option) choose(option);
      }
    } else if (
      event.key.length === 1 &&
      !(event.target instanceof HTMLInputElement)
    ) {
      const now = Date.now();
      typeahead.current.value =
        (now - typeahead.current.time < 700 ? typeahead.current.value : "") +
        event.key.toLocaleLowerCase();
      typeahead.current.time = now;
      const match = options.find(
        (option) =>
          !option.disabled &&
          option.label.toLocaleLowerCase().startsWith(typeahead.current.value),
      );
      if (match) {
        if (!popupOpen) open();
        setActive(match.value);
      }
    }
  };
  useEffect(() => {
    if (!popupOpen) return;
    const option = document.getElementById(
      `${listId}-${options.findIndex((item) => item.value === active)}`,
    );
    option?.scrollIntoView?.({ block: "nearest" });
  }, [active, popupOpen, options, listId]);
  return (
    <>
      <button
        {...attributes}
        ref={triggerRef}
        type="button"
        className={cn("ui-select ui-input", className)}
        disabled={disabled}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={popupOpen}
        aria-controls={listId}
        aria-activedescendant={
          popupOpen && active
            ? `${listId}-${options.findIndex((item) => item.value === active)}`
            : undefined
        }
        onClick={() => (popupOpen ? closePopup() : open())}
        onKeyDown={keydown}
      >
        <span className={selected ? undefined : "muted"}>
          {selected?.label ?? t("Choose an option", "یک گزینه انتخاب کنید")}
        </span>
        <ChevronDown size={18} strokeWidth={1.5} aria-hidden="true" />
      </button>
      {popupOpen &&
        createPortal(
          <div
            ref={popupRef}
            className="ui-popover ui-select-popover"
            style={popupPosition}
            onKeyDown={keydown}
          >
            {canSearch && (
              <div className="ui-select-search">
                <Search size={16} strokeWidth={1.5} aria-hidden="true" />
                <input
                  ref={searchRef}
                  type="text"
                  value={query}
                  aria-label={t("Search options", "جستجوی گزینه‌ها")}
                  aria-controls={listId}
                  aria-activedescendant={
                    active
                      ? `${listId}-${options.findIndex((item) => item.value === active)}`
                      : undefined
                  }
                  onChange={(event) => {
                    const nextQuery = event.target.value;
                    setQuery(nextQuery);
                    setActive(
                      options.find(
                        (option) =>
                          !option.disabled &&
                          option.label
                            .toLocaleLowerCase()
                            .includes(nextQuery.toLocaleLowerCase()),
                      )?.value ?? "",
                    );
                  }}
                />
              </div>
            )}
            <div
              role="listbox"
              id={listId}
              aria-label={attributes["aria-label"]}
              aria-labelledby={attributes["aria-labelledby"]}
              className="ui-option-list"
            >
              {filtered.map((option) => (
                <button
                  key={option.value}
                  id={`${listId}-${options.findIndex((item) => item.value === option.value)}`}
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  aria-disabled={option.disabled || undefined}
                  disabled={option.disabled}
                  tabIndex={-1}
                  className={cn("ui-option", {
                    "is-active": active === option.value,
                  })}
                  onPointerMove={() => {
                    if (!option.disabled) setActive(option.value);
                  }}
                  onClick={() => choose(option)}
                >
                  <span>{option.label}</span>
                  {option.value === value && (
                    <Check size={16} strokeWidth={1.5} aria-hidden="true" />
                  )}
                </button>
              ))}
              {!filtered.length && (
                <p className="ui-option-empty" role="status">
                  {t("No matching options", "گزینه‌ای پیدا نشد")}
                </p>
              )}
            </div>
          </div>,
          portalTarget ?? document.body,
        )}
    </>
  );
}

type CheckedControlProps = ControlAttributes & {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children?: ReactNode;
};
export function Checkbox({
  checked,
  onChange,
  children,
  className,
  ...props
}: CheckedControlProps) {
  return (
    <button
      {...props}
      type="button"
      role="checkbox"
      aria-checked={checked}
      className={cn("ui-checked-control", className)}
      onClick={() => onChange(!checked)}
    >
      <span className="ui-checkbox-box" aria-hidden="true">
        {checked && <Check size={14} strokeWidth={2} />}
      </span>
      {children && <span>{children}</span>}
    </button>
  );
}
export function Radio({
  checked,
  onChange,
  children,
  className,
  ...props
}: CheckedControlProps) {
  return (
    <button
      {...props}
      type="button"
      role="radio"
      aria-checked={checked}
      className={cn("ui-checked-control", className)}
      onClick={() => onChange(true)}
      onKeyDown={(event) => {
        if (
          ![
            "ArrowLeft",
            "ArrowRight",
            "ArrowUp",
            "ArrowDown",
            "Home",
            "End",
          ].includes(event.key)
        )
          return;
        const group = event.currentTarget.closest('[role="radiogroup"]');
        if (!group) return;
        event.preventDefault();
        const radios = Array.from(
          group.querySelectorAll<HTMLButtonElement>(
            '[role="radio"]:not(:disabled)',
          ),
        );
        const current = radios.indexOf(event.currentTarget);
        const rtl = document.documentElement.dir === "rtl";
        const offset =
          event.key === "ArrowDown" ||
          event.key === (rtl ? "ArrowLeft" : "ArrowRight")
            ? 1
            : -1;
        const index =
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? radios.length - 1
              : (current + offset + radios.length) % radios.length;
        radios[index]?.focus();
        radios[index]?.click();
      }}
    >
      <span className="ui-radio-box" aria-hidden="true" />
      {children && <span>{children}</span>}
    </button>
  );
}
export function Switch({
  checked,
  onChange,
  children,
  className,
  ...props
}: CheckedControlProps) {
  return (
    <button
      {...props}
      type="button"
      role="switch"
      aria-checked={checked}
      className={cn("ui-checked-control", className)}
      onClick={() => onChange(!checked)}
    >
      <span className="ui-switch-track" aria-hidden="true">
        <span />
      </span>
      {children && <span>{children}</span>}
    </button>
  );
}

export function NumberField({
  value,
  onChange,
  min,
  max,
  step,
  className,
  ...props
}: Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "onChange" | "min" | "max" | "step"
> & {
  value: string | number;
  onChange: (value: string) => void;
  min?: string | number;
  max?: string | number;
  step?: string | number;
}) {
  return (
    <input
      {...props}
      type="text"
      inputMode={step === 1 || step === "1" ? "numeric" : "decimal"}
      value={value}
      className={cn("ui-input ui-number", className)}
      min={min}
      max={max}
      step={step}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

const parseDate = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return;
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );
  if (
    date.getFullYear() !== Number(match[1]) ||
    date.getMonth() !== Number(match[2]) - 1 ||
    date.getDate() !== Number(match[3])
  )
    return;
  return date;
};
const dateValue = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const shiftDate = (date: Date, days: number) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
const shiftMonth = (date: Date, count: number) => {
  const lastDay = new Date(
    date.getFullYear(),
    date.getMonth() + count + 1,
    0,
  ).getDate();
  return new Date(
    date.getFullYear(),
    date.getMonth() + count,
    Math.min(date.getDate(), lastDay),
  );
};

export function DateField({
  value,
  onChange,
  min,
  max,
  className,
  disabled,
  ...props
}: ControlAttributes & {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
}) {
  const { lang, t } = useDemo();
  const {
    open: popupOpen,
    show: showPopup,
    close: closePopup,
    position: popupPosition,
    portalTarget,
    triggerRef,
    popupRef,
  } = usePopover(320);
  const calendarId = useId();
  const initial = parseDate(value) ?? new Date();
  const [month, setMonth] = useState(initial);
  const [active, setActive] = useState(dateValue(initial));
  const dayRefs = useRef(new Map<string, HTMLButtonElement>());
  const clamp = (date: Date) => {
    const text = dateValue(date);
    return min && text < min
      ? (parseDate(min) ?? date)
      : max && text > max
        ? (parseDate(max) ?? date)
        : date;
  };
  const locale = lang === "fa" ? "fa-IR-u-ca-gregory-nu-latn" : "en-US";
  const dateLabel = (date: Date) =>
    date.toLocaleDateString(locale, {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  const focusDate = (date: Date) => {
    const next = clamp(date);
    const nextValue = dateValue(next);
    setMonth(next);
    setActive(nextValue);
    requestAnimationFrame(() => dayRefs.current.get(nextValue)?.focus());
  };
  const show = () => {
    const current = clamp(parseDate(value) ?? new Date());
    setMonth(current);
    setActive(dateValue(current));
    showPopup();
    requestAnimationFrame(() =>
      dayRefs.current.get(dateValue(current))?.focus(),
    );
  };
  const choose = (date: string) => {
    onChange(date);
    closePopup(true);
  };
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = shiftDate(first, -first.getDay());
  const days = Array.from({ length: 42 }, (_, index) =>
    shiftDate(start, index),
  );
  const monthBefore = new Date(month.getFullYear(), month.getMonth(), 0);
  const monthAfter = new Date(month.getFullYear(), month.getMonth() + 1, 1);
  return (
    <>
      <button
        {...props}
        ref={triggerRef}
        type="button"
        disabled={disabled}
        className={cn("ui-input ui-date", className)}
        aria-haspopup="dialog"
        aria-expanded={popupOpen}
        aria-controls={calendarId}
        onClick={() => (popupOpen ? closePopup() : show())}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            show();
          } else if (event.key === "Escape") closePopup(true);
        }}
      >
        <span dir="ltr" className={value ? "tabular" : "muted"}>
          {value || t("Choose date", "تاریخ را انتخاب کنید")}
        </span>
        <CalendarDays size={18} strokeWidth={1.5} aria-hidden="true" />
      </button>
      {popupOpen &&
        createPortal(
          <div
            ref={popupRef}
            id={calendarId}
            role="dialog"
            aria-label={
              props["aria-label"] ?? t("Choose date", "تاریخ را انتخاب کنید")
            }
            className="ui-popover ui-calendar"
            style={popupPosition}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                closePopup(true);
              }
            }}
          >
            <div className="ui-calendar-header">
              <IconButton
                variant="ghost"
                aria-label={t("Previous month", "ماه قبل")}
                disabled={Boolean(min && dateValue(monthBefore) < min)}
                onClick={() => focusDate(shiftMonth(month, -1))}
              >
                <ChevronLeft
                  size={18}
                  strokeWidth={1.5}
                  className="directional"
                />
              </IconButton>
              <strong aria-live="polite">
                {month.toLocaleDateString(locale, {
                  month: "long",
                  year: "numeric",
                })}
              </strong>
              <IconButton
                variant="ghost"
                aria-label={t("Next month", "ماه بعد")}
                disabled={Boolean(max && dateValue(monthAfter) > max)}
                onClick={() => focusDate(shiftMonth(month, 1))}
              >
                <ChevronRight
                  size={18}
                  strokeWidth={1.5}
                  className="directional"
                />
              </IconButton>
            </div>
            <div
              role="grid"
              aria-label={month.toLocaleDateString(locale, {
                month: "long",
                year: "numeric",
              })}
              className="ui-calendar-grid"
            >
              <div role="row" className="ui-calendar-row">
                {days.slice(0, 7).map((day) => (
                  <span key={day.getDay()} role="columnheader">
                    {day.toLocaleDateString(locale, { weekday: "narrow" })}
                  </span>
                ))}
              </div>
              {Array.from({ length: 6 }, (_, row) => (
                <div role="row" className="ui-calendar-row" key={row}>
                  {days.slice(row * 7, row * 7 + 7).map((day) => {
                    const dayValue = dateValue(day);
                    const unavailable = Boolean(
                      (min && dayValue < min) || (max && dayValue > max),
                    );
                    return (
                      <div
                        role="gridcell"
                        key={dayValue}
                        aria-selected={dayValue === value}
                      >
                        <button
                          ref={(node) => {
                            if (node) dayRefs.current.set(dayValue, node);
                            else dayRefs.current.delete(dayValue);
                          }}
                          type="button"
                          className={cn("ui-calendar-day", {
                            "outside-month":
                              day.getMonth() !== month.getMonth(),
                            selected: dayValue === value,
                            today: dayValue === dateValue(new Date()),
                          })}
                          aria-label={dateLabel(day)}
                          aria-current={
                            dayValue === dateValue(new Date())
                              ? "date"
                              : undefined
                          }
                          disabled={unavailable}
                          tabIndex={dayValue === active ? 0 : -1}
                          onClick={() => choose(dayValue)}
                          onKeyDown={(event) => {
                            const direction = lang === "fa" ? -1 : 1;
                            const offset =
                              event.key === "ArrowRight"
                                ? direction
                                : event.key === "ArrowLeft"
                                  ? -direction
                                  : event.key === "ArrowDown"
                                    ? 7
                                    : event.key === "ArrowUp"
                                      ? -7
                                      : event.key === "Home"
                                        ? -day.getDay()
                                        : event.key === "End"
                                          ? 6 - day.getDay()
                                          : undefined;
                            if (offset !== undefined) {
                              event.preventDefault();
                              focusDate(shiftDate(day, offset));
                            } else if (
                              event.key === "PageUp" ||
                              event.key === "PageDown"
                            ) {
                              event.preventDefault();
                              focusDate(
                                shiftMonth(
                                  day,
                                  event.key === "PageUp" ? -1 : 1,
                                ),
                              );
                            }
                          }}
                        >
                          {day.getDate()}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            <div className="ui-calendar-footer">
              <Button
                variant="ghost"
                size="sm"
                disabled={Boolean(
                  (min && dateValue(new Date()) < min) ||
                  (max && dateValue(new Date()) > max),
                )}
                onClick={() => choose(dateValue(new Date()))}
              >
                {t("Today", "امروز")}
              </Button>
              {value && (
                <Button variant="ghost" size="sm" onClick={() => choose("")}>
                  {t("Clear", "پاک کردن")}
                </Button>
              )}
            </div>
          </div>,
          portalTarget ?? document.body,
        )}
    </>
  );
}

export function Dropzone({
  fileName,
  fileSize,
  accept = ".pdf,image/*",
  onChange,
  onRemove,
  id,
  disabled,
  className,
  ...props
}: {
  fileName?: string;
  fileSize?: number;
  accept?: string;
  onChange: (file: File) => void;
  onRemove?: () => void;
  id?: string;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}) {
  const { t } = useDemo();
  const generated = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const selectFile = (files: FileList | null) => {
    if (!disabled && files?.[0]) onChange(files[0]);
  };
  const sizeLabel =
    fileSize === undefined
      ? undefined
      : fileSize < 1024 * 1024
        ? `${Math.max(1, Math.round(fileSize / 1024))} KB`
        : `${(fileSize / (1024 * 1024)).toFixed(1)} MB`;
  return (
    <div
      className={cn(
        "ui-dropzone",
        {
          "is-dragging": dragging,
          "is-disabled": disabled,
          "has-file": fileName,
        },
        className,
      )}
      onDragEnter={(event) => {
        event.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        selectFile(event.dataTransfer.files);
      }}
    >
      <input
        {...props}
        ref={inputRef}
        id={id ?? generated}
        aria-label={props["aria-label"] ?? t("Upload file", "بارگذاری فایل")}
        className="ui-file-input"
        type="file"
        accept={accept}
        disabled={disabled}
        tabIndex={-1}
        onChange={(event) => {
          selectFile(event.target.files);
          event.target.value = "";
        }}
      />
      <input
        ref={cameraRef}
        className="ui-file-input"
        type="file"
        accept="image/*"
        capture="environment"
        disabled={disabled}
        tabIndex={-1}
        aria-label={t("Take photo", "گرفتن عکس")}
        onChange={(event) => {
          selectFile(event.target.files);
          event.target.value = "";
        }}
      />
      {fileName ? (
        <div className="ui-file-chip">
          <FileText size={22} strokeWidth={1.5} aria-hidden="true" />
          <div>
            <strong>{fileName}</strong>
            {sizeLabel && <small className="tabular">{sizeLabel}</small>}
          </div>
          {onRemove && (
            <IconButton
              variant="ghost"
              disabled={disabled}
              aria-label={t("Remove file", "حذف فایل")}
              onClick={onRemove}
            >
              <X size={18} strokeWidth={1.5} />
            </IconButton>
          )}
        </div>
      ) : (
        <>
          <span className="ui-upload-icon">
            <Upload size={24} strokeWidth={1.5} aria-hidden="true" />
          </span>
          <p>
            {t(
              "Drop a PDF or photo here, or browse",
              "یک PDF یا عکس را اینجا رها کنید، یا فایل را انتخاب کنید",
            )}
          </p>
        </>
      )}
      <div className="ui-dropzone-actions">
        <Button
          variant="secondary"
          size="sm"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          {t("Browse", "انتخاب فایل")}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="ui-camera-action"
          disabled={disabled}
          onClick={() => cameraRef.current?.click()}
        >
          <Camera size={16} strokeWidth={1.5} aria-hidden="true" />
          {t("Take photo", "گرفتن عکس")}
        </Button>
      </div>
    </div>
  );
}

export function IconButton({
  className,
  title,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  "aria-label": string;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "default" | "sm";
}) {
  return (
    <Button
      {...props}
      variant={props.variant ?? "secondary"}
      className={cn("ui-icon-button", className)}
      title={title ?? props["aria-label"]}
    />
  );
}

const MenuContext = createContext<(() => void) | null>(null);
export function Menu({
  label,
  icon,
  children,
  className,
  ...props
}: {
  label: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
}) {
  const {
    open: popupOpen,
    show: showPopup,
    close: closePopup,
    position: popupPosition,
    portalTarget,
    triggerRef,
    popupRef,
  } = usePopover();
  const menuId = useId();
  const focusItem = (edge: "first" | "last") =>
    requestAnimationFrame(() => {
      const items = popupRef.current?.querySelectorAll<HTMLButtonElement>(
        '[role="menuitem"]:not(:disabled)',
      );
      (edge === "last" ? items?.[items.length - 1] : items?.[0])?.focus();
    });
  const show = (edge: "first" | "last" = "first") => {
    showPopup();
    focusItem(edge);
  };
  return (
    <>
      <button
        {...props}
        ref={triggerRef}
        type="button"
        className={cn("ui-menu-trigger", className)}
        aria-haspopup="menu"
        aria-expanded={popupOpen}
        aria-controls={menuId}
        onClick={() => (popupOpen ? closePopup() : show())}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            show(event.key === "ArrowUp" ? "last" : "first");
          } else if (event.key === "Escape") closePopup(true);
        }}
      >
        {icon ?? null}
        {label}
        {!icon && (
          <ChevronDown size={16} strokeWidth={1.5} aria-hidden="true" />
        )}
      </button>
      {popupOpen &&
        createPortal(
          <MenuContext.Provider value={() => closePopup(true)}>
            <div
              ref={popupRef}
              id={menuId}
              role="menu"
              aria-label={
                props["aria-label"] ??
                (typeof label === "string" ? label : undefined)
              }
              className="ui-popover ui-menu-popover"
              style={popupPosition}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  event.stopPropagation();
                  closePopup(true);
                } else if (
                  ["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key) &&
                  !(event.target instanceof HTMLInputElement)
                ) {
                  event.preventDefault();
                  const items = Array.from(
                    event.currentTarget.querySelectorAll<HTMLButtonElement>(
                      '[role="menuitem"]:not(:disabled)',
                    ),
                  );
                  const current = items.findIndex(
                    (item) => item === document.activeElement,
                  );
                  const index =
                    event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? items.length - 1
                        : (current +
                            (event.key === "ArrowDown" ? 1 : -1) +
                            items.length) %
                          items.length;
                  items[index]?.focus();
                }
              }}
            >
              {children}
            </div>
          </MenuContext.Provider>,
          portalTarget ?? document.body,
        )}
    </>
  );
}
export function MenuItem({
  children,
  onClick,
  disabled,
  className,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const close = useContext(MenuContext);
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      className={cn("ui-menu-item", className)}
      onClick={() => {
        onClick();
        close?.();
      }}
    >
      {children}
    </button>
  );
}

export function SummaryTile({
  label,
  value,
  tone = "lavender",
  className,
}: {
  label: string;
  value: ReactNode;
  tone?: "lavender" | "sky";
  className?: string;
}) {
  return (
    <div className={cn("ui-summary-tile", `ui-tile-${tone}`, className)}>
      <span>{label}</span>
      <strong className="tabular">{value}</strong>
    </div>
  );
}
export function Avatar({
  name,
  small = false,
}: {
  name: string;
  small?: boolean;
}) {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => Array.from(part)[0])
    .join("")
    .toLocaleUpperCase();
  return (
    <span
      className={cn("ui-avatar", { "ui-avatar-small": small })}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

type SegmentedProps = {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  "aria-label"?: string;
  className?: string;
};
function Segments({
  value,
  onChange,
  options,
  className,
  tabs,
  ...props
}: SegmentedProps & { tabs: boolean }) {
  return (
    <div
      {...props}
      role={tabs ? "tablist" : "group"}
      className={cn("ui-segments", className)}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role={tabs ? "tab" : undefined}
          aria-selected={tabs ? value === option.value : undefined}
          aria-pressed={tabs ? undefined : value === option.value}
          disabled={option.disabled}
          tabIndex={tabs && option.value !== value ? -1 : 0}
          onClick={() => onChange(option.value)}
          onKeyDown={(event) => {
            if (
              ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
            ) {
              event.preventDefault();
              const enabled = options.filter((item) => !item.disabled);
              const index = enabled.findIndex(
                (item) => item.value === option.value,
              );
              const rtl =
                event.currentTarget.closest('[dir="rtl"]') !== null ||
                document.documentElement.dir === "rtl";
              const offset =
                event.key === "ArrowRight" ? (rtl ? -1 : 1) : rtl ? 1 : -1;
              const next =
                event.key === "Home"
                  ? enabled[0]
                  : event.key === "End"
                    ? enabled.at(-1)
                    : enabled[
                        (index + offset + enabled.length) % enabled.length
                      ];
              if (next) {
                onChange(next.value);
                const buttons = Array.from(
                  event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
                    "button",
                  ) ?? [],
                );
                buttons[options.indexOf(next)]?.focus();
              }
            }
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
export function SegmentedControl(props: SegmentedProps) {
  return <Segments {...props} tabs={false} />;
}
export function Tabs(props: SegmentedProps) {
  return <Segments {...props} tabs />;
}

export function KpiCard({
  label,
  value,
  breakdown,
  icon,
  tone = "accent",
  onClick,
}: {
  label: string;
  value: ReactNode;
  breakdown?: string;
  icon?: ReactNode;
  tone?: "accent" | "charcoal";
  onClick?: () => void;
}) {
  const content = (
    <>
      <span className="ui-kpi-label">{label}</span>
      <span className="ui-kpi-number tabular">{value}</span>
      {breakdown && <span className="ui-kpi-breakdown">{breakdown}</span>}
      <span className="ui-kpi-icon" aria-hidden="true">
        {icon ?? <ArrowUpRight size={20} strokeWidth={1.5} />}
      </span>
    </>
  );
  return onClick ? (
    <button
      type="button"
      className={cn("ui-kpi", `ui-kpi-${tone}`)}
      onClick={onClick}
    >
      {content}
    </button>
  ) : (
    <div className={cn("ui-kpi", `ui-kpi-${tone}`)}>{content}</div>
  );
}

export function Toast({ children }: { children: ReactNode }) {
  return (
    <div role="status" className="ui-toast">
      {children}
    </div>
  );
}
