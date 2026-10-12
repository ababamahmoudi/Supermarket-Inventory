import type { Page } from "@playwright/test";
export function inspectResponsiveLayout(
  page: Page,
  scene: string,
  language: string,
  width: number,
): Promise<{
  scene: string;
  language: string;
  width: number;
  actualWidth: number;
  words: number;
  contentWords: number;
  collisionGeometry: string;
  cells: number;
  forms: {
    className: string;
    scrollWidth: number;
    clientWidth: number;
    words: number;
    controls: number;
  }[];
  sidebar: {
    width: number;
    clientHeight: number;
    scrollHeight: number;
    navClientHeight: number;
    navScrollHeight: number;
  } | null;
  tables: {
    className: string;
    rows: { cells: number; words: number }[];
    scrollWidth: number;
    clientWidth: number;
  }[];
  topbar: { className: string; width: number; height: number }[];
  failures: string[];
}>;
