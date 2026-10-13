import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Badge } from "./ui";

afterEach(cleanup);

describe("C8 requested status stays the same tone in both languages", () => {
  it.each(["Requested", "درخواست‌شده"])(
    "shows the %s in-progress status in blue even when its caller supplies pending",
    (label) => {
      render(<Badge tone="pending">{label}</Badge>);
      const status = screen.getByText(label);
      expect(status).toHaveClass("info");
      expect(status).not.toHaveClass("pending");
    },
  );

  it.each(["Sale requested", "حراج درخواست‌شده"])(
    "keeps the compound %s price request amber beside the approved charge",
    (label) => {
      render(
        <Badge tone="pending">
          {label} <bdi>$7.99</bdi>
        </Badge>,
      );
      const requestedPrice = screen.getByText("$7.99").closest(".ui-badge");
      expect(requestedPrice).toHaveClass("pending");
      expect(requestedPrice).not.toHaveClass("info");
      expect(screen.getByText("$7.99")).toBeVisible();
    },
  );
});
