import { expect, test } from "@playwright/test";
import { readCanonicalBusinessEvidence } from "./business-evidence";
import { prepareR2fTimesheet } from "./r2f-timesheet-fixture";

for (const language of ["en", "fa"] as const)
  for (const theme of ["light", "dark"] as const)
    for (const width of [1440, 1000, 390])
      test(`R2f D1 daily sheet ${width} ${language} ${theme}`, async ({
        page,
      }, info) => {
        await page.setViewportSize({
          width,
          height: width === 390 ? 844 : 900,
        });
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await prepareR2fTimesheet(page, language, theme);
        const pageHeader = page.locator(".timesheets-page > .page-header");
        await expect(pageHeader).toContainText("77:42");
        await expect(pageHeader).toContainText(
          language === "en" ? "10 people" : "10 نفر",
        );
        const bakery = page.locator('[data-department-key="bakery"]');
        await expect(bakery.getByRole("heading")).toHaveText(
          language === "en" ? "Bakery" : "نانوایی",
        );
        await expect(bakery.getByRole("heading")).not.toContainText(
          language === "en" ? "نانوایی" : "Bakery",
        );
        await expect(
          page.locator('[data-department-key="kebab"] .timesheet-table'),
        ).toHaveCount(0);
        const live = page.locator('[data-row-id="r2f-shift-2"]');
        const out = live.getByRole("textbox").nth(1);
        await expect(live.locator(".timesheet-hours")).toHaveText(
          language === "en" ? "6:42so far" : "6:42تا الان",
        );
        await expect(
          page.locator('[data-row-id="r2f-shift-8"] .timesheet-hours'),
        ).toContainText(language === "en" ? "+1 day" : "+۱ روز");
        await out.focus();
        const now = page.getByRole("listbox", {
          name: language === "en" ? "Suggested time" : "زمان پیشنهادی",
        });
        await expect(now).toBeVisible();
        await expect(now).toContainText("13:42");
        const before = await out.boundingBox();
        await page.screenshot({
          path: info.outputPath(`D1-${width}-${language}-${theme}.png`),
          fullPage: true,
        });
        const canonical = await readCanonicalBusinessEvidence(page);
        expect(
          canonical.timesheet_rows!.find((row) => row.id === "r2f-shift-2")!
            .out_time,
        ).toBe("");
        await now.getByRole("option").click();
        await expect(out).toHaveValue("13:42");
        await expect(live.locator(".timesheet-hours")).not.toContainText(
          language === "en" ? "so far" : "تا الان",
        );
        const after = await out.boundingBox();
        expect(Math.abs(after!.y - before!.y)).toBeLessThanOrEqual(2);
        await expect
          .poll(
            async () =>
              (await readCanonicalBusinessEvidence(page)).timesheet_rows!.find(
                (row) => row.id === "r2f-shift-2",
              )!.out_time,
          )
          .toBe("13:42");
        const geometry = await bakery.evaluate((card) => {
          const textEdge = (node: Element) => {
            const range = document.createRange();
            range.selectNodeContents(node);
            const box = range.getBoundingClientRect();
            const rtl = getComputedStyle(card).direction === "rtl";
            return {
              start: rtl ? box.right : box.left,
              end: rtl ? box.left : box.right,
              center: (box.left + box.right) / 2,
            };
          };
          const heads = [
            ...card.querySelectorAll(
              ".timesheet-table-head [role=columnheader]",
            ),
          ];
          const headerName = textEdge(heads[0]).start;
          const headerHours = textEdge(heads[3]).end;
          const alignment = [...card.querySelectorAll(".timesheet-row")].map(
            (row) => {
              const fields = [...row.querySelectorAll("input")].map((node) =>
                node.getBoundingClientRect(),
              );
              return {
                name: Math.abs(
                  textEdge(row.querySelector(".timesheet-person strong")!)
                    .start - headerName,
                ),
                hours: Math.abs(
                  textEdge(row.querySelector(".timesheet-hours strong")!).end -
                    headerHours,
                ),
                in: Math.abs(
                  (fields[0].left + fields[0].right) / 2 -
                    textEdge(heads[1]).center,
                ),
                out: Math.abs(
                  (fields[1].left + fields[1].right) / 2 -
                    textEdge(heads[2]).center,
                ),
              };
            },
          );
          const inputs = [
            ...card.querySelectorAll<HTMLInputElement>(".timesheet-row input"),
          ].map((node) => node.getBoundingClientRect());
          const rows = [
            ...card.querySelectorAll<HTMLElement>(".timesheet-row"),
          ].map((node) => node.getBoundingClientRect());
          return {
            alignment,
            fields: inputs.map((box) => ({
              width: box.width,
              height: box.height,
            })),
            rows: rows.map((box) => box.height),
            menus: [...card.querySelectorAll(".timesheet-row-menu")].map(
              (node) => ({
                width: node.getBoundingClientRect().width,
                height: node.getBoundingClientRect().height,
              }),
            ),
            columns: getComputedStyle(card.parentElement!).columnCount,
            overflow: document.documentElement.scrollWidth - innerWidth,
          };
        });
        for (const alignment of geometry.alignment)
          for (const delta of Object.values(alignment))
            expect(delta).toBeLessThanOrEqual(1.5);
        expect(geometry.columns).toBe(
          width === 1440 ? "3" : width === 1000 ? "2" : "1",
        );
        for (const field of geometry.fields) {
          expect(field.width).toBe(60);
          expect(field.height).toBe(44);
        }
        for (const height of geometry.rows) expect(height).toBe(56);
        for (const menu of geometry.menus) {
          expect(menu.width).toBe(28);
          expect(menu.height).toBe(44);
        }
        expect(geometry.overflow).toBeLessThanOrEqual(1);
        expect(errors).toEqual([]);
      });

test("R2f D1 ongoing display never becomes completed week or payroll and missing/future clocks stay honest", async ({
  page,
}, info) => {
  await prepareR2fTimesheet(page);
  const before = await readCanonicalBusinessEvidence(page);
  await expect(
    page.locator('[data-row-id="r2f-shift-2"] .timesheet-hours'),
  ).toContainText("6:42");
  await page.getByRole("tab", { name: "Week", exact: true }).click();
  const scope = page.locator(
    info.project.name === "phone"
      ? ".timesheet-week-phone"
      : ".timesheet-week-wide",
  );
  await expect(scope.locator("[data-week-total-minutes]")).toHaveAttribute(
    "data-week-total-minutes",
    "4260",
  );
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV", exact: true }).click();
  const download = await downloadEvent;
  const stream = await download.createReadStream();
  let csv = "";
  for await (const chunk of stream!) csv += chunk.toString();
  expect(csv).toContain('"Rowan Pine","Cash","2026-10-27","07:00","","0.0000"');
  const after = await readCanonicalBusinessEvidence(page);
  expect(after.timesheet_rows).toEqual(before.timesheet_rows);
  expect(after.timesheet_days).toEqual(before.timesheet_days);
  await page.getByRole("tab", { name: "Day", exact: true }).click();
  const future = page.locator('[data-row-id="r2f-shift-3"]');
  const futureOut = future.getByRole("textbox").nth(1);
  await futureOut.fill("");
  await futureOut.blur();
  await expect(future.locator(".timesheet-hours")).toHaveText("0:00");
  await expect(future.locator(".timesheet-hours")).not.toContainText("so far");
  await page.getByRole("button", { name: "Previous day", exact: true }).click();
  await expect(page.locator(".timesheets-page")).toHaveAttribute(
    "data-timesheet-date",
    "2026-10-26",
  );
  const cash = page.locator('[data-department-key="cash"]');
  await cash.getByRole("button", { name: "Add person", exact: true }).click();
  await cash.getByRole("combobox").fill("Rowan");
  await cash.getByRole("option", { name: /Rowan Pine/ }).click();
  const past = cash.locator(".timesheet-row");
  await past.getByRole("textbox").first().fill("22");
  await past.getByRole("textbox").first().blur();
  await expect(past.locator(".timesheet-warning")).toHaveText(
    "Out time missing",
  );
  await expect(past.locator(".timesheet-hours strong")).toHaveText("0:00");
  await expect(past.locator(".timesheet-hours")).not.toContainText("so far");
  const color = await past.locator(".timesheet-warning").evaluate((node) => {
    const sample = document.createElement("span");
    sample.style.color = "var(--pending)";
    document.body.append(sample);
    const expected = getComputedStyle(sample).color;
    sample.remove();
    return { actual: getComputedStyle(node).color, expected };
  });
  expect(color.actual).toBe(color.expected);
});
