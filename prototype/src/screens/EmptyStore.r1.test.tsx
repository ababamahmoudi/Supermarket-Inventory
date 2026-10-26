import type { ComponentType } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authenticatedProviderFixture } from "../authority-provider-test-fixture";
import { authenticatedTestActor } from "../authority-test-fixture";
import { LANGUAGE_KEY } from "../auth-preferences.e1";
import { initialState } from "../e1-bootstrap";
import { removeFictionalData } from "../empty-store";
import i18n from "../i18n";
import { DemoProvider, useDemo } from "../store";
import { Dashboard } from "./Dashboard";
import { Lookup, Products } from "./Catalog";
import Suppliers from "./Suppliers";
import Received from "./Received";
import { Returns } from "./Returns";
import { Labels } from "./Labels";
import { Offers } from "./Offers";
import { PriceUpdates } from "./PriceUpdates";
import { Expiry } from "./Expiry";
import Orders from "./Orders";
import { Payables } from "./Payables";

let fixture: Awaited<ReturnType<typeof authenticatedProviderFixture>>;
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  fixture?.dispose();
  vi.unstubAllGlobals();
});
function ReadyPage({ Page }: { Page: ComponentType }) {
  const { actor } = useDemo();
  return actor ? <Page /> : null;
}
const cases = [
  [
    "dashboard",
    Dashboard,
    "No invoices. Receive an invoice to get started.",
    "فاکتوری نیست. برای شروع یک فاکتور دریافت کنید.",
  ],
  [
    "lookup",
    Lookup,
    "No products yet; products appear here after an invoice is posted or a product is added.",
    "هنوز محصولی وجود ندارد؛ پس از ثبت فاکتور یا افزودن محصول، محصولات اینجا نمایش داده می‌شوند.",
  ],
  [
    "products",
    Products,
    "No products yet; import an invoice in Settings → Data or add a product to get started.",
    "هنوز محصولی وجود ندارد؛ برای شروع از تنظیمات ← داده‌ها یک فاکتور وارد کنید یا محصولی اضافه کنید.",
  ],
  [
    "suppliers",
    Suppliers,
    "No suppliers yet; import an invoice or add a supplier to get started.",
    "هنوز تأمین‌کننده‌ای وجود ندارد؛ برای شروع یک فاکتور وارد کنید یا تأمین‌کننده‌ای اضافه کنید.",
  ],
  [
    "received",
    Received,
    "No deliveries yet; post an invoice to record received goods here.",
    "هنوز تحویلی وجود ندارد؛ برای ثبت کالای دریافتی در اینجا یک فاکتور ثبت کنید.",
  ],
  [
    "returns",
    Returns,
    "No returns yet; create a return when goods need to go back to a supplier.",
    "هنوز مرجوعی‌ای وجود ندارد؛ برای بازگرداندن کالا به تأمین‌کننده، یک مرجوعی ایجاد کنید.",
  ],
  [
    "labels",
    Labels,
    "No products to label yet; post an invoice or add a product first.",
    "هنوز محصولی برای برچسب‌زنی وجود ندارد؛ ابتدا یک فاکتور ثبت کنید یا محصولی اضافه کنید.",
  ],
  [
    "offers",
    Offers,
    "No offers match these filters. Clear filters or create an offer.",
    "هیچ پیشنهادی با این فیلترها مطابقت ندارد. فیلترها را پاک کنید یا پیشنهاد ایجاد کنید.",
  ],
  [
    "price-updates",
    PriceUpdates,
    "No price updates yet; approved price changes will appear here for the register and shelf labels.",
    "هنوز به‌روزرسانی قیمتی وجود ندارد؛ تغییرات قیمت تأییدشده برای صندوق و برچسب قفسه اینجا نمایش داده می‌شوند.",
  ],
  [
    "expiry",
    Expiry,
    "No tracked dates yet; add an expiry or best-before date when you receive a product.",
    "هنوز تاریخی برای پیگیری وجود ندارد؛ هنگام دریافت محصول، تاریخ انقضا یا بهترین زمان مصرف را اضافه کنید.",
  ],
  [
    "orders",
    Orders,
    "No orders yet; create an order when you are ready to request goods from a supplier.",
    "هنوز سفارشی وجود ندارد؛ برای درخواست کالا از تأمین‌کننده، یک سفارش ایجاد کنید.",
  ],
  [
    "payables",
    Payables,
    "No payables yet; post an invoice to start a supplier balance.",
    "هنوز پرداختنی‌ای وجود ندارد؛ برای شروع ماندهٔ تأمین‌کننده، یک فاکتور ثبت کنید.",
  ],
] as const;

describe("R1 empty business screens retain their normal interface", () => {
  for (const lang of ["en", "fa"] as const) {
    it(`renders zero dashboard values and useful shared empty states in ${lang}`, async () => {
      const state = initialState();
      removeFictionalData(state, authenticatedTestActor(state, "owner"));
      localStorage.setItem(LANGUAGE_KEY, lang);
      await i18n.changeLanguage(lang);
      fixture = await authenticatedProviderFixture({
        state,
        role: "owner",
        actorOptions: {
          selection: { kind: "location", location_id: "Branch 1" },
        },
      });
      const ui = (Page: ComponentType, route: string) => (
        <DemoProvider options={fixture.options}>
          <ReadyPage key={route} Page={Page} />
        </DemoProvider>
      );
      const rendered = render(ui(Dashboard, "dashboard"));
      const snapshot = async () => ({
        business: await fixture.readCanonical(),
        authority: await fixture.repository.load(fixture.actor.company_id),
      });
      let baseline: Awaited<ReturnType<typeof snapshot>> | undefined;
      for (const [route, Page, en, fa] of cases) {
        window.history.replaceState(null, "", `#${route}`);
        rendered.rerender(ui(Page, route));
        const message = await screen.findByText(
          lang === "en" ? en : fa,
          {},
          { timeout: 5000 },
        );
        expect(rendered.container.textContent).not.toMatch(/NaN|undefined/);
        if (route === "dashboard") {
          expect(
            message.closest(".dashboard-invoices .dashboard-empty"),
          ).not.toBeNull();
          expect(message.closest(".ui-empty-state")).toBeNull();
          const kpis = rendered.container.querySelector(
            ".dashboard-kpis.has-timesheets",
          )!;
          const tiles = Array.from(
            kpis.querySelectorAll(
              ":scope > .ui-summary-tile.dashboard-summary-tile",
            ),
          );
          expect(
            tiles.map((tile) => tile.querySelector(".kpi-label")?.textContent),
          ).toEqual(
            lang === "en"
              ? [
                  "Approvals waiting",
                  "Price updates to apply",
                  "Open alerts",
                  "Open shorts",
                  "Expiring soon",
                  "On shift now",
                ]
              : [
                  "تأییدهای در انتظار",
                  "به‌روزرسانی قیمت‌های قابل اجرا",
                  "هشدارهای باز",
                  "کسری‌های باز",
                  "انقضای نزدیک",
                  "اکنون در حال کار",
                ],
          );
          expect(
            kpis.querySelectorAll(".timesheet-on-shift-tile"),
          ).toHaveLength(1);
          const values = kpis.querySelectorAll(".kpi-value");
          expect(values).toHaveLength(6);
          for (const value of values) expect(value).toHaveTextContent(/^0$/);
          for (const card of [
            ".dashboard-approvals",
            ".dashboard-invoices",
            ".dashboard-supplier-purchases",
            ".dashboard-weekly-purchases",
            ".price-update-dashboard-card",
            ".dashboard-alerts",
            ".dashboard-notes",
            ".dashboard-balances",
          ])
            expect(
              rendered.container.querySelector(`${card} .dashboard-empty`),
              card,
            ).toBeVisible();
          expect(
            rendered.container.querySelectorAll(
              ".dashboard-approval-table,.dashboard-invoices table,.purchase-bars,.purchase-week-chart,.dashboard-task-list,.dashboard-alert-list,.dashboard-balance-row",
            ),
          ).toHaveLength(0);
          baseline = await snapshot();
          expect(baseline.business).toMatchObject({
            products: [],
            suppliers: [],
            invoices: [],
            approvals: [],
            alerts: [],
            returns: [],
            ledger: [],
            notes: [],
            expiry: [],
            price_update_tasks: [],
            timesheet_staff: [],
            timesheet_days: [],
            timesheet_rows: [],
            stock: {},
            invoice: { status: "empty", lines: [], final_total: "0.00" },
          });
          expect(baseline.business.activity).toHaveLength(1);
          expect(baseline.business.activity[0]).toMatchObject({
            action: "Removed fictional data",
            entity_type: "settings",
            entity_id: "data",
          });
        } else {
          expect(message.closest(".ui-empty-state")).not.toBeNull();
        }
      }
      await waitFor(() =>
        expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
      );
      expect(baseline).toBeDefined();
      expect(await snapshot()).toEqual(baseline);
    });
    it(`shows empty Lookup with all locations selected in ${lang}`, async () => {
      const state = initialState();
      removeFictionalData(state, authenticatedTestActor(state, "owner"));
      localStorage.setItem(LANGUAGE_KEY, lang);
      await i18n.changeLanguage(lang);
      window.history.replaceState(null, "", "#lookup");
      fixture = await authenticatedProviderFixture({
        state,
        role: "owner",
        actorOptions: { selection: { kind: "all_locations" } },
      });
      const { container } = render(
        <DemoProvider options={fixture.options}>
          <ReadyPage Page={Lookup} />
        </DemoProvider>,
      );
      const message = await screen.findByText(
        lang === "en" ? cases[1][2] : cases[1][3],
        {},
        { timeout: 5000 },
      );
      expect(message.closest(".ui-empty-state")).not.toBeNull();
      expect(container.textContent).not.toMatch(/NaN|undefined/);
      expect(
        screen.queryByRole("button", {
          name: lang === "en" ? "Clear search" : "پاک کردن جست‌وجو",
        }),
      ).not.toBeInTheDocument();
    });
  }
});
