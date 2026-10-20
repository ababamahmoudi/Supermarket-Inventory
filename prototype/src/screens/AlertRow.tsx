import {
  useId,
  useState,
  type ComponentProps,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "../ui";

type Tone = ComponentProps<typeof Badge>["tone"];

/**
 * One alert in the single Alerts list: product, short summary and category on
 * one line. With details it opens on click; with an href it links away.
 */
export function AlertRow({
  title,
  summary,
  category,
  categoryTone,
  status,
  href,
  defaultOpen = false,
  children,
  className,
  ...rest
}: Omit<HTMLAttributes<HTMLDivElement>, "title"> & {
  title: ReactNode;
  summary?: ReactNode;
  category: string;
  categoryTone?: Tone;
  status?: ReactNode;
  href?: string;
  defaultOpen?: boolean;
  "data-sale-alert-id"?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  const head = (
    <>
      <span className="alert-row-main">
        <span className="alert-row-title">{title}</span>
        {summary && (
          <small className="muted alert-row-summary">{summary}</small>
        )}
      </span>
      <span className="alert-row-tags">
        <Badge tone={categoryTone}>{category}</Badge>
        {status}
      </span>
      {href ? (
        <ChevronRight
          className="directional alert-row-chevron"
          size={20}
          aria-hidden="true"
        />
      ) : (
        <ChevronDown
          className="alert-row-chevron"
          size={20}
          aria-hidden="true"
        />
      )}
    </>
  );
  return (
    <div
      {...rest}
      className={`list-box alert-row${className ? ` ${className}` : ""}`}
    >
      {href ? (
        <a className="alert-row-head" href={href}>
          {head}
        </a>
      ) : (
        <button
          type="button"
          className="alert-row-head"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((current) => !current)}
        >
          {head}
        </button>
      )}
      {!href && open && (
        <div id={panelId} className="alert-row-details">
          {children}
        </div>
      )}
    </div>
  );
}
