import {
  useEffect,
  useLayoutEffect,
  useState,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { X } from "lucide-react";
import {
  LiveInvoiceReadingService,
  liveReadingIdentity,
} from "./live-invoice-reading-service";
import { useNavigationIntent } from "./use-navigation-intent";
import { deferTimesheetNavigation } from "./screens/timesheet-save-context";
import { useDemo } from "./store";
import { Button, IconButton } from "./ui";
import "./live-reading-ready.css";
import { useFloatingFeedbackOffset } from "./use-floating-feedback-offset";

import { LiveReadingContext } from "./live-invoice-reading-context";
/** Mounted outside App's routed/authenticated page subtree, once per application. */
export function LiveInvoiceReadingProvider({
  children,
}: {
  children: ReactNode;
}) {
  const demo = useDemo();
  const [service] = useState(() => new LiveInvoiceReadingService(demo));
  useLayoutEffect(() => {
    service.setPorts(demo);
  }, [demo, service]);
  useEffect(() => () => service.dispose(), [service]);
  return (
    <LiveReadingContext.Provider value={service}>
      {children}
      <ReadyReadings service={service} />
    </LiveReadingContext.Provider>
  );
}
function ReadyReadings({ service }: { service: LiveInvoiceReadingService }) {
  const { t, actor } = useDemo();
  const regionRef = useRef<HTMLDivElement>(null);
  const acceptedHash = useRef(window.location.hash);
  useFloatingFeedbackOffset(
    regionRef,
    "--live-reading-footer-offset",
    ".undo-toast-stack",
  );
  const captureIntent = useNavigationIntent(
    JSON.stringify([liveReadingIdentity(actor), actor?.selection]),
  );
  useEffect(() => {
    const accepted = (event: HashChangeEvent) => {
      if (deferTimesheetNavigation(event)) return;
      acceptedHash.current = window.location.hash;
      service.acceptNavigation(acceptedHash.current);
    };
    window.addEventListener("hashchange", accepted);
    return () => window.removeEventListener("hashchange", accepted);
  }, [service]);
  const notices = useSyncExternalStore(
    service.subscribe,
    service.readyReadings,
    service.readyReadings,
  );
  useLayoutEffect(() => {
    // Completion on the already accepted invoice route needs no Open notice.
    // A pending Timesheets navigation can change the raw hash before its save
    // is accepted; only acknowledge when both route witnesses still agree.
    if (window.location.hash === acceptedHash.current)
      service.acceptNavigation(acceptedHash.current);
  }, [notices, service]);
  return (
    <div
      ref={regionRef}
      className="live-reading-ready-region"
      aria-live="polite"
      aria-relevant="additions text"
    >
      {notices.map((notice) => (
        <div
          className="live-reading-ready"
          role="status"
          key={notice.attemptId}
          data-testid="live-reading-ready"
        >
          <span>
            {t("Invoice", "فاکتور")} <bdi dir="ltr">{notice.reference}</bdi>{" "}
            {t("is ready to review", "آمادهٔ بررسی است")}
          </span>
          <Button
            variant="plain"
            onClick={() => void service.openReady(notice, captureIntent())}
          >
            {t("Open", "باز کردن")}
          </Button>
          <IconButton
            variant="ghost"
            aria-label={t("Dismiss", "بستن")}
            onClick={() => service.dismissReady(notice.attemptId)}
          >
            <X size={18} aria-hidden="true" />
          </IconButton>
        </div>
      ))}
    </div>
  );
}
