import { expect, test } from "@playwright/test";
import { runCanonicalBusinessFixture } from "./business-fixture";
import { auditR2fAlignment } from "./r2f-alignment";
import { setBranch, setLanguage, signIn } from "./helpers";

for (const width of [1440, 1000, 390])
  for (const language of ["en", "fa"] as const) {
    const theme = language === "en" ? "light" : "dark";
    test(`R2f D7 dashboard ${width} ${language} ${theme}`, async ({
      page,
    }, info) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.setViewportSize({ width, height: 1000 });
      await signIn(page, "Manager");
      await setBranch(page, "North York");
      await setLanguage(page, language);
      await page.evaluate((value) => {
        document.documentElement.dataset.theme = value;
        localStorage.setItem("arzon-theme", value);
      }, theme);
      const now = new Date().toISOString();
      const previous = new Date(Date.now() - 2 * 86400000).toISOString();
      await runCanonicalBusinessFixture(
        page,
        (state, times) => {
          const prior = state.activity[0];
          if (!prior)
            throw new Error("The fictional activity fixture is missing.");
          state.activity = [
            {
              ...prior,
              id: "fictional-r2f-current-activity",
              action: "note_seen",
              at: times.now,
            },
            {
              ...prior,
              id: "fictional-r2f-prior-activity",
              action: "note_seen",
              at: times.previous,
            },
          ];
        },
        { now, previous },
      );
      await page.goto("/#dashboard");
      const dashboard = page.locator(".r2c-dashboard");
      await expect(dashboard).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      const weekly = dashboard.locator(".dashboard-this-week");
      await expect(
        weekly.getByRole("heading", {
          name: language === "en" ? "This week" : "این هفته",
          exact: true,
        }),
      ).toBeVisible();
      await expect(weekly.locator(".dashboard-week-stat")).toHaveCount(3);
      await expect(
        dashboard.getByText(
          language === "en" ? "More operations" : "عملیات بیشتر",
          { exact: true },
        ),
      ).toHaveCount(0);
      for (const value of await weekly
        .locator(".dashboard-week-stat > strong")
        .allTextContents())
        expect(value.trim()).toMatch(/^\d+$/);
      const activity = dashboard.locator(".dashboard-activity");
      await expect(activity.locator(".dashboard-activity-list")).toHaveCount(1);
      await expect(activity.locator("h3")).toHaveCount(0);
      await expect(activity.locator("time")).toHaveCount(2);
      const activityText = await activity.locator("time").allTextContents();
      expect(activityText[0].trim()).toMatch(/^\d{2}:\d{2}$/);
      expect(activityText[1].trim()).toMatch(/^[A-Za-z]{3,} \d{1,2}$/);
      for (const line of await activity
        .locator(".dashboard-activity-item small")
        .allTextContents())
        expect(line).not.toMatch(/·\s*$/);
      const alignment = await auditR2fAlignment(page, { scene: "D7" });
      await info.attach("R2f strict alignment", {
        body: JSON.stringify(alignment),
        contentType: "application/json",
      });
      const proof = await dashboard.evaluate((root) => {
        const box = (element: Element) => {
          const r = element.getBoundingClientRect();
          return {
            top: r.top,
            bottom: r.bottom,
            left: r.left,
            right: r.right,
            height: r.height,
            width: r.width,
          };
        };
        const captions = [...root.querySelectorAll(".kpi-detail")].map(
          (el) => ({
            text: el.textContent ?? "",
            height: el.getBoundingClientRect().height,
            lineHeight: parseFloat(getComputedStyle(el).lineHeight),
            overflow: getComputedStyle(el).textOverflow,
          }),
        );
        return {
          overflow: document.documentElement.scrollWidth - window.innerWidth,
          captions,
          headers: [...root.querySelectorAll(".dashboard-card-header")].map(
            box,
          ),
          purchases: [
            ...root.querySelectorAll(".dashboard-purchase-pair > .card"),
          ].map(box),
          weekly: box(root.querySelector(".dashboard-this-week")!),
          approvals: box(root.querySelector(".dashboard-approvals")!),
          columns: [
            ...root.querySelectorAll<HTMLTableCellElement>(
              ".dashboard-approval-table th[data-column-key]",
            ),
          ]
            .filter((el) => el.getBoundingClientRect().width > 0)
            .map((el) => ({
              key: el.dataset.columnKey,
              width: el.getBoundingClientRect().width,
              text: el.textContent ?? "",
            })),
        };
      });
      await info.attach("R2f dashboard geometry", {
        body: JSON.stringify(proof),
        contentType: "application/json",
      });
      await page.screenshot({
        path: info.outputPath(`dashboard-${width}-${theme}-${language}.png`),
        fullPage: true,
      });
      expect(alignment.failures).toEqual([]);
      expect(proof.overflow).toBeLessThanOrEqual(1);
      for (const caption of proof.captions) {
        expect(caption.text).not.toContain("…");
        expect(caption.overflow).toBe("clip");
        expect(caption.height).toBeLessThanOrEqual(
          caption.lineHeight * 2 + 1.5,
        );
      }
      expect(proof.headers.every((header) => header.height >= 43.5)).toBe(true);
      if (width === 1440) {
        for (const [key, pixels] of [
          ["type", 120],
          ["price", 128],
          ["margin", 80],
          ["actions", 168],
        ] as const) {
          const column = proof.columns.find((item) => item.key === key);
          expect(column, key).toBeDefined();
          expect(Math.abs(column!.width - pixels), key).toBeLessThanOrEqual(
            1.5,
          );
        }
        expect(
          proof.columns.find((column) => column.key === "actions")?.text,
        ).toBe("");
      }
      if (Math.abs(proof.purchases[0].top - proof.purchases[1].top) <= 1.5)
        expect(
          Math.abs(proof.purchases[0].height - proof.purchases[1].height),
        ).toBeLessThanOrEqual(1.5);
      if (width === 390)
        expect(proof.weekly.bottom).toBeLessThan(proof.approvals.top);
      const approvalRow = dashboard.locator(".dashboard-queue-row").first();
      const approvalId = await approvalRow.getAttribute("data-approval-id");
      await approvalRow
        .getByRole("button", {
          name: language === "en" ? "More" : "بیشتر",
          exact: true,
        })
        .click();
      await page
        .getByRole("menuitem", {
          name: language === "en" ? "View approval" : "مشاهده تأیید",
          exact: true,
        })
        .click();
      await expect(page).toHaveURL(
        (url) =>
          url.hash === `#approvals?id=${encodeURIComponent(approvalId!)}`,
      );
      await page.goto("/#dashboard");
      await expect(weekly).toBeVisible();
      for (const href of ["#returns", "#received", "#price-updates"]) {
        await weekly.locator(`a[href="${href}"]`).click();
        await expect(page).toHaveURL((url) => url.hash === href);
        await page.goto("/#dashboard");
        await expect(weekly).toBeVisible();
      }
      expect(errors).toEqual([]);
    });
  }
