import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { Badge } from "./ui";

it.each(["Taxable", "مشمول مالیات"])(
  "keeps tax fact %s neutral and visually distinct from an offer",
  (copy) => {
    render(
      <>
        <Badge tone="neutral">{copy}</Badge>
        <Badge tone="info" className="offer-pill">
          2 for $5.00
        </Badge>
      </>,
    );
    expect(screen.getByText(copy)).toHaveClass("neutral");
    expect(screen.getByText(copy)).not.toHaveClass("info");
    expect(screen.getByText("2 for $5.00")).toHaveClass("info", "offer-pill");
  },
);
