import { expect, it } from "vitest";
import postcss from "postcss";
import {
  auditKleadTokens,
  printDeclaration,
  rawStyleDeclaration,
} from "../scripts/klead-token-audit.mjs";

it("all non-print component colors, radii and shadows resolve through the standalone Klead tokens", async () => {
  const proof = await auditKleadTokens(process.cwd());
  expect(proof.cssFiles).toBeGreaterThan(30);
  expect(proof.declarations).toBeGreaterThan(1000);
  expect(proof.inlineStyles).toBeGreaterThan(10);
  expect(proof.exceptions.every((item) => item.selector || item.file)).toBe(
    true,
  );
  expect(proof.failures).toEqual([]);
});

it("rejects palette fallbacks, modern colors and physical or logical radii outside tokens", () => {
  const ast = postcss.parse(`.component {
    color: var(--text, rebeccapurple);
    background: linear-gradient(oklch(70% .1 210), rgba(0, 0, 0, .1));
    border-radius: 12px;
    border-start-start-radius: 12px;
    box-shadow: none;
    outline-color: var(--accent);
    border-radius: var(--radius-control);
    box-shadow: var(--shadow-menu);
  }`);
  const invalid: string[] = [];
  ast.walkDecls((declaration) => {
    if (rawStyleDeclaration(declaration)) invalid.push(declaration.prop);
  });
  expect(invalid).toEqual([
    "color",
    "background",
    "border-radius",
    "border-start-start-radius",
    "box-shadow",
  ]);
});

it("exempts actual printed paper without exempting the screen controls around it", () => {
  const ast = postcss.parse(`
    .shelf-label { color: #000; width: 60mm; }
    .label-print-actions { color: #000; }
    .label-card:has(.shelf-label) { background: white; }
    @media print { .label-print-actions { display: none; color: #000; } }
    @page { margin: 10mm; }
  `);
  const printed: boolean[] = [];
  ast.walkDecls((declaration) => {
    printed.push(printDeclaration(declaration));
  });
  expect(printed).toEqual([true, true, false, false, true, true, true]);
});
