import type { Page } from "@playwright/test";
export interface ContrastSample {
  text: string;
  kind: string;
  tag: string;
  className: string;
  color: string;
  compositedForeground: number[];
  compositedBackground: number[];
  contrast: number;
  disabled: boolean;
  focused: boolean;
  hovered: boolean;
}
export function inspectTextContrast(
  page: Page,
  scene: string,
  variant: string,
): Promise<{
  scene: string;
  variant: string;
  width: number;
  samples: ContrastSample[];
  minimum: number | null;
  failures: ContrastSample[];
}>;
