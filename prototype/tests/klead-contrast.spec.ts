import { expect, test } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { signIn, setLanguage, openShellAction } from "./helpers";
import { inspectTextContrast } from "../scripts/klead-contrast-proof.mjs";
for (const language of ["en", "fa"] as const)
  for (const theme of ["light", "dark"] as const) {
    test(`Klead composited text contrast ${language} ${theme}`, async ({
      page,
    }, info) => {
      test.setTimeout(240000);
      await signIn(page, "Supervisor");
      if (theme === "dark")
        await (await openShellAction(page, "Switch to dark theme")).click();
      await setLanguage(page, language);
      const reports = [];
      for (const scene of [
        "dashboard",
        "lookup",
        "products",
        "invoices",
        "received",
        "returns",
        "expiry",
        "payables",
        "suppliers",
        "approvals",
        "settings",
        "offers",
        "orders",
        "requests",
        "notes",
        "history",
        "labels",
      ]) {
        await page.goto(`/#${scene}`);
        await expect(page.locator("main h1")).toBeVisible();
        let proof = await inspectTextContrast(
          page,
          scene,
          `${language}-${theme}`,
        );
        reports.push(proof);
        const heading = await page.locator("main h1").innerText();
        expect(
          proof.samples.some(
            (sample) => sample.tag === "H1" && sample.text === heading.trim(),
          ),
          `${scene} must include its actual visible heading in the proof`,
        ).toBe(true);
        expect(proof.minimum).toBeGreaterThanOrEqual(4.5);
        expect(proof.failures, `${scene} ${language} ${theme}`).toEqual([]);
        const first = page
          .locator("main button:not(:disabled)")
          .filter({ visible: true })
          .first();
        if (await first.count()) {
          await first.hover();
          proof = await inspectTextContrast(
            page,
            `${scene}:hover`,
            `${language}-${theme}`,
          );
          reports.push(proof);
          expect(proof.failures).toEqual([]);
          await first.focus();
          proof = await inspectTextContrast(
            page,
            `${scene}:focus`,
            `${language}-${theme}`,
          );
          reports.push(proof);
          expect(proof.failures).toEqual([]);
        }
      }
      const output = info.outputPath("composited-contrast.json");
      await writeFile(output, JSON.stringify(reports, null, 2) + "\n");
      await info.attach("Real composited text colors and states", {
        path: output,
        contentType: "application/json",
      });
    });
  }
