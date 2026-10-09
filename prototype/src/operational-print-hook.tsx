import { useEffect, useState, type ReactNode } from "react";
import { createPortal, flushSync } from "react-dom";
import "./operational-print.css";

export function useOperationalPrint() {
  const [document, setDocument] = useState<ReactNode>(null);
  const clearPrint = () => setDocument(null);
  useEffect(() => {
    window.addEventListener("afterprint", clearPrint);
    return () => window.removeEventListener("afterprint", clearPrint);
  }, []);
  const printDocument = (content: ReactNode) => {
    flushSync(() => setDocument(content));
    window.print();
  };
  return {
    printDocument,
    clearPrint,
    printOutput: document
      ? createPortal(
          <div className="operational-print-output">{document}</div>,
          window.document.body,
        )
      : null,
  };
}
