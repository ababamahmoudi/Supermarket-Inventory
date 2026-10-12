/* global document, getComputedStyle, NodeFilter, requestAnimationFrame */
/** Sample computed colors and composite alpha, ancestor opacity and brightness filters for actual visible text. */
export async function inspectTextContrast(page, scene, variant) {
  await page.evaluate(async () => {
    await document.fonts?.ready;
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
  });
  return page.evaluate(
    ({ scene, variant }) => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      const colors = new Map();
      const parse = (value) => {
        if (colors.has(value)) return colors.get(value);
        context.clearRect(0, 0, 1, 1);
        context.fillStyle = value;
        context.fillRect(0, 0, 1, 1);
        const data = [...context.getImageData(0, 0, 1, 1).data];
        const color = [...data.slice(0, 3), data[3] / 255];
        colors.set(value, color);
        return color;
      };
      const blend = (top, bottom) =>
        top
          .slice(0, 3)
          .map(
            (channel, index) => channel * top[3] + bottom[index] * (1 - top[3]),
          )
          .concat(1);
      const luminance = (color) =>
        color
          .slice(0, 3)
          .map((channel) => channel / 255)
          .map((value) =>
            value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
          )
          .reduce(
            (total, value, index) =>
              total + value * [0.2126, 0.7152, 0.0722][index],
            0,
          );
      const ratio = (a, b) => {
        const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
        return (values[0] + 0.05) / (values[1] + 0.05);
      };
      const samples = [];
      const failures = [];
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
      );
      let node;
      while ((node = walker.nextNode())) {
        const element = node.parentElement;
        const text = node.textContent?.trim();
        if (
          !element ||
          !text ||
          element.closest(
            "script,style,.sr-only,.visually-hidden,[aria-hidden=true],[hidden],dialog:not([open]),.shelf-label,.operational-print-document,.print-sheet,.return-memo-document",
          )
        )
          continue;
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        if (
          rect.width < 1 ||
          rect.height < 1 ||
          style.visibility === "hidden" ||
          style.display === "none" ||
          style.clipPath !== "none"
        )
          continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        const bounds = [...range.getClientRects()].filter(
          (r) => r.width > 1 && r.height > 1,
        );
        if (!bounds.length) continue;
        sampleText(element, text, style.color, "text");
      }
      for (const element of document.querySelectorAll(
        "input:not([type=file]):not([type=hidden]),textarea",
      )) {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        if (
          rect.width < 2 ||
          rect.height < 2 ||
          style.visibility === "hidden" ||
          style.display === "none" ||
          style.clipPath !== "none" ||
          element.closest(
            "[hidden],dialog:not([open]),.sr-only,.visually-hidden",
          )
        )
          continue;
        const text = element.value
          ? element.type === "password"
            ? "••••"
            : element.value
          : element.getAttribute("placeholder");
        if (!text) continue;
        const placeholder = !element.value;
        sampleText(
          element,
          text,
          placeholder
            ? getComputedStyle(element, "::placeholder").color
            : style.color,
          placeholder ? "placeholder" : "input-value",
        );
      }
      function sampleText(element, text, color, kind) {
        const layers = [];
        for (let current = element; current; current = current.parentElement)
          layers.unshift({
            element: current,
            style: getComputedStyle(current),
          });
        let background = [255, 255, 255, 1];
        const plains = [];
        for (const layer of layers) {
          background = blend(parse(layer.style.backgroundColor), background);
          plains.push(background);
        }
        let foreground = blend(parse(color), background);
        for (let index = layers.length - 1; index >= 0; index--) {
          const layer = layers[index];
          const brightness = layer.style.filter.match(/brightness\(([^)]+)\)/);
          if (brightness) {
            const factor = brightness[1].endsWith("%")
              ? parseFloat(brightness[1]) / 100
              : parseFloat(brightness[1]);
            foreground = foreground
              .slice(0, 3)
              .map((channel) => Math.min(255, channel * factor))
              .concat(1);
            background = background
              .slice(0, 3)
              .map((channel) => Math.min(255, channel * factor))
              .concat(1);
          }
          const opacity = parseFloat(layer.style.opacity);
          if (opacity < 1) {
            const backdrop = index ? plains[index - 1] : [255, 255, 255, 1];
            foreground = blend([...foreground.slice(0, 3), opacity], backdrop);
            background = blend([...background.slice(0, 3), opacity], backdrop);
          }
        }
        const contrast = ratio(foreground, background);
        const sample = {
          text: text.slice(0, 120),
          tag: element.tagName,
          className:
            typeof element.className === "string" ? element.className : "",
          color,
          kind,
          compositedForeground: foreground.slice(0, 3).map(Math.round),
          compositedBackground: background.slice(0, 3).map(Math.round),
          contrast: Math.round(contrast * 10000) / 10000,
          disabled: Boolean(
            element.disabled || element.closest(":disabled,.is-disabled"),
          ),
          focused:
            element === document.activeElement ||
            Boolean(element.closest(":focus-visible")),
          hovered: element.matches(":hover"),
        };
        samples.push(sample);
        if (contrast < 4.5) failures.push(sample);
      }
      return {
        scene,
        variant,
        width: document.documentElement.clientWidth,
        samples,
        minimum: samples.length
          ? Math.min(...samples.map((sample) => sample.contrast))
          : null,
        failures,
      };
    },
    { scene, variant },
  );
}
