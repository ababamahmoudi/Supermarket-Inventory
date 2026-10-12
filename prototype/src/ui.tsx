import {
  useEffect,
  useLayoutEffect,
  useId,
  useRef,
  useState,
  createContext,
  useContext,
  Children,
  Fragment,
  cloneElement,
  isValidElement,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type AnchorHTMLAttributes,
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
  Columns3,
} from "lucide-react";
import { useDemo } from "./store";
import { translate } from "./i18n";
import {
  allocateTableColumns,
  tableResponsiveDefinition,
  type ResponsiveColumn,
} from "./c6-table-layout";
import {
  defaultHiddenColumns,
  normaliseHiddenColumns,
  readTableColumns,
  resetTableColumns,
  saveTableColumns,
  tablePreferenceKey,
  type TableColumnDefinition,
} from "./c3-column-preferences";
import "./controls.css";
import "./c3-components.css";

export function cn(...values: ClassValue[]) {
  return twMerge(clsx(values));
}
const buttonVariants = cva("button", {
  variants: {
    variant: {
      primary: "button-primary",
      secondary: "button-secondary",
      tinted: "button-tinted",
      neutral: "button-neutral",
      plain: "button-plain",
      destructive: "button-destructive",
      danger: "button-danger",
      quiet: "button-quiet",
      ghost: "button-quiet button-ghost",
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
  variant?:
    | "primary"
    | "secondary"
    | "tinted"
    | "neutral"
    | "plain"
    | "destructive"
    | "danger"
    | "quiet"
    | "ghost";
  size?: "default" | "sm";
  asChild?: boolean;
}) {
  const Component = asChild ? Slot : "button";
  return (
    <Component
      className={cn("ui-button", buttonVariants({ variant, size }), className)}
      data-control-kind="action"
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

/** Route navigation remains separate from a row's hidden-column disclosure. */
export function TableRowLink({
  className,
  children,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { "aria-label": string }) {
  return (
    <a {...props} className={cn("table-row-link", className)}>
      {children ?? (
        <ChevronRight
          className="directional"
          size={20}
          strokeWidth={1.5}
          aria-hidden="true"
        />
      )}
    </a>
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
        "waiting for credit",
        "pending credit",
        "back-ordered",
        "expiring soon",
        "still pending",
        "در انتظار",
        "در انتظار تأمین‌کننده",
        "در انتظار اعتبار",
        "در انتظار بستانکاری",
        "اعتبار در انتظار",
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
        "received",
        "closed",
        "credited",
        "replaced",
        "تأییدشده",
        "ثبت‌شده",
        "فعال",
        "حل‌شده",
        "رسیدگی‌شده",
        "تحویل گرفته‌شده",
        "جمع‌آوری‌شده",
        "دریافت‌شده",
        "بسته‌شده",
        "اعتبار دریافت‌شده",
        "جایگزین‌شده",
      ],
    ],
    [
      "info",
      [
        "open",
        "waiting for pickup",
        "new product",
        "price change",
        "intentional",
        "manual price",
        "ordered",
        "requested",
        "sent",
        "باز",
        "در انتظار جمع‌آوری",
        "کالای جدید",
        "تغییر قیمت",
        "عمدی",
        "قیمت دستی",
      ],
    ],
    [
      "neutral",
      [
        "taxable",
        "مشمول مالیات",
        "draft",
        "cancelled",
        "rejected",
        "archived",
        "cleared",
        "stopped",
        "written off",
        "پیش‌نویس",
        "لغوشده",
        "ردشده",
        "بایگانی‌شده",
        "پاک‌شده",
        "متوقف‌شده",
        "سوخت‌شده",
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
        "missing",
        "tax discrepancy",
        "کسری",
        "تعارض",
        "منقضی",
        "منقضی‌شده",
        "سررسید گذشته",
        "ناموفق",
        "ناقص",
        "مفقود",
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
        "aria-invalid"?: boolean | "true" | "false" | "grammar" | "spelling";
      }>)
    : null;
  const id = child?.props.id ?? generated;
  const labelId = `${id}-label`;
  const descriptionId = `${id}-help`;
  const optional = label.match(/^(.*?)\s+(\((?:optional|اختیاری)\))$/);
  return (
    <div className={cn("field", className)}>
      <label id={labelId} htmlFor={id}>
        {optional ? (
          <>
            {optional[1]} <span className="field-optional">{optional[2]}</span>
          </>
        ) : (
          label
        )}
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
            "aria-invalid": error
              ? true
              : (child.props["aria-invalid"] ?? false),
          })
        : children}
      {(error || hint) && (
        <p
          id={descriptionId}
          className={error ? "form-error" : "helper"}
          role={error ? "alert" : undefined}
        >
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
  title: ReactNode;
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
  columns,
  responsive = true,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  columns?: ResponsiveColumn[];
  responsive?: boolean;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const [actionWidths, setActionWidths] = useState<Record<string, number>>({});
  const [availableWidth, setAvailableWidth] = useState(0);
  const [mobile, setMobile] = useState(() => window.innerWidth < 760);
  const [expandedRows, setExpandedRows] = useState<string[]>([]);
  const detailsId = useId();
  useEffect(() => {
    const resize = () => setMobile(window.innerWidth < 760);
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  const cells = (nodes: ReactNode, prefix = ""): ReactNode[] =>
    Children.toArray(nodes).flatMap((node, index) =>
      isValidElement<{ children?: ReactNode }>(node) && node.type === Fragment
        ? cells(node.props.children, `${prefix}${index}:`)
        : [
            isValidElement(node)
              ? cloneElement(node, { key: `${prefix}${index}` })
              : node,
          ],
    );
  const headerSection = Children.toArray(children).find(
    (node) => isValidElement(node) && node.type === "thead",
  );
  const headerRow = isValidElement<{ children?: ReactNode }>(headerSection)
    ? Children.toArray(headerSection.props.children).find(
        (node) => isValidElement(node) && node.type === "tr",
      )
    : undefined;
  const textOf = (node: ReactNode): string => {
    if (typeof node === "string" || typeof node === "number")
      return String(node);
    if (Array.isArray(node)) return node.map(textOf).join(" ");
    if (isValidElement<{ children?: ReactNode }>(node))
      return textOf(node.props.children);
    return "";
  };
  const headerCells = isValidElement<{ children?: ReactNode }>(headerRow)
    ? cells(headerRow.props.children)
    : [];
  const declaredColumns: ResponsiveColumn[] =
    columns ??
    (isValidElement<{ children?: ReactNode }>(headerRow)
      ? cells(headerRow.props.children).map((cell) => {
          const numeric =
            isValidElement<{ className?: string }>(cell) &&
            /numeric|number-cell/.test(cell.props.className ?? "");
          const label = isValidElement<{ children?: ReactNode }>(cell)
            ? cell.props.children
            : undefined;
          const actions =
            typeof label === "string" &&
            ["Action", "Actions", "عملیات", "اقدام"].includes(label);
          return {
            label: textOf(label),
            width: actions ? 120 : numeric ? 140 : undefined,
            align: numeric || actions ? ("end" as const) : ("start" as const),
            actions,
            key: undefined as string | undefined,
            hidden: false,
          };
        })
      : []);
  const resolvedColumns = declaredColumns.map((column) =>
    window.innerWidth >= 1440 &&
    !column.actions &&
    /^(name|product|supplier)$/.test(column.key ?? "")
      ? { ...column, minWidth: Math.max(240, column.minWidth ?? 0) }
      : column,
  );
  const layout = responsive
    ? allocateTableColumns(
        resolvedColumns,
        availableWidth,
        mobile,
        resolvedColumns.map((column, index) =>
          column.actions ? (actionWidths[column.key ?? String(index)] ?? 0) : 0,
        ),
      )
    : {
        visible: resolvedColumns.flatMap((column, index) =>
          column.hidden ? [] : [index],
        ),
        collapsed: [],
        minimums: resolvedColumns.map(() => 0),
      };
  const visibleIndexes = new Set(layout.visible);
  const visibleColumns = layout.visible.map((index) => resolvedColumns[index]);
  const endActionsIndex = layout.visible
    .filter((index) => resolvedColumns[index].actions)
    .at(-1);
  const separateDetailsColumn =
    responsive && layout.collapsed.length > 0 && endActionsIndex === undefined;
  const separateDetailsWidth = separateDetailsColumn ? 36 : 0;
  const flexibleMinimum = layout.visible.reduce(
    (total, index) =>
      total + (resolvedColumns[index].actions ? 0 : layout.minimums[index]),
    0,
  );
  const columnWeight = (column: (typeof resolvedColumns)[number]): number => {
    if (typeof column.width === "number") return Math.max(1, column.width);
    if (column.width?.endsWith("%"))
      return Math.max(1, parseFloat(column.width) * 10);
    if (column.width && /^\d+(?:\.\d+)?(?:px)?$/.test(column.width))
      return Math.max(1, parseFloat(column.width));
    return column.actions ? 120 : column.align === "end" ? 112 : 220;
  };
  const totalWeight = visibleColumns.reduce(
    (total, column) => total + columnWeight(column),
    0,
  );
  const columnId = (column: (typeof resolvedColumns)[number]) =>
    column.key ?? String(resolvedColumns.indexOf(column));
  const fixedActionWidth = visibleColumns.reduce(
    (total, column) =>
      total +
      (column.actions
        ? (actionWidths[columnId(column)] ?? columnWeight(column))
        : 0),
    0,
  );
  const flexibleWeight = visibleColumns.reduce(
    (total, column) => total + (column.actions ? 0 : columnWeight(column)),
    0,
  );
  // Reserve only the real action controls, including translated labels. Chromium
  // ignores mixed percentage/pixel calc widths on table columns, so distribute
  // the remaining measured space as plain pixel widths. Measure the wrapper,
  // rather than the table's previous column widths, so shrinking can reflow.
  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    const table = tableRef.current;
    if (!wrapper || !table || !visibleColumns.length) return;
    let active = true;
    const measured = new Set<HTMLElement>();
    const measure = () => {
      if (!active) return;
      const wrapperStyle = getComputedStyle(wrapper);
      const wrapperInsets = [
        wrapperStyle.borderInlineStartWidth,
        wrapperStyle.borderInlineEndWidth,
        wrapperStyle.paddingInlineStart,
        wrapperStyle.paddingInlineEnd,
      ].reduce((total, value) => total + (parseFloat(value) || 0), 0);
      const width = Math.max(
        0,
        wrapper.getBoundingClientRect().width - wrapperInsets,
      );
      setAvailableWidth((previous) =>
        Math.abs(previous - width) < 0.01 ? previous : width,
      );
      const next: Record<string, number> = {};
      visibleColumns.forEach((column, index) => {
        if (!column.actions) return;
        let width = 40;
        for (const row of Array.from(table.rows)) {
          const cell = row.cells[index];
          if (!cell || cell.colSpan > 1) continue;
          const cellStyle = getComputedStyle(cell);
          const padding =
            parseFloat(cellStyle.paddingInlineStart || "0") +
            parseFloat(cellStyle.paddingInlineEnd || "0");
          if (cell.tagName === "TH") {
            const range = document.createRange();
            range.selectNodeContents(cell);
            width = Math.max(
              width,
              (typeof range.getBoundingClientRect === "function"
                ? range.getBoundingClientRect().width
                : 0) + padding,
            );
            continue;
          }
          const group =
            cell.querySelector<HTMLElement>(":scope > .actions") ?? cell;
          const controls = Array.from(
            group.querySelectorAll<HTMLElement>(
              ":scope > .ui-button, :scope > .ui-menu-trigger, :scope > .table-row-link, :scope > .product-row-menu-placeholder",
            ),
          );
          if (!controls.length) continue;
          const gap = parseFloat(getComputedStyle(group).columnGap || "0") || 0;
          const controlsWidth = controls.reduce(
            (total, control) => total + control.getBoundingClientRect().width,
            0,
          );
          width = Math.max(
            width,
            controlsWidth + gap * (controls.length - 1) + padding,
          );
          for (const control of controls) measured.add(control);
        }
        next[columnId(column)] = Math.ceil(width);
      });
      setActionWidths((previous) =>
        Object.keys(next).length === Object.keys(previous).length &&
        Object.entries(next).every(([key, value]) => previous[key] === value)
          ? previous
          : next,
      );
    };
    measure();
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(measure);
    observer?.observe(wrapper);
    observer?.observe(table);
    for (const element of measured) observer?.observe(element);
    void document.fonts?.ready.then(measure);
    return () => {
      active = false;
      observer?.disconnect();
    };
  });
  const decorate = (nodes: ReactNode, path = "table"): ReactNode =>
    Children.map(nodes, (node, nodeIndex) => {
      if (
        !isValidElement<{
          children?: ReactNode;
          className?: string;
          style?: CSSProperties;
          colSpan?: number;
        }>(node)
      )
        return node;
      if (node.type === "tr") {
        const navigation = node as ReactElement<
          HTMLAttributes<HTMLTableRowElement> & { "data-row-href"?: string }
        >;
        const href = navigation.props["data-row-href"];
        let columnIndex = 0;
        const rowKey = String(node.key ?? `${path}-${nodeIndex}`);
        const rowCells = cells(node.props.children);
        const bodyRow = rowCells.some(
          (cell) => isValidElement(cell) && cell.type === "td",
        );
        const fullRow = rowCells.some(
          (cell) =>
            isValidElement<{ colSpan?: number }>(cell) &&
            (cell.props.colSpan ?? 1) > 1,
        );
        const canExpand =
          responsive && bodyRow && !fullRow && layout.collapsed.length > 0;
        const expanded = expandedRows.includes(rowKey);
        const rowId = `${detailsId}-${encodeURIComponent(rowKey)}`;
        const disclosure = canExpand ? (
          <IconButton
            className="table-details-toggle"
            aria-label={
              expanded
                ? translate("Hide details", "پنهان کردن جزئیات")
                : translate("Show details", "نمایش جزئیات")
            }
            aria-expanded={expanded}
            aria-controls={rowId}
            onClick={(event) => {
              event.stopPropagation();
              setExpandedRows((previous) =>
                expanded
                  ? previous.filter((key) => key !== rowKey)
                  : [...previous, rowKey],
              );
            }}
          >
            <ChevronDown size={16} aria-hidden="true" />
          </IconButton>
        ) : null;
        const decoratedRow = cloneElement(node, {
          ...(href
            ? {
                className: cn(node.props.className, "is-navigable"),
                tabIndex: 0,
                onClick: (event: React.MouseEvent<HTMLTableRowElement>) => {
                  navigation.props.onClick?.(event);
                  if (
                    !event.defaultPrevented &&
                    event.target instanceof Element &&
                    !event.target.closest(
                      "a,button,input,textarea,select,[role='checkbox'],[role='combobox']",
                    )
                  )
                    window.location.hash = href;
                },
                onKeyDown: (event: KeyboardEvent<HTMLTableRowElement>) => {
                  navigation.props.onKeyDown?.(event);
                  if (
                    !event.defaultPrevented &&
                    event.target === event.currentTarget &&
                    ["Enter", " "].includes(event.key)
                  ) {
                    event.preventDefault();
                    window.location.hash = href;
                  }
                },
              }
            : {}),
          children: (
            <>
              {Children.map(cells(node.props.children), (cell) => {
                if (
                  !isValidElement<{
                    className?: string;
                    style?: CSSProperties;
                    colSpan?: number;
                    "data-column-key"?: string;
                    "data-column-label"?: string;
                  }>(cell)
                )
                  return cell;
                const originalIndex = columnIndex;
                const span = cell.props.colSpan ?? 1;
                columnIndex += span;
                const covered = resolvedColumns
                  .slice(originalIndex, originalIndex + span)
                  .filter((_, index) =>
                    visibleIndexes.has(originalIndex + index),
                  );
                if (resolvedColumns.length && !covered.length) return null;
                const column = covered[0];
                if (!column) return cell;
                const endActions =
                  canExpand && originalIndex === endActionsIndex;
                const content = isValidElement<{ children?: ReactNode }>(cell)
                  ? cell.props.children
                  : undefined;
                return cloneElement(cell, {
                  colSpan: span > 1 ? covered.length : cell.props.colSpan,
                  "data-column-key": column.key,
                  "data-column-label":
                    column.label || textOf(headerCells[originalIndex]),
                  className: cn(
                    cell.props.className,
                    column.align === "end" && "numeric",
                    column.actions && "table-actions",
                  ),
                  style: {
                    ...cell.props.style,
                    textAlign: column.actions
                      ? "end"
                      : (column.align ?? "start"),
                  },
                  ...(endActions
                    ? {
                        children:
                          isValidElement<{
                            className?: string;
                            children?: ReactNode;
                          }>(content) &&
                          content.props.className
                            ?.split(" ")
                            .includes("actions") ? (
                            cloneElement(content, {
                              children: (
                                <>
                                  {content.props.children}
                                  {disclosure}
                                </>
                              ),
                            })
                          ) : (
                            <div className="actions table-end-controls">
                              {content}
                              {disclosure}
                            </div>
                          ),
                      }
                    : {}),
                });
              })}
              {separateDetailsColumn &&
                !fullRow &&
                (bodyRow ? (
                  <td
                    className="table-actions table-disclosure-cell"
                    data-column-label={translate("Details", "جزئیات")}
                  >
                    {disclosure}
                  </td>
                ) : (
                  <th
                    className="table-actions table-disclosure-cell"
                    aria-label={translate("Details", "جزئیات")}
                  />
                ))}
            </>
          ),
        });
        return canExpand ? (
          <Fragment key={rowKey}>
            {decoratedRow}
            {expanded && (
              <tr className="table-expanded-row" id={rowId}>
                <td
                  colSpan={
                    visibleColumns.length + (separateDetailsColumn ? 1 : 0)
                  }
                >
                  <dl>
                    {layout.collapsed.map((index) => {
                      const cell = rowCells[index];
                      return isValidElement<{ children?: ReactNode }>(cell) ? (
                        <div key={resolvedColumns[index].key ?? index}>
                          <dt>
                            {resolvedColumns[index].label ||
                              textOf(headerCells[index])}
                          </dt>
                          <dd>{cell.props.children}</dd>
                        </div>
                      ) : null;
                    })}
                  </dl>
                </td>
              </tr>
            )}
          </Fragment>
        ) : (
          decoratedRow
        );
      }
      return cloneElement(node, {
        children: decorate(node.props.children, `${path}-${nodeIndex}`),
      });
    });
  return (
    <div
      ref={wrapperRef}
      className={cn(
        "table-wrap",
        "ui-data-table",
        responsive && "is-responsive",
        mobile && "is-mobile",
        className,
      )}
      tabIndex={0}
      data-visible-column-count={visibleColumns.length}
      data-width-hidden-column-count={
        layout.collapsed.filter((index) => !resolvedColumns[index].hidden)
          .length
      }
      {...props}
    >
      <table
        ref={tableRef}
        className="has-defined-columns"
        data-visible-column-count={visibleColumns.length}
        style={
          {
            "--table-min-width": `${Math.ceil((flexibleWeight + fixedActionWidth || totalWeight) + separateDetailsWidth)}px`,
          } as CSSProperties
        }
      >
        <colgroup>
          {visibleColumns.map((column, index) => (
            <col
              key={column.key ?? index}
              data-action-column={column.actions || undefined}
              style={{
                width: column.actions
                  ? `${actionWidths[columnId(column)] ?? columnWeight(column)}px`
                  : responsive && availableWidth
                    ? `${layout.minimums[layout.visible[index]] + (Math.max(0, availableWidth - fixedActionWidth - separateDetailsWidth - flexibleMinimum) * columnWeight(column)) / Math.max(1, flexibleWeight)}px`
                    : flexibleWeight
                      ? availableWidth
                        ? `${(Math.max(0, availableWidth - fixedActionWidth) * columnWeight(column)) / flexibleWeight}px`
                        : `${(columnWeight(column) / totalWeight) * 100}%`
                      : undefined,
              }}
            />
          ))}
          {separateDetailsColumn && (
            <col
              style={{ width: `${separateDetailsWidth}px` }}
              data-action-column="true"
            />
          )}
        </colgroup>
        {decorate(children)}
      </table>
    </div>
  );
}
export function useTableColumns(
  table: string,
  definitions: readonly TableColumnDefinition[],
) {
  const { state, user } = useDemo();
  const scope = {
    company: state.config.company.seed_key,
    user: user?.username ?? "signed-out",
    table,
  };
  const key = tablePreferenceKey(scope);
  let storage: Storage | undefined;
  try {
    storage = window.localStorage;
  } catch {
    // Presentation preferences do not block the table in restricted browsers.
  }
  const [preference, setPreference] = useState(() => ({
    key,
    hidden: readTableColumns(storage, scope, definitions),
  }));
  const hidden = normaliseHiddenColumns(
    definitions,
    preference.key === key
      ? preference.hidden
      : readTableColumns(storage, scope, definitions),
  );
  const isVisible = (column: string) => !hidden.includes(column);
  const change = (column: string, visible: boolean) => {
    const next = normaliseHiddenColumns(
      definitions,
      visible ? hidden.filter((item) => item !== column) : [...hidden, column],
    );
    saveTableColumns(storage, scope, definitions, next);
    setPreference({ key, hidden: next });
  };
  const reset = () => {
    resetTableColumns(storage, scope);
    setPreference({ key, hidden: defaultHiddenColumns(definitions) });
  };
  return {
    columns: definitions.map((column, index) => ({
      ...tableResponsiveDefinition(table, column, index),
      hidden: !isVisible(column.key),
    })),
    isVisible,
    chooser: (
      <ColumnChooser
        columns={definitions}
        isVisible={isVisible}
        onChange={change}
        onReset={reset}
      />
    ),
  };
}

export function ColumnChooser({
  columns,
  isVisible,
  onChange,
  onReset,
}: {
  columns: readonly TableColumnDefinition[];
  isVisible: (key: string) => boolean;
  onChange: (key: string, visible: boolean) => void;
  onReset: () => void;
}) {
  const { t } = useDemo();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="neutral" onClick={() => setOpen(true)}>
        <Columns3 size={18} strokeWidth={1.5} aria-hidden="true" />
        {t("Columns", "ستون‌ها")}
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={t("Columns", "ستون‌ها")}
        className="c3-column-dialog"
      >
        <div className="c3-column-options">
          {columns.map((column, index) => (
            <Checkbox
              key={column.key}
              checked={isVisible(column.key)}
              disabled={index === 0 || column.required}
              onChange={(visible) => onChange(column.key, visible)}
            >
              {column.label}
            </Checkbox>
          ))}
        </div>
        <div className="actions c3-dialog-actions">
          <Button variant="neutral" onClick={onReset}>
            {t("Reset columns", "بازنشانی ستون‌ها")}
          </Button>
          <Button variant="neutral" onClick={() => setOpen(false)}>
            {t("Close", "بستن")}
          </Button>
        </div>
      </Dialog>
    </>
  );
}

export function FilterToolbar({
  children,
  search,
  count,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { search?: ReactNode; count?: ReactNode }) {
  return (
    <div className={cn("filter-toolbar", className)} {...props}>
      {isValidElement(search) && search.type === "input" ? (
        <div className="filter-search-pill">
          <Search size={18} strokeWidth={1.5} aria-hidden="true" />
          {search}
        </div>
      ) : (
        search
      )}
      {children}
      {count !== undefined && <span className="filter-count">{count}</span>}
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
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      trigger.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      dialog.showModal();
      (
        dialog.querySelector<HTMLElement>("[autofocus]") ??
        dialog.querySelector<HTMLElement>(
          "input:not([disabled]), textarea:not([disabled])",
        ) ??
        dialog.querySelector<HTMLElement>(
          "button:not([disabled]), [tabindex='0']",
        )
      )?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
      trigger.current?.focus();
    }
    return () => {
      if (dialog.open) dialog.close();
      trigger.current?.focus();
    };
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={cn("confirm-dialog ui-dialog", className)}
      tabIndex={-1}
      aria-labelledby={open ? titleId : undefined}
      onKeyDown={(event) => {
        if (event.key !== "Tab" || event.defaultPrevented) return;
        const dialog = event.currentTarget;
        const focusable = Array.from(
          dialog.querySelectorAll<HTMLElement>(
            'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
          ),
        ).filter(
          (element) =>
            element.tabIndex >= 0 &&
            !element.closest(
              '[hidden],[inert],[aria-hidden="true"],dialog:not([open])',
            ) &&
            getComputedStyle(element).visibility !== "hidden" &&
            element.getClientRects().length > 0,
        );
        const first = focusable[0];
        const last = focusable.at(-1);
        if (!first || !last) {
          event.preventDefault();
          dialog.focus();
        } else if (
          (event.shiftKey && document.activeElement === first) ||
          (!event.shiftKey && document.activeElement === last) ||
          !dialog.contains(document.activeElement)
        ) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        onOpenChange(false);
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const box = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < box.left ||
          event.clientX > box.right ||
          event.clientY < box.top ||
          event.clientY > box.bottom
        )
          onOpenChange(false);
      }}
    >
      <div className="ui-dialog-header">
        <h2 id={titleId}>{title}</h2>
        <IconButton
          aria-label={translate("Close dialog", "بستن پنجره")}
          onClick={() => onOpenChange(false)}
        >
          <X size={20} aria-hidden="true" />
        </IconButton>
      </div>
      {description && (
        <div className="dialog-description muted">{description}</div>
      )}
      {children}
    </dialog>
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
  confirmVariant = "primary",
  confirmDisabled = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  children?: ReactNode;
  confirmVariant?: "primary" | "secondary" | "danger" | "quiet" | "ghost";
  confirmDisabled?: boolean;
}) {
  const { t } = useDemo();
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
    >
      {children}
      <div className="actions c3-dialog-actions">
        <Button variant="secondary" onClick={() => onOpenChange(false)}>
          {t("Cancel", "انصراف")}
        </Button>
        <Button
          variant={confirmVariant}
          disabled={confirmDisabled}
          onClick={() => {
            onConfirm();
            onOpenChange(false);
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
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
export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
  count?: number;
};

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
  leadingIcon,
  ...attributes
}: ControlAttributes & {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  searchable?: boolean;
  leadingIcon?: ReactNode;
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
        className={cn(
          "ui-select ui-input",
          leadingIcon && "has-leading-icon",
          className,
        )}
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
        {leadingIcon && (
          <span className="select-leading" aria-hidden="true">
            {leadingIcon}
          </span>
        )}
        {options.map((option) => (
          <span
            key={option.value}
            className="select-sizing"
            aria-hidden="true"
            data-sizing-label={option.label}
          />
        ))}
        <span className={selected ? undefined : "muted"}>
          <bdi dir="auto">
            {selected?.label ?? t("Choose an option", "یک گزینه انتخاب کنید")}
          </bdi>
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
                  <span>
                    <bdi dir="auto">{option.label}</bdi>
                  </span>
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
      dir={props.dir ?? "ltr"}
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
  const dateLabel = dateValue;
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
        <bdi dir="ltr" className={value ? "tabular" : "muted"}>
          {value || t("Choose date", "تاریخ را انتخاب کنید")}
        </bdi>
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
                variant="secondary"
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
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => choose("")}
                >
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
              accept.includes("pdf")
                ? "Drop a PDF or photo here, or browse"
                : "Drop a photo here, or browse",
              accept.includes("pdf")
                ? "یک PDF یا عکس را اینجا رها کنید، یا فایل را انتخاب کنید"
                : "یک عکس را اینجا رها کنید، یا فایل را انتخاب کنید",
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
      data-control-kind="icon"
      title={title ?? props["aria-label"]}
    />
  );
}

const MenuContext = createContext<(() => void) | null>(null);
export function Menu({
  label,
  icon,
  showChevron = true,
  iconOnly = false,
  minWidth = 224,
  children,
  className,
  ...props
}: {
  label: ReactNode;
  icon?: ReactNode;
  showChevron?: boolean;
  iconOnly?: boolean;
  minWidth?: number;
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
  } = usePopover(minWidth);
  const menuId = useId();
  const itemsWithin = (menu: HTMLElement | null) =>
    Array.from(
      menu?.querySelectorAll<HTMLButtonElement>(
        '[role="menuitem"]:not(:disabled)',
      ) ?? [],
    ).filter((item) => item.closest('[role="menu"]') === menu);
  const focusItem = (edge: "first" | "last") =>
    requestAnimationFrame(() => {
      const items = itemsWithin(popupRef.current);
      (edge === "last" ? items.at(-1) : items[0])?.focus();
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
        className={cn(
          "ui-button button button-neutral ui-menu-trigger",
          { "ui-icon-button": iconOnly },
          className,
        )}
        data-control-kind={iconOnly ? "icon" : "action"}
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
        {iconOnly && typeof label === "string" ? (
          <span className="sr-only">{label}</span>
        ) : (
          label
        )}
        {showChevron && !icon && !iconOnly && (
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
                  const items = itemsWithin(event.currentTarget);
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
  ...props
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick">) {
  const close = useContext(MenuContext);
  return (
    <button
      {...props}
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

/** A nested menu remains inside its parent popup and returns focus to its own trigger. */
export function MenuSubmenu({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const focusFrame = useRef<number | null>(null);
  const opening = useRef(false);
  const id = useId();
  const cancelFocus = () => {
    if (focusFrame.current !== null) cancelAnimationFrame(focusFrame.current);
    focusFrame.current = null;
  };
  useEffect(
    () => () => {
      opening.current = false;
      if (focusFrame.current !== null) cancelAnimationFrame(focusFrame.current);
    },
    [],
  );
  const openMenu = () => {
    cancelFocus();
    opening.current = true;
    setOpen(true);
    focusFrame.current = requestAnimationFrame(() => {
      focusFrame.current = null;
      if (!opening.current) return;
      menu.current
        ?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')
        ?.focus();
    });
  };
  const close = () => {
    opening.current = false;
    cancelFocus();
    setOpen(false);
    trigger.current?.focus();
  };
  return (
    <div className="ui-menu-submenu">
      <button
        ref={trigger}
        className="ui-menu-item ui-menu-submenu-trigger"
        role="menuitem"
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={(event) => {
          const rtl = document.documentElement.dir === "rtl";
          if (
            open &&
            (event.key === "Escape" ||
              event.key === (rtl ? "ArrowRight" : "ArrowLeft"))
          ) {
            event.preventDefault();
            event.stopPropagation();
            close();
          } else if (event.key === (rtl ? "ArrowLeft" : "ArrowRight")) {
            event.preventDefault();
            event.stopPropagation();
            openMenu();
          }
        }}
      >
        {label}
        <ChevronRight size={16} className="directional" aria-hidden="true" />
      </button>
      {open && (
        <div
          ref={menu}
          id={id}
          role="menu"
          aria-label={label}
          className="ui-submenu-items"
          onKeyDown={(event) => {
            const rtl = document.documentElement.dir === "rtl";
            if (
              event.key === "Escape" ||
              event.key === (rtl ? "ArrowRight" : "ArrowLeft")
            ) {
              event.preventDefault();
              event.stopPropagation();
              close();
            } else if (
              ["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)
            ) {
              event.preventDefault();
              event.stopPropagation();
              const items = Array.from(
                event.currentTarget.querySelectorAll<HTMLButtonElement>(
                  '[role="menuitem"]:not(:disabled)',
                ),
              );
              const current = items.findIndex(
                (item) => item === document.activeElement,
              );
              const next =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? items.length - 1
                    : (current +
                        (event.key === "ArrowDown" ? 1 : -1) +
                        items.length) %
                      items.length;
              items[next]?.focus();
            }
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function DialogActions({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("ui-dialog-actions", className)} {...props} />;
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
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  "aria-label"?: string;
  className?: string;
};
function Segments({
  id,
  value,
  onChange,
  options,
  className,
  tabs,
  ...props
}: SegmentedProps & { tabs: boolean }) {
  return (
    <div
      id={id}
      {...props}
      role={tabs ? "tablist" : "group"}
      className={cn("ui-segments", { "ui-tabs": tabs }, className)}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role={tabs ? "tab" : undefined}
          aria-label={
            option.count && option.count > 0
              ? `${option.label} ${option.count}`
              : undefined
          }
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
          <span>{option.label}</span>
          {option.count !== undefined && option.count > 0 && (
            <span className="tab-count">{option.count}</span>
          )}
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
      {(icon || onClick) && (
        <span className="ui-kpi-icon" aria-hidden="true">
          {icon ?? <ArrowUpRight size={20} strokeWidth={1.5} />}
        </span>
      )}
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
