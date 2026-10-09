import { expect, test } from "@playwright/test";
import { signIn, visitPage } from "./helpers";

for (const height of [720, 950, 1080])
  test(`C2 sidebar keeps new and existing pages accessible without scrolling at ${height}px desktop height`, async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop",
      "Desktop viewport boundary check",
    );
    await page.setViewportSize({ width: 1280, height });
    await signIn(page, "Supervisor");
    for (const label of [
      "Orders",
      "Branch requests",
      "Received",
      "Settings",
      "History",
      "Dashboard",
    ]) {
      await visitPage(page, label);
      await expect(
        page
          .getByRole("navigation", { name: "Pages", exact: true })
          .getByRole("link", { name: label, exact: true }),
      ).toHaveAttribute("aria-current", "page");
      const user = page.getByRole("button", {
        name: "User menu",
        exact: true,
      });
      const geometry = await page.locator(".sidebar").evaluate((sidebar) => {
        const nav = sidebar.querySelector("nav")!;
        const user = sidebar.querySelector(".user-chip")!;
        return {
          sidebarHeight: sidebar.clientHeight,
          sidebarScrollHeight: sidebar.scrollHeight,
          navHeight: nav.clientHeight,
          navScrollHeight: nav.scrollHeight,
          userBottom: user.getBoundingClientRect().bottom,
          viewportHeight: window.innerHeight,
          viewportWidth: window.innerWidth,
          documentWidth: document.documentElement.scrollWidth,
          groups: sidebar.querySelectorAll(".nav-section").length,
        };
      });
      await testInfo.attach(`sidebar-${label}-${height}.json`, {
        body: JSON.stringify(geometry, null, 2),
        contentType: "application/json",
      });
      await expect(user).toBeInViewport();
      expect(geometry.sidebarScrollHeight).toBe(geometry.sidebarHeight);
      expect(geometry.navScrollHeight).toBe(geometry.navHeight);
      expect(geometry.userBottom).toBeLessThanOrEqual(geometry.viewportHeight);
      expect(geometry.documentWidth).toBeLessThanOrEqual(
        geometry.viewportWidth,
      );
      expect(geometry.groups).toBe(4);
    }
  });
