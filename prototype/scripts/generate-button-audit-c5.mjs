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
      const explicitButtonRole = opening.attributes.properties.some(
        (attribute) =>
          ts.isJsxAttribute(attribute) &&
          attribute.name.getText(source) === "role" &&
          attribute.initializer?.getText(source) === '"button"',
      );
      if (
        ["Button", "IconButton", "Menu", "MenuItem", "button"].includes(
          component,
        ) ||
        explicitButtonRole
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
          const classes = attributes.className ?? "";
          const widgetKind = [
            ["label-preview-slot", "physical sheet position"],
            ["sidebar-backdrop", "sidebar dismissal surface"],
            ["supplier-sort", "column sorting"],
            ["ui-sort-button", "column sorting"],
            ["supplier-filter-chip", "filter choice"],
            ["invoice-details-toggle", "section disclosure"],
            ["invoice-line-toggle", "invoice line disclosure"],
            ["ui-date", "date picker trigger"],
            ["ui-calendar-day", "calendar day"],
            ["kpi-card", "KPI navigation card"],
            ["ui-kpi", "KPI navigation card"],
          ].find(([className]) => classes.includes(className))?.[1];
          kind =
            component === "IconButton" ||
            attributes.iconOnly === "true" ||
            classes.includes("lookup-scan-button")
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
                  : (widgetKind ??
                    (component === "button"
                      ? attributes.role?.includes('tabs ? "tab"')
                        ? "tab or segmented choice"
                        : "custom control (see callsite)"
                      : "action"));
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
const measuredFingerprints = new Set();
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
      // Playwright attachments repeat their canonical per-test JSON. Retain a
      // rendered state once when the entire observation is identical.
      const fingerprint = JSON.stringify(record);
      if (!measuredFingerprints.has(fingerprint)) {
        measuredFingerprints.add(fingerprint);
        measurements.push(record);
      }
      return;
    }
    Object.values(record).forEach(collect);
  }
  collect(value);
}
for (let index = 0; index < flags.length; index++) {
  if (flags[index] === "--proof") await readProof(flags[index + 1]);
}
const statusObservations = new Map();
for (const scene of measurements) {
  const language = scene.variant.includes("fa-") ? "fa" : "en";
  const theme = scene.variant.includes("dark") ? "dark" : "light";
  for (const status of scene.statuses ?? []) {
    const key = `${language}\0${theme}\0${status.label}`;
    const observations = statusObservations.get(key) ?? [];
    observations.push({
      screen: scene.screen,
      variant: scene.variant,
      role: scene.role,
      ...status,
    });
    statusObservations.set(key, observations);
  }
}
const crossScreenStatusConflicts = [...statusObservations.entries()]
  .filter(
    ([, observations]) =>
      new Set(
        observations.map((status) => `${status.color}/${status.background}`),
      ).size > 1,
  )
  .map(([key, observations]) => ({
    language: key.split("\0")[0],
    theme: key.split("\0")[1],
    label: key.split("\0")[2],
    observations,
  }));
const result = {
  sourceChecksum: checksum.digest("hex"),
  note: "Complete source callsite census and required shared-control contract. This is not browser measurement evidence. Rendered states and their actual dimensions are recorded separately by c5-button-audit.spec.ts and capture-design-c5.mjs; conditional states not opened remain source-only.",
  count: inventory.length,
  inventory,
  measuredStates: measurements.length,
  crossScreenStatusConflicts,
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
  rows.push(
    "",
    "## Semantic widgets (separate from ordinary text actions)",
    "",
    "These controls retain the layout required by their interaction: calendar cells select dates, sorting headers sort columns, result rows navigate/select records, physical sheet slots choose a print starting position, and segmented choices switch states. Each callsite above and measured instance below remains visible in the audit; this list does not exempt an ordinary action solely because it appears inside a widget.",
    "",
    "| Semantic kind | Callsites |",
    "| --- | --- |",
    ...[
      ...new Set(
        inventory
          .filter((entry) => !["action", "icon"].includes(entry.kind))
          .map((entry) => entry.kind),
      ),
    ]
      .sort()
      .map(
        (kind) =>
          `| ${safe(kind)} | ${inventory
            .filter((entry) => entry.kind === kind)
            .map((entry) => `${entry.file}:${entry.line}`)
            .join("; ")} |`,
      ),
  );
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
      "## Cross-screen status colors",
      "",
      crossScreenStatusConflicts.length
        ? `Conflicts: ${crossScreenStatusConflicts.map((entry) => `${safe(entry.label)} (${entry.language}, ${entry.theme})`).join("; ")}. See the complete observations in the JSON.`
        : `No conflicting colors for the same visible status label within a language and theme across ${statusObservations.size} measured status groups.`,
    );
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
