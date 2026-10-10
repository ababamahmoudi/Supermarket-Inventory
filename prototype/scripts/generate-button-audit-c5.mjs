/* global console, process */
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const project = dirname(dirname(fileURLToPath(import.meta.url)));
const sourceRoot = join(project, "src");
const flags = process.argv.slice(2);
const destination = (flag) => {
  const index = flags.indexOf(flag);
  return index === -1 ? null : flags[index + 1];
};

async function sources(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory()
        ? sources(path)
        : entry.name.endsWith(".tsx") && !entry.name.endsWith(".test.tsx")
          ? [path]
          : [];
    }),
  );
  return nested.flat().sort();
}

function copy(node, source) {
  const values = [];
  function visit(child) {
    if (ts.isCallExpression(child)) {
      const callee = child.expression.getText(source);
      if (["t", "tCount", "translateCount"].includes(callee)) {
        const args = child.arguments;
        const plain = (argument) =>
          argument && ts.isStringLiteralLike(argument)
            ? argument.text
            : (argument?.getText(source) ?? "");
        values.push(
          callee === "t"
            ? { en: plain(args[0]), fa: plain(args[1]) }
            : {
                en: `${plain(args[0])} / ${plain(args[1])}`,
                fa: `${plain(args[2])} / ${plain(args[3])}`,
              },
        );
      }
    }
    ts.forEachChild(child, visit);
  }
  visit(node);
  return values;
}

const inventory = [];
const checksum = createHash("sha256");
for (const path of await sources(sourceRoot)) {
  const text = await readFile(path, "utf8");
  const file = relative(project, path).split("\\").join("/");
  checksum.update(file).update("\0").update(text).update("\0");
  const source = ts.createSourceFile(
    path,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  function visit(node) {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const opening = ts.isJsxElement(node) ? node.openingElement : node;
      const component = opening.tagName.getText(source);
      if (
        ["Button", "IconButton", "Menu", "MenuItem", "button"].includes(
          component,
        )
      ) {
        const attributes = {};
        const attributeNodes = {};
        for (const attribute of opening.attributes.properties) {
          if (ts.isJsxAttribute(attribute)) {
            const name = attribute.name.getText(source);
            attributes[name] = attribute.initializer?.getText(source) ?? "true";
            attributeNodes[name] = attribute.initializer;
          }
        }
        const contents = ts.isJsxElement(node)
          ? node.children
              .map((child) => child.getText(source))
              .join(" ")
              .replace(/\s+/g, " ")
              .trim()
          : "";
        const labelNode = attributeNodes["aria-label"] ?? attributeNodes.label;
        const labels = labelNode ? copy(labelNode, source) : copy(node, source);
        const variant =
          attributes.variant?.replace(/^"|"$/g, "") ??
          (component === "Button" ? "primary" : "secondary");
        const role = attributes.role?.replace(/^"|"$/g, "");
        let kind = attributes["data-control-kind"]?.replace(/^"|"$/g, "");
        if (!kind) {
          kind =
            component === "IconButton" || attributes.iconOnly === "true"
              ? "icon"
              : component === "MenuItem" || role === "menuitem"
                ? "menu option"
                : role &&
                    [
                      "tab",
                      "checkbox",
                      "radio",
                      "switch",
                      "combobox",
                      "option",
                    ].includes(role)
                  ? role
                  : component === "button"
                    ? "custom widget (see callsite)"
                    : "action";
        }
        const widget = !["action", "icon"].includes(kind);
        inventory.push({
          screen: file
            .replace(/^src\/screens\//, "")
            .replace(/^src\//, "")
            .replace(/\.tsx$/, ""),
          file,
          line:
            source.getLineAndCharacterOfPosition(node.getStart(source)).line +
            1,
          component,
          kind,
          labels,
          dynamicLabel: labels.length
            ? null
            : (attributes["aria-label"] ?? attributes.label ?? contents) ||
              "Accessible label supplied by props",
          style: widget ? kind : variant === "ghost" ? "quiet" : variant,
          radius:
            kind === "icon"
              ? "Circle"
              : widget
                ? "Component-specific"
                : "12 px",
          height: widget ? "Component-specific" : "40 px",
          width:
            kind === "icon"
              ? "40 px"
              : widget
                ? "Component-specific"
                : "Intrinsic text + padding; table actions ≤200 px",
          attributes,
        });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}

const measurements = [];
async function readProof(path) {
  if ((await stat(path)).isDirectory()) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      if (entry.isDirectory() || entry.name.endsWith(".json"))
        await readProof(join(path, entry.name));
    }
    return;
  }
  const value = JSON.parse(await readFile(path, "utf8"));
  function collect(record) {
    if (!record || typeof record !== "object") return;
    if (Array.isArray(record)) {
      record.forEach(collect);
      return;
    }
    if (Array.isArray(record.buttons) && record.screen && record.variant) {
      measurements.push(record);
      return;
    }
    Object.values(record).forEach(collect);
  }
  collect(value);
}
for (let index = 0; index < flags.length; index++) {
  if (flags[index] === "--proof") await readProof(flags[index + 1]);
}
const result = {
  sourceChecksum: checksum.digest("hex"),
  note: "Complete source callsite census and required shared-control contract. This is not browser measurement evidence. Rendered states and their actual dimensions are recorded separately by c5-button-audit.spec.ts and capture-design-c5.mjs; conditional states not opened remain source-only.",
  count: inventory.length,
  inventory,
  measuredStates: measurements.length,
  measurements,
};
const output = destination("--output");
if (output) await writeFile(output, JSON.stringify(result, null, 2) + "\n");
else console.log(JSON.stringify(result, null, 2));
const markdown = destination("--markdown");
if (markdown) {
  const safe = (value) =>
    String(value)
      .replace(/\|/g, "\\|")
      .replace(/\s+/g, " ")
      .replace(/</g, "&lt;")
      .trim();
  const rows = [
    "# C5 complete button source census",
    "",
    result.note,
    "",
    `Source checksum: \`${result.sourceChecksum}\`. ${result.count} callsites.`,
    "",
    "| Screen/component | Label (English / Persian) | Style or semantic kind | Radius | Height | Width contract | Callsite |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...inventory.map((entry) => {
      const label =
        entry.labels.map((value) => `${value.en} / ${value.fa}`).join("; ") ||
        `Dynamic: ${entry.dynamicLabel}`;
      return `| ${safe(entry.screen)} | ${safe(label)} | ${safe(entry.style)} | ${entry.radius} | ${entry.height} | ${entry.width} | ${entry.file}:${entry.line} |`;
    }),
  ];
  if (measurements.length) {
    rows.push(
      "",
      "## Actual rendered controls",
      "",
      "These are computed styles and bounding rectangles after fonts and transitions settled. Equivalent repeated controls are grouped; the JSON retains every measured instance. Semantic widgets are listed with their real component-specific shape. A conditional source callsite absent from these scenes is source-only, not silently claimed as exercised.",
      "",
      "| Screen | Label | Style/kind | Radius | Height (px) | Width (px) | Appearance / role | Instances |",
      "| --- | --- | --- | --- | --- | --- | --- | --- |",
    );
    const controls = new Map();
    for (const scene of measurements) {
      for (const control of scene.buttons) {
        const key = [
          scene.screen,
          control.label,
          control.kind,
          control.style,
          control.radius,
          control.height,
          control.width,
          scene.variant,
          scene.role,
        ].join("\0");
        if (!controls.has(key)) controls.set(key, { scene, control, count: 0 });
        controls.get(key).count++;
      }
    }
    for (const { scene, control, count } of controls.values()) {
      rows.push(
        `| ${safe(scene.screen)} | ${safe(control.label)} | ${safe(control.style)} / ${safe(control.kind)} | ${safe(control.radius)} | ${control.height} | ${control.width} | ${safe(scene.variant)} / ${safe(scene.role)} | ${count} |`,
      );
    }
    rows.push(
      "",
      "## Measured state coverage",
      "",
      "| Screen | Appearance | Role | Buttons | Failures |",
      "| --- | --- | --- | --- | --- |",
    );
    for (const scene of measurements)
      rows.push(
        `| ${safe(scene.screen)} | ${safe(scene.variant)} | ${safe(scene.role)} | ${scene.buttons.length} | ${safe(scene.failures.length ? scene.failures.join("; ") : "None")} |`,
      );
  }
  await writeFile(markdown, rows.join("\n") + "\n");
}
