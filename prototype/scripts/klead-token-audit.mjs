import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import postcss from "postcss";
import ts from "typescript";

const names =
  "aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgrey darkgreen darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray grey green greenyellow honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgrey lightgreen lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen transparent currentColor";
const rawColor = new RegExp(
  String.raw`(?:#[\da-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix|light-dark)\(|(?<![-\w])(?:${names.split(" ").join("|")})(?![-\w]))`,
  "i",
);
const printAnchor =
  /\.(?:shelf-label(?:-[\w-]+)?|promo-(?:shelf-label|label-(?:frame|content|special|price|regular-price|code|footer))|regular-label-special|label-(?:offer-badge|alignment-box)|print-sheet|operational-print-(?:document|heading|meta|check)|order-print-(?:table|new-item|total|unit-size)|return-memo-(?:table|signature|signatures|total|reference|supplier|footnote|document))(?![\w-])/;
export function printDeclaration(declaration) {
  let current = declaration.parent;
  while (current) {
    if (
      current.type === "atrule" &&
      ((current.name === "media" &&
        /(?:^|\s|,)print(?:$|\s|,)/.test(current.params)) ||
        current.name === "page")
    )
      return true;
    if (
      current.type === "rule" &&
      printAnchor.test(current.selector) &&
      !current.selector.includes(":has(")
    )
      return true;
    current = current.parent;
  }
  return false;
}
export function hasRawColor(value) {
  return rawColor.test(value);
}
export function rawStyleDeclaration(declaration) {
  const shape =
    /^(?:border(?:-[\w-]+)?-radius|box-shadow|text-shadow)$/.test(
      declaration.prop,
    ) && !/^var\(--[^)]+\)$/.test(declaration.value);
  const literalColor = rawColor.test(declaration.value);
  const namedColor =
    /^(?:color|background-color|border(?:-(?:top|right|bottom|left|inline|block)(?:-(?:start|end))?)?-color|fill|stroke)$/.test(
      declaration.prop,
    ) &&
    /^[a-z]+$/i.test(declaration.value) &&
    !/^(?:inherit|initial|unset|revert|none)$/i.test(declaration.value);
  return shape || literalColor || namedColor;
}
async function filesBelow(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...(await filesBelow(file)));
    else result.push(file);
  }
  return result;
}
export async function auditKleadTokens(prototypeRoot) {
  const failures = [];
  const exceptions = [];
  let declarations = 0;
  let cssFiles = 0;
  let inlineStyles = 0;
  for (const file of await filesBelow(path.join(prototypeRoot, "src"))) {
    if (file.endsWith(".css") && !file.endsWith("klead-tokens.css")) {
      cssFiles++;
      const ast = postcss.parse(await readFile(file, "utf8"), { from: file });
      ast.walkDecls((declaration) => {
        declarations++;
        if (printDeclaration(declaration)) {
          if (rawStyleDeclaration(declaration))
            exceptions.push({
              file: path.relative(prototypeRoot, file),
              line: declaration.source.start.line,
              property: declaration.prop,
              selector: declaration.parent.selector ?? "@print",
              value: declaration.value,
            });
          return;
        }
        if (rawStyleDeclaration(declaration))
          failures.push({
            file: path.relative(prototypeRoot, file),
            line: declaration.source.start.line,
            property: declaration.prop,
            value: declaration.value,
          });
      });
    } else if (file.endsWith(".tsx") && !file.endsWith(".test.tsx")) {
      const text = await readFile(file, "utf8");
      const source = ts.createSourceFile(
        file,
        text,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
      );
      const walk = (node) => {
        if (
          ts.isJsxAttribute(node) &&
          node.name.getText(source) === "style" &&
          node.initializer &&
          ts.isJsxExpression(node.initializer) &&
          node.initializer.expression &&
          ts.isObjectLiteralExpression(node.initializer.expression)
        ) {
          inlineStyles++;
          for (const property of node.initializer.expression.properties) {
            if (!ts.isPropertyAssignment(property)) continue;
            const name = property.name
              .getText(source)
              .replace(/^['"]|['"]$/g, "");
            const value = ts.isStringLiteral(property.initializer)
              ? property.initializer.text
              : undefined;
            if (
              value !== undefined &&
              ((/^(?:border.*Radius|boxShadow|textShadow)$/.test(name) &&
                !/^var\(--[^)]+\)$/.test(value)) ||
                (/color|background|border|fill|stroke|^--/i.test(name) &&
                  hasRawColor(value)))
            )
              failures.push({
                file: path.relative(prototypeRoot, file),
                line:
                  source.getLineAndCharacterOfPosition(
                    property.getStart(source),
                  ).line + 1,
                property: name,
                value,
              });
          }
        }
        ts.forEachChild(node, walk);
      };
      walk(source);
    }
  }
  return { cssFiles, declarations, inlineStyles, exceptions, failures };
}
