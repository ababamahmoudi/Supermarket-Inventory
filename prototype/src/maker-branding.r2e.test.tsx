import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { configureBrandHead, createWebManifest } from "../pwa-build";
import { configSeed } from "./config";
import { initialState } from "./e1-bootstrap";
import { signedOutReadView } from "./e1-read-model";
import { MakerAbout, PoweredByMaker, StaffPrintMaker } from "./MakerBrand";
import {
  configuredMaker,
  makerPageTitle,
  synchronizeMakerIcons,
  type MakerConfig,
} from "./maker-branding";
import { OperationalPrintDocument } from "./operational-print";
import TimesheetPrint from "./screens/TimesheetPrint";
import { readTimesheetDayView, readTimesheetWeekView } from "./timesheets";

beforeEach(() => vi.stubEnv("BASE_URL", "/demo/"));
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe("R2e E configured maker presentation", () => {
  it("uses the configured full wordmark for R2g authentication while preserving compact callers", () => {
    const state = initialState();
    const { container, rerender } = render(
      <PoweredByMaker config={state.config} language="en" fullLogo />,
    );
    expect(container.querySelector(".maker-powered-full")).toHaveTextContent(
      "Powered by Klead",
    );
    expect(container.querySelector(".maker-logo-light")).toHaveAttribute(
      "src",
      "/demo/brand/klead/klead-logo.svg",
    );
    expect(container.querySelector(".maker-logo-dark")).toHaveAttribute(
      "src",
      "/demo/brand/klead/klead-logo-white.svg",
    );
    expect(container.querySelector(".maker-logo-space")).not.toHaveClass(
      "is-compact",
    );
    rerender(<PoweredByMaker config={state.config} language="en" />);
    expect(container.querySelector(".maker-logo-light")).toHaveAttribute(
      "src",
      "/demo/brand/klead/klead-mark.svg",
    );
    expect(container.querySelector(".maker-logo-space")).toHaveClass(
      "is-compact",
    );
    state.config.branding = { maker: null };
    rerender(<PoweredByMaker config={state.config} language="en" fullLogo />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the store title and maker without rewriting a saved company's records", () => {
    const state = initialState();
    delete state.config.branding;
    const before = JSON.stringify(state);
    expect(makerPageTitle(state.config, "en")).toBe("Super Arzon · Klead");
    expect(makerPageTitle(state.config, "fa")).toBe("سوپر ارزان · Klead");
    expect(configuredMaker(signedOutReadView(state.config).config)?.name).toBe(
      "Klead",
    );
    expect(JSON.stringify(state)).toBe(before);
  });

  it("uses another company's explicit maker, support, files and store names", () => {
    const state = initialState();
    state.config.company.name_en = "Cedar Market";
    state.config.company.name_fa = "فروشگاه سدر";
    state.config.branding = {
      maker: {
        name: "Cedar Tools",
        logo_file: "brand/cedar/logo.svg",
        logo_dark_file: "brand/cedar/white.svg",
        favicon_file: "brand/cedar/icon.svg",
        icon_192_file: "brand/cedar/192.png",
        icon_512_file: "brand/cedar/512.png",
      },
      maker_support: "help@cedar.example",
    };
    render(
      <MakerAbout
        config={state.config}
        language="fa"
        appName="فروشگاه سدر"
        version="0.2.0"
      />,
    );
    expect(screen.getByRole("heading", { name: "فروشگاه سدر" })).toBeVisible();
    expect(screen.getByText("help@cedar.example")).toBeVisible();
    expect(
      screen
        .getAllByAltText("Cedar Tools")
        .map((item) => item.getAttribute("src")),
    ).toEqual(["/demo/brand/cedar/logo.svg", "/demo/brand/cedar/white.svg"]);
    expect(document.body.textContent).not.toContain("Klead");
    expect(makerPageTitle(state.config, "en")).toBe(
      "Cedar Market · Cedar Tools",
    );
    expect(
      createWebManifest(state.config).icons.map((item) => item.src),
    ).toEqual(["brand/cedar/192.png", "brand/cedar/512.png"]);
  });

  it("never displays the inherited maker's lettering when only its name is replaced", () => {
    const state = initialState();
    state.config.branding!.maker!.name = "Cedar Tools";
    const { container } = render(
      <>
        <PoweredByMaker config={state.config} language="en" />
        <MakerAbout
          config={state.config}
          language="en"
          appName="Cedar Market"
          version="0.2.0"
        />
        <StaffPrintMaker config={state.config} />
      </>,
    );
    expect(container.textContent).toContain("Cedar Tools");
    expect(container.textContent).not.toContain("Klead");
    expect(container.querySelector("img")).toBeNull();
    expect(
      createWebManifest(state.config).icons.map((icon) => icon.src),
    ).toEqual(["icons/company-192.png", "icons/company-512.png"]);
    expect(makerPageTitle(state.config, "en")).toBe(
      "Super Arzon · Cedar Tools",
    );
  });

  it.each([null, { name: "Klead", enabled: false }, { name: " " }])(
    "removes maker identity and support from auth, About, print and title when disabled: %j",
    (maker) => {
      const state = initialState();
      state.config.branding = { maker, maker_support: "hidden@cedar.example" };
      const { container } = render(
        <>
          <PoweredByMaker config={state.config} language="en" />
          <MakerAbout
            config={state.config}
            language="en"
            appName="Cedar Market"
            version="0.2.0"
          />
          <StaffPrintMaker config={state.config} bilingual />
        </>,
      );
      expect(screen.getByText("Cedar Market")).toBeVisible();
      expect(container.textContent).not.toMatch(
        /Klead|Made by|Made with|Powered by|hidden@/,
      );
      expect(container.querySelector("img")).toBeNull();
      expect(container.querySelector("footer")).toBeNull();
      expect(makerPageTitle(state.config, "en")).toBe("Super Arzon");
      expect(createWebManifest(state.config).icons[0].src).toBe(
        "icons/company-192.png",
      );
    },
  );

  it("keeps English-only staff documents English and bilingual documents bilingual", () => {
    const { container, rerender } = render(
      <OperationalPrintDocument
        title_en="Order"
        title_fa="سفارش"
        company_name="Cedar Market"
        reference="CD-100"
        language="fa"
        documentLanguage="en"
      >
        <p>Fictional goods</p>
      </OperationalPrintDocument>,
    );
    expect(container.querySelector("footer")).toHaveTextContent(
      "Made with Klead",
    );
    expect(container.textContent).not.toMatch(/[\u0600-\u06ff]/);
    rerender(
      <OperationalPrintDocument
        title_en="Picking list"
        title_fa="برداشت"
        company_name="Cedar Market"
        reference="CD-101"
        language="fa"
      >
        <p>Fictional goods</p>
      </OperationalPrintDocument>,
    );
    expect(container.querySelector("footer [lang=en]")).toHaveTextContent(
      "Made with Klead",
    );
    expect(container.querySelector("footer [lang=fa]")).toHaveTextContent(
      "ساخته‌شده با Klead",
    );
  });

  it("uses configured icon files and restores company icons when the maker is removed", () => {
    document.head.innerHTML += '<link rel="icon"><link rel="apple-touch-icon">';
    synchronizeMakerIcons(configSeed, document);
    expect(document.querySelector('link[rel="icon"]')).toHaveAttribute(
      "href",
      "/demo/brand/klead/klead-icon-32.svg",
    );
    expect(document.querySelector('link[rel="icon"]')).toHaveAttribute(
      "type",
      "image/svg+xml",
    );
    expect(
      document.querySelector('link[rel="apple-touch-icon"]'),
    ).toHaveAttribute("href", "/demo/brand/klead/klead-icon-192.png");
    synchronizeMakerIcons({ branding: { maker: null } }, document);
    expect(document.querySelector('link[rel="icon"]')).toHaveAttribute(
      "href",
      "/demo/icons/company-192.png",
    );
    expect(document.querySelector('link[rel="icon"]')).toHaveAttribute(
      "type",
      "image/png",
    );
    document.querySelector('link[rel="icon"]')?.remove();
    document.querySelector('link[rel="apple-touch-icon"]')?.remove();
  });

  it("builds matching startup icon paths and MIME types for the configured maker or no maker", () => {
    const head =
      '<link rel="icon" type="image/png" href="./icons/company-192.png"><link rel="apple-touch-icon" href="./icons/company-192.png">';
    expect(configureBrandHead(head)).toContain(
      'type="image/svg+xml" href="./brand/klead/klead-icon-32.svg"',
    );
    const replacement = configureBrandHead(head, {
      branding: {
        maker: {
          name: "Cedar Tools",
          favicon_file: "brand/cedar/32.png",
          icon_192_file: "brand/cedar/192.png",
        },
      },
    });
    expect(replacement).toContain(
      'type="image/png" href="./brand/cedar/32.png"',
    );
    expect(replacement).toContain('href="./brand/cedar/192.png"');
    expect(replacement).not.toContain("klead");
    const omitted = configureBrandHead(head, { branding: { maker: null } });
    expect(omitted).toBe(head);
  });

  it.each(["day", "week"] as const)(
    "prints %s timesheets with the configured maker, then removes the whole attribution when disabled",
    (view) => {
      const state = initialState();
      const day = readTimesheetDayView(state, "Branch 1", "2026-10-27");
      const week =
        view === "week"
          ? readTimesheetWeekView(state, "Branch 1", "2026-10-27")
          : null;
      const snapshot = { day, week };
      const { rerender } = render(
        <TimesheetPrint config={state.config} snapshot={snapshot} />,
      );
      expect(
        document.querySelectorAll(".timesheet-paper-document .maker-print"),
      ).toHaveLength(1);
      expect(
        document.querySelector(".timesheet-paper-document .maker-print"),
      ).toHaveTextContent("Made with Klead");
      state.config.branding = { maker: null };
      rerender(<TimesheetPrint config={state.config} snapshot={snapshot} />);
      expect(
        document.querySelector(".timesheet-paper-document .maker-print"),
      ).toBeNull();
      expect(
        document.querySelector(".timesheet-paper-document")?.textContent,
      ).not.toContain("Klead");
      expect(
        document.querySelector(".timesheet-paper-document"),
      ).toBeInTheDocument();
    },
  );

  it.each(["en", "fa"] as const)(
    "keeps empty support hidden and displays the translated attribution in %s",
    (language) => {
      const config: MakerConfig = {
        branding: { maker: { name: "Cedar Tools" }, maker_support: " " },
      };
      const { container } = render(
        <>
          <PoweredByMaker config={config} language={language} />
          <MakerAbout
            config={config}
            language={language}
            appName="Cedar Market"
            version="0.2.0"
          />
        </>,
      );
      expect(container.textContent).toContain(
        language === "en" ? "Powered by" : "با پشتیبانی",
      );
      expect(container.querySelector(".maker-support")).toBeNull();
      expect(container.textContent).not.toContain("Klead");
    },
  );
});
