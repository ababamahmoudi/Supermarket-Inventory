/* global document, requestAnimationFrame, getComputedStyle, NodeFilter */
/** Real rendered geometry proof: word ranges, neighboring cell text, controls and scroll extents. */
export async function inspectResponsiveLayout(page, scene, language, width) {
  await page.evaluate(async () => {
    await document.fonts?.ready;
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
  });
  return page.evaluate(
    ({ scene, language, width }) => {
      const receivingEditor = document.querySelector(".receiving-line-editor");
      const fullScreenEditor =
        receivingEditor &&
        getComputedStyle(receivingEditor).position === "fixed"
          ? receivingEditor
          : null;
      const visible = (element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        const closedDetails = element.closest("details:not([open])");
        const summary = closedDetails?.querySelector(":scope > summary");
        return (
          (!fullScreenEditor ||
            fullScreenEditor.contains(element) ||
            element.contains(fullScreenEditor)) &&
          (!closedDetails ||
            element === closedDetails ||
            summary?.contains(element)) &&
          rect.width > 1 &&
          rect.height > 1 &&
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          !element.closest("dialog:not([open]),[hidden],.sr-only")
        );
      };
      const failures = [];
      const unitFragments = [];
      const tables = [];
      const forms = [];
      let words = 0;
      let cells = 0;
      const documentWidth = document.documentElement.clientWidth;
      const sidebar = document.querySelector(".sidebar");
      const sidebarNav = sidebar?.querySelector("nav");
      const sidebarProof =
        sidebar && visible(sidebar)
          ? {
              width: sidebar.getBoundingClientRect().width,
              clientHeight: sidebar.clientHeight,
              scrollHeight: sidebar.scrollHeight,
              navClientHeight: sidebarNav?.clientHeight ?? 0,
              navScrollHeight: sidebarNav?.scrollHeight ?? 0,
            }
          : null;
      if (
        sidebarProof &&
        (sidebarProof.scrollHeight > sidebarProof.clientHeight + 1 ||
          sidebarProof.navScrollHeight > sidebarProof.navClientHeight + 1)
      )
        failures.push(`${scene}: sidebar needs scrolling`);
      if (document.documentElement.scrollWidth > documentWidth + 1)
        failures.push(
          `Page sideways scroll: ${document.documentElement.scrollWidth}/${documentWidth}`,
        );
      for (const fragment of document.querySelectorAll(".unit-fragment")) {
        if (!visible(fragment)) continue;
        const range = document.createRange();
        range.selectNodeContents(fragment);
        const rects = [...range.getClientRects()].filter(
          (rect) => rect.width > 0.1 && rect.height > 0.1,
        );
        const lines = new Set(rects.map((rect) => Math.round(rect.top)));
        unitFragments.push({ text: fragment.textContent, lines: lines.size });
        if (lines.size > 1)
          failures.push(
            `${scene}: unit fragment broken across lines: ${fragment.textContent}`,
          );
      }
      // Cover unmarked ordinary prose too: the Activity regression used a raw
      // text node, so checking only explicitly tagged product spans missed it.
      const rawUnits = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
      );
      let unitNode;
      const unitExpression =
        /\p{N}+(?:[.,\u066B\u066C]\p{N}+)*\s+(?:kg|g|ml|mL|L|lb|lbs|oz|cm|mm|سانتی[\s\u200c]*متری?|میلی[\s\u200c]*متری?|units?|cases?|packs?|pieces?|گرمی?|کیلوگرمی?|لیتری?|پوندی?|واحد|کارتن|بسته)(?=$|[\s.,()])/gu;
      while ((unitNode = rawUnits.nextNode())) {
        const parent = unitNode.parentElement;
        if (
          !parent ||
          !visible(parent) ||
          parent.closest(
            ".unit-fragment,.sr-only,[aria-hidden=true],script,style",
          )
        )
          continue;
        for (const match of (unitNode.textContent ?? "").matchAll(
          unitExpression,
        )) {
          const range = document.createRange();
          range.setStart(unitNode, match.index);
          range.setEnd(unitNode, match.index + match[0].length);
          const rects = [...range.getClientRects()].filter(
            (rect) => rect.width > 0.1 && rect.height > 0.1,
          );
          if (!rects.length) continue;
          const lines = new Set(rects.map((rect) => Math.round(rect.top)));
          unitFragments.push({
            text: match[0],
            lines: lines.size,
            source: "plain-text",
          });
          if (lines.size > 1)
            failures.push(
              `${scene}: plain-text unit fragment broken across lines: ${match[0]}`,
            );
        }
      }
      for (const wrapper of document.querySelectorAll("main,.ui-data-table")) {
        if (!visible(wrapper)) continue;
        const scrollable = wrapper.matches(
          ".ui-data-table.is-scrollable:not(.is-phone-list)",
        );
        const bounds = wrapper.getBoundingClientRect();
        const parent = wrapper.parentElement.getBoundingClientRect();
        const boundedScroll =
          scrollable &&
          /^(auto|scroll)$/.test(getComputedStyle(wrapper).overflowX) &&
          wrapper.tabIndex >= 0 &&
          bounds.left >= parent.left - 1 &&
          bounds.right <= parent.right + 1;
        if (scrollable && !boundedScroll)
          failures.push(
            "Scrollable table is not contained and keyboard accessible",
          );
        if (wrapper.scrollWidth > wrapper.clientWidth + 1 && !boundedScroll)
          failures.push(
            `${wrapper.className} sideways scroll: ${wrapper.scrollWidth}/${wrapper.clientWidth}`,
          );
      }
      for (const table of document.querySelectorAll(".ui-data-table table")) {
        if (!visible(table)) continue;
        const rows = [];
        for (const row of table.querySelectorAll("tbody tr,thead tr")) {
          if (!visible(row)) continue;
          const rowWords = [];
          for (const cell of row.querySelectorAll(":scope>th,:scope>td")) {
            if (!visible(cell) || cell.colSpan > 1) continue;
            cells++;
            const bounds = cell.getBoundingClientRect();
            const walker = document.createTreeWalker(
              cell,
              NodeFilter.SHOW_TEXT,
            );
            let node;
            while ((node = walker.nextNode())) {
              if (
                !node.parentElement ||
                !visible(node.parentElement) ||
                node.parentElement.closest(".sr-only,[aria-hidden=true]")
              )
                continue;
              const text = node.textContent ?? "";
              const expression =
                /[0-9\u0660-\u0669\u06f0-\u06f9]{4}-[0-9\u0660-\u0669\u06f0-\u06f9]{2}-[0-9\u0660-\u0669\u06f0-\u06f9]{2}|\$?\d[\d,]*(?:\.\d+)?(?:\/\w+)?|[A-Za-z\u0600-\u06ff\u200c]+(?:-[A-Za-z]+)*/gu;
              for (const match of text.matchAll(expression)) {
                const range = document.createRange();
                range.setStart(node, match.index);
                range.setEnd(node, match.index + match[0].length);
                const rects = [...range.getClientRects()].filter(
                  (rect) => rect.width > 0.1 && rect.height > 0.1,
                );
                if (!rects.length) continue;
                words++;
                const lines = new Set(
                  rects.map((rect) => Math.round(rect.top)),
                );
                if (lines.size > 1)
                  failures.push(`${scene}: word broken in middle: ${match[0]}`);
                for (const rect of rects) {
                  if (
                    rect.left < bounds.left - 1 ||
                    rect.right > bounds.right + 1
                  )
                    failures.push(`${scene}: text leaves cell: ${match[0]}`);
                  rowWords.push({
                    text: match[0],
                    cell,
                    left: rect.left,
                    right: rect.right,
                    top: rect.top,
                    bottom: rect.bottom,
                  });
                }
              }
            }
          }
          for (let i = 0; i < rowWords.length; i++)
            for (let j = i + 1; j < rowWords.length; j++) {
              const a = rowWords[i],
                b = rowWords[j];
              if (a.cell === b.cell) continue;
              if (
                Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 &&
                Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1
              )
                failures.push(
                  `${scene}: neighboring values overlap: ${a.text}/${b.text}`,
                );
            }
          const controls = [
            ...row.querySelectorAll("button,input,textarea,[role=combobox]"),
          ]
            .filter(
              (element) =>
                visible(element) && !element.closest(".receiving-line-editor"),
            )
            .map((element) => ({
              element,
              bounds: element.getBoundingClientRect(),
            }));
          for (let i = 0; i < controls.length; i++)
            for (let j = i + 1; j < controls.length; j++) {
              const a = controls[i],
                b = controls[j];
              if (
                a.element.contains(b.element) ||
                b.element.contains(a.element)
              )
                continue;
              if (
                Math.min(a.bounds.right, b.bounds.right) -
                  Math.max(a.bounds.left, b.bounds.left) >
                  1 &&
                Math.min(a.bounds.bottom, b.bounds.bottom) -
                  Math.max(a.bounds.top, b.bounds.top) >
                  1
              )
                failures.push(
                  `${scene}: controls overlap: ${a.element.getAttribute("aria-label") ?? a.element.textContent}/${b.element.getAttribute("aria-label") ?? b.element.textContent}`,
                );
            }
          rows.push({
            cells: row.querySelectorAll(":scope>td,:scope>th").length,
            words: rowWords.length,
          });
        }
        tables.push({
          className: table.parentElement.className,
          rows,
          scrollWidth: table.scrollWidth,
          clientWidth: table.clientWidth,
        });
      }
      const clippedBounds = (element, bounds) => {
        let left = Math.max(0, bounds.left);
        let right = Math.min(documentWidth, bounds.right);
        let top = Math.max(0, bounds.top);
        let bottom = Math.min(
          document.documentElement.clientHeight,
          bounds.bottom,
        );
        for (
          let parent = element.parentElement;
          parent;
          parent = parent.parentElement
        ) {
          const style = getComputedStyle(parent);
          const rect = parent.getBoundingClientRect();
          if (style.overflowX !== "visible") {
            left = Math.max(left, rect.left);
            right = Math.min(right, rect.right);
          }
          if (style.overflowY !== "visible") {
            top = Math.max(top, rect.top);
            bottom = Math.min(bottom, rect.bottom);
          }
          // A fixed editor/footer escapes the background table's scroll frame.
          if (style.position === "fixed") break;
        }
        if (
          fullScreenEditor?.contains(element) &&
          !element.closest(".receiving-line-footer")
        ) {
          const footer = fullScreenEditor.querySelector(
            ".receiving-line-footer",
          );
          if (footer && getComputedStyle(footer).position === "fixed")
            bottom = Math.min(bottom, footer.getBoundingClientRect().top);
        }
        return right - left > 0.1 && bottom - top > 0.1
          ? { left, right, top, bottom }
          : null;
      };
      const overlap = (a, b) =>
        Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 &&
        Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
      // DOM text ranges include a font's unused ascent/descent. Adjacent
      // Persian/Latin lines can have overlapping font boxes while their
      // painted glyphs remain separate. Retain DOM ranges for wrapping and
      // containment, and use the loaded font's actual ink for collisions.
      const context = document.createElement("canvas").getContext("2d");
      const metricCache = new Map();
      const inkBounds = (element, text, rect) => {
        if (!context) return rect;
        const style = getComputedStyle(element);
        const font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        const key = `${font}\n${text}`;
        let metrics = metricCache.get(key);
        if (!metrics) {
          context.font = font;
          metrics = context.measureText(text);
          metricCache.set(key, metrics);
        }
        const fontHeight =
          metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent;
        if (
          !Number.isFinite(fontHeight) ||
          fontHeight <= 0 ||
          !Number.isFinite(metrics.actualBoundingBoxAscent) ||
          !Number.isFinite(metrics.actualBoundingBoxDescent)
        )
          return rect;
        const scale = rect.height / fontHeight;
        const baseline = rect.top + metrics.fontBoundingBoxAscent * scale;
        return {
          left: rect.left,
          right: rect.right,
          top: baseline - metrics.actualBoundingBoxAscent * scale,
          bottom: baseline + metrics.actualBoundingBoxDescent * scale,
        };
      };
      for (const form of document.querySelectorAll(
        "dialog[open],main form,.receiving-line-editor",
      )) {
        if (!visible(form)) continue;
        for (const container of [
          form,
          ...form.querySelectorAll(
            "form,.product-editor-body,.product-date-editor,.product-editor-date-row,.product-editor-date-inline,.product-editor-date-fields,.form-grid",
          ),
        ]) {
          if (
            visible(container) &&
            !container.querySelector(
              ".operational-print-document,.shelf-label,.return-memo-document,.print-sheet",
            ) &&
            container.scrollWidth > container.clientWidth + 1
          )
            failures.push(
              `${scene}: form container clips sideways: ${container.className} ${container.scrollWidth}/${container.clientWidth}`,
            );
        }
        const controls = [
          ...form.querySelectorAll(
            "button,input:not([type=file]):not([type=hidden]),textarea,[role=combobox]",
          ),
        ]
          .filter(visible)
          .flatMap((element) => {
            const actual = element.getBoundingClientRect();
            const bounds = clippedBounds(element, actual);
            if (
              bounds &&
              (bounds.left > actual.left + 1 || bounds.right < actual.right - 1)
            )
              failures.push(
                `${scene}: form control clips sideways: ${element.getAttribute("aria-label") ?? element.textContent}`,
              );
            return bounds ? [{ element, bounds }] : [];
          });
        for (let i = 0; i < controls.length; i++)
          for (let j = i + 1; j < controls.length; j++) {
            const a = controls[i],
              b = controls[j];
            if (
              !a.element.contains(b.element) &&
              !b.element.contains(a.element) &&
              overlap(a.bounds, b.bounds)
            )
              failures.push(
                `${scene}: form controls overlap: ${a.element.getAttribute("aria-label") ?? a.element.textContent}/${b.element.getAttribute("aria-label") ?? b.element.textContent}`,
              );
          }
        const walker = document.createTreeWalker(form, NodeFilter.SHOW_TEXT);
        let node;
        let formWords = 0;
        while ((node = walker.nextNode())) {
          const element = node.parentElement;
          if (
            !element ||
            !visible(element) ||
            element.closest(
              ".sr-only,[aria-hidden=true],.operational-print-document,.shelf-label,.return-memo-document",
            )
          )
            continue;
          const text = node.textContent ?? "";
          for (const match of text.matchAll(
            /[0-9\u0660-\u0669\u06f0-\u06f9]{4}-[0-9\u0660-\u0669\u06f0-\u06f9]{2}-[0-9\u0660-\u0669\u06f0-\u06f9]{2}|\$?\d[\d,]*(?:\.\d+)?(?:\/\w+)?|[A-Za-z\u0600-\u06ff\u200c]+(?:-[A-Za-z]+)*/gu,
          )) {
            const range = document.createRange();
            range.setStart(node, match.index);
            range.setEnd(node, match.index + match[0].length);
            const rects = [...range.getClientRects()].flatMap((rect) => {
              const painted = clippedBounds(element, rect);
              return painted ? [painted] : [];
            });
            if (!rects.length) continue;
            formWords++;
            if (new Set(rects.map((rect) => Math.round(rect.top))).size > 1)
              failures.push(
                `${scene}: form word broken in middle: ${match[0]}`,
              );
            for (const rect of rects)
              for (const control of controls)
                if (
                  !control.element.contains(element) &&
                  !element.contains(control.element) &&
                  overlap(rect, control.bounds)
                )
                  failures.push(
                    `${scene}: form text/control overlap: ${match[0]}/${control.element.getAttribute("aria-label") ?? control.element.textContent}`,
                  );
          }
        }
        forms.push({
          className: form.className,
          scrollWidth: form.scrollWidth,
          clientWidth: form.clientWidth,
          words: formWords,
          controls: controls.length,
        });
        words += formWords;
      }
      // Cards and Lookup contain no table/form. Measure their actual text too,
      // including KPI graphics, rather than accepting an empty word sample.
      let contentWords = 0;
      const main = document.querySelector("main");
      if (main && !document.querySelector("dialog[open]")) {
        const controls = [
          ...main.querySelectorAll(
            "button,input,textarea,[role=combobox],.ui-kpi-icon,.kpi-icon",
          ),
        ].filter(
          (element) =>
            visible(element) &&
            !element.closest(
              "form,table,.receiving-line-editor,.operational-print-document,.return-memo-document,.print-sheet",
            ),
        );
        const wordBounds = [];
        const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
        let node;
        while ((node = walker.nextNode())) {
          const element = node.parentElement;
          if (
            !element ||
            !visible(element) ||
            element.closest(
              "form,table,.receiving-line-editor,svg,.sr-only,[aria-hidden=true],.operational-print-document,.shelf-label,.return-memo-document,.print-sheet",
            )
          )
            continue;
          const bounds = element.getBoundingClientRect();
          for (const match of (node.textContent ?? "").matchAll(
            /[0-9\u0660-\u0669\u06f0-\u06f9]{4}-[0-9\u0660-\u0669\u06f0-\u06f9]{2}-[0-9\u0660-\u0669\u06f0-\u06f9]{2}|\$?\d[\d,]*(?:\.\d+)?(?:\/\w+)?|[A-Za-z\u0600-\u06ff\u200c]+(?:-[A-Za-z]+)*/gu,
          )) {
            const range = document.createRange();
            range.setStart(node, match.index);
            range.setEnd(node, match.index + match[0].length);
            const rects = [...range.getClientRects()].filter(
              (rect) => rect.width > 0.1 && rect.height > 0.1,
            );
            if (!rects.length) continue;
            contentWords++;
            if (new Set(rects.map((rect) => Math.round(rect.top))).size > 1)
              failures.push(
                `${scene}: content word broken in middle: ${match[0]}`,
              );
            for (const rect of rects) {
              if (rect.left < bounds.left - 1 || rect.right > bounds.right + 1)
                failures.push(
                  `${scene}: content text leaves container: ${match[0]}`,
                );
              const paintedBounds = inkBounds(element, match[0], rect);
              wordBounds.push({
                element,
                text: match[0],
                bounds: paintedBounds,
              });
              for (const control of controls) {
                if (control.contains(element) || element.contains(control))
                  continue;
                if (overlap(paintedBounds, control.getBoundingClientRect()))
                  failures.push(
                    `${scene}: content text/control overlap: ${match[0]}/${control.getAttribute("aria-label") ?? control.className}`,
                  );
              }
            }
          }
        }
        for (let i = 0; i < wordBounds.length; i++)
          for (let j = i + 1; j < wordBounds.length; j++) {
            const a = wordBounds[i],
              b = wordBounds[j];
            if (
              a.element === b.element ||
              a.element.contains(b.element) ||
              b.element.contains(a.element)
            )
              continue;
            if (overlap(a.bounds, b.bounds))
              failures.push(
                `${scene}: content words overlap: ${a.text}/${b.text}`,
              );
          }
        words += contentWords;
      }
      const topbar = document.querySelector(".topbar");
      const shellControls = topbar
        ? [...topbar.children].filter(visible).map((element) => ({
            element,
            bounds: element.getBoundingClientRect(),
          }))
        : [];
      for (let i = 0; i < shellControls.length; i++)
        for (let j = i + 1; j < shellControls.length; j++) {
          const a = shellControls[i],
            b = shellControls[j];
          if (
            Math.min(a.bounds.right, b.bounds.right) -
              Math.max(a.bounds.left, b.bounds.left) >
              1 &&
            Math.min(a.bounds.bottom, b.bounds.bottom) -
              Math.max(a.bounds.top, b.bounds.top) >
              1
          )
            failures.push(
              `${scene}: topbar overlap: ${a.element.className}/${b.element.className}`,
            );
        }
      return {
        scene,
        language,
        width,
        actualWidth: documentWidth,
        words,
        contentWords,
        unitFragments,
        collisionGeometry:
          "loaded-font actual glyph ink; DOM ranges for wrapping and containment",
        cells,
        tables,
        forms,
        sidebar: sidebarProof,
        topbar: shellControls.map(({ element, bounds }) => ({
          className: element.className,
          width: bounds.width,
          height: bounds.height,
        })),
        failures: [...new Set(failures)],
      };
    },
    { scene, language, width },
  );
}
