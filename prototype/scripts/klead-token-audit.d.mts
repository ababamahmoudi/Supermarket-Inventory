export interface TokenFinding {
  file: string;
  line: number;
  property: string;
  value: string;
  selector?: string;
}
export function auditKleadTokens(prototypeRoot: string): Promise<{
  cssFiles: number;
  declarations: number;
  inlineStyles: number;
  exceptions: TokenFinding[];
  failures: TokenFinding[];
}>;
import type { Declaration } from "postcss";

export function hasRawColor(value: string): boolean;
export function rawStyleDeclaration(declaration: Declaration): boolean;
export function printDeclaration(declaration: Declaration): boolean;
