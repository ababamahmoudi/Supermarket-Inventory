# C6 and C7 screenshot review

**C6 is available:** [open its final comparison gallery](pr-c6/gallery.html), [capture manifest](pr-c6/capture-results.json) and [strict gallery result](pr-c6/gallery.manifest.json). Its 85 original screenshots and 85 individual review records use application source `7862eacfd89558729f72aa9d427fb8a70881d63e`: 17 scenes in English light, English dark, Persian, 900 px and phone dark. The strict gate verified all image/reference hashes, one production fingerprint, complete before/after asset guards and zero browser/layout/review failures. Earlier captured sources are superseded and are not substituted for this final C6 set.

C7 application source is **`ef4dfcc01172f4c7122c940139339fae4d228f5e`**, on `feat/prototype-c7-klead-retouch`. Its fresh capture contains **85 original PNGs**, with zero browser errors/geometry findings and actual exit 0. All **85 originals were freshly opened individually** against the **19 unchanged references**, and the strict gallery gate **passed**, with no warnings/unresolved failures. [Open the final C7 gallery](pr-c7/gallery.html), [capture manifest](pr-c7/capture-results.json), [strict result](pr-c7/gallery.manifest.json) and [differences](pr-c7/differences.json). Latest publication-head [PR20 checks](https://github.com/ababamahmoudi/Supermarket-Inventory/pull/20/checks) remain pending after publication and must pass before merge. The C6 gallery shows C6 fixes with explicit remaining C7 style differences; it is not the final C7 appearance. See the [C6 review guide](../PR_C6_REVIEW.md) and [verification record](../evidence/c6-final-verification.json).

Open either final gallery without running the app:

1. On Ubuntu, open **Files**; on Mac, open **Finder**. Open your `Supermarket-Inventory` folder, then `docs` → `redesign-screenshots`.
2. Open `pr-c6` for functional-fix evidence or `pr-c7` for the complete Klead retouch, then double-click `gallery.html`. If asked which application to use, choose your browser. No Docker, app server or internet connection is needed.
3. Choose a **Screen**, a **Variant** and an **Owner reference**. The candidate and the original appear beside each other. The reference list contains all 14 annotated bugs and five Klead retouches.
4. Use **Previous screenshot** and **Next screenshot** to inspect the complete set. Choose **Actual size** to inspect original pixels, and scroll within each image panel. **Fit to panels** changes only its displayed size.
5. Read **Intentional differences and review boundaries**. Expand **Source, file hashes and individual review record** for that image's source commit, SHA-256, layout results and reviewer notes.

Keep the repository's folder structure intact: the gallery uses relative links to the unchanged PNGs and original references. If an image is missing, check that you downloaded or pulled the complete repository, rather than only the HTML file.

C6 fixes the functional issues and the blocking overlaps. Its remaining presentation differences are recorded explicitly: for example, the final Lookup price/offer hierarchy, calm table rows, form-group surfaces and Dashboard's desktop Recent invoices/Returns row belong to C7. C7 applies the complete Klead presentation while retaining the authorized records and business rules. Shared submenu Escape/back navigation and late focus-frame cancellation intentionally change one UI handler; business callbacks and the remaining compared controls/guards are preserved. Reference sample names, prices and chart data are not replacement app data. A generated gallery is evidence for review; it is not owner approval.

## Generate a final gallery

Maintainers should run this only after the final images, capture manifest, explicit differences notes and five individual review reports have been saved under the corresponding `pr-c6` or `pr-c7` directory. From the repository folder, use Python 3; there are no additional dependencies. This example generates C6. For C7, change `REVIEW_STAGE=c6` to `REVIEW_STAGE=c7`.

```bash
REVIEW_STAGE=c6
REVIEW_DIR="docs/redesign-screenshots/pr-$REVIEW_STAGE"
REVIEW_SOURCE_SHA="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["sourceCommit"])' "$REVIEW_DIR/capture-results.json")"
python3 docs/redesign-screenshots/generate-review-gallery.py \
  --stage "$REVIEW_STAGE" \
  --source-commit "$REVIEW_SOURCE_SHA" \
  --screenshots "$REVIEW_DIR" \
  --capture-manifest "$REVIEW_DIR/capture-results.json" \
  --reference-manifest docs/design-references/c6-c7-owner-reference-manifest.json \
  --docs-root docs \
  --visual-review "$REVIEW_DIR/visual-review-en-light.json" \
  --visual-review "$REVIEW_DIR/visual-review-en-dark.json" \
  --visual-review "$REVIEW_DIR/visual-review-fa-light.json" \
  --visual-review "$REVIEW_DIR/visual-review-mid-900.json" \
  --visual-review "$REVIEW_DIR/visual-review-phone-dark.json" \
  --differences-json "$REVIEW_DIR/differences.json" \
  --readme docs/redesign-screenshots/README.md \
  --output "$REVIEW_DIR/gallery.html"
```

Successful generation writes `gallery.html` and `gallery.manifest.json`, and prints a summary showing 85 screenshots, 85 individual reviews, 19 references and no warnings. It does not modify any PNG or source file.

The strict gate checks the full source commit and stage, all 85 unique screen/variant slots, every screenshot SHA-256, all 19 distinct reference hashes and byte counts, a consistent production fingerprint with before/after guards for every capture, positive measured word counts, complete layout results with no failures, no captured browser errors, and a matching `reviews` record with `openedIndividually: true` and no unresolved real/visual failures for every image. It also rejects explicit failed or diagnostic top-level/per-image verdicts, including `reviewPassed: false`, `strictGalleryEligible: false` and `diagnostic: true`; zero geometry cannot hide a visual failure. Review reports must describe actual individual openings; copying a flag from an older capture is not review. Intentional C6/C7 differences and framing limits remain in those records.

If a check fails, generation stops. Correct or recapture the evidence and repeat its individual review; do not change PNGs or weaken checks to make them pass. `--diagnostic` permits an incomplete or failing set and prominently labels the output **DIAGNOSTIC, NOT FINAL PROOF**. It must never be used for a final pull-request gallery. Static screenshots also cannot prove permissions, financial calculations, file durability, Undo timing or printing; the separate functional test and print reports provide that evidence.
