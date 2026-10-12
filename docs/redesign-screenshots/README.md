# C6 and C7 screenshot review

**Final galleries are pending.** Each pull request needs 85 final screenshots: 17 screens in English light, English dark, Persian, 900 px width and phone dark. Earlier captures, including source `4bb6ac8`, are superseded. They are diagnostic evidence, not the final review set.

Once the final galleries are included, open them without running the app:

1. On Ubuntu, open **Files**; on Mac, open **Finder**. Open your `Supermarket-Inventory` folder, then `docs` → `redesign-screenshots`.
2. Open `pr-c6` or `pr-c7`, then double-click `gallery.html`. If asked which application to use, choose your browser. No Docker, app server or internet connection is needed.
3. Choose a **Screen**, a **Variant** and an **Owner reference**. The candidate and the original appear beside each other. The reference list contains all 14 annotated bugs and five Klead retouches.
4. Use **Previous screenshot** and **Next screenshot** to inspect the complete set. Choose **Actual size** to inspect original pixels, and scroll within each image panel. **Fit to panels** changes only its displayed size.
5. Read **Intentional differences and review boundaries**. Expand **Source, file hashes and individual review record** for that image's source commit, SHA-256, layout results and reviewer notes.

Keep the repository's folder structure intact: the gallery uses relative links to the unchanged PNGs and original references. If an image is missing, check that you downloaded or pulled the complete repository, rather than only the HTML file.

C6 fixes the functional issues and the blocking overlaps. Its remaining presentation differences are recorded explicitly: for example, the final Lookup price/offer hierarchy, calm table rows, form-group surfaces and Dashboard's desktop Recent invoices/Returns row belong to C7. C7 applies the complete Klead presentation while retaining the authorized records, handlers and business rules. Reference sample names, prices and chart data are not replacement app data. A generated gallery is evidence for review; it is not owner approval.

## Generate a final gallery

Maintainers should run this only after the final images, capture manifest and five individual review reports have been saved under the corresponding `pr-c6` or `pr-c7` directory. From the repository folder, use Python 3; there are no additional dependencies. This example generates C6. For C7, change `REVIEW_STAGE=c6` to `REVIEW_STAGE=c7`.

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
  --readme docs/redesign-screenshots/README.md \
  --output "$REVIEW_DIR/gallery.html"
```

Successful generation writes `gallery.html` and `gallery.manifest.json`, and prints a summary showing 85 screenshots, 85 individual reviews, 19 references and no warnings. It does not modify any PNG or source file.

The strict gate checks the full source commit and stage, all 85 unique screen/variant slots, every screenshot SHA-256, all 19 distinct reference hashes and byte counts, a consistent production fingerprint with before/after guards for every capture, positive measured word counts, complete layout results with no failures, no captured browser errors, and a matching `reviews` record with `openedIndividually: true` and no unresolved `realFailures` for every image. Review reports must describe actual individual openings; copying a flag from an older capture is not review. Intentional C6/C7 differences and framing limits remain in those records.

If a check fails, generation stops. Correct or recapture the evidence and repeat its individual review; do not change PNGs or weaken checks to make them pass. `--diagnostic` permits an incomplete or failing set and prominently labels the output **DIAGNOSTIC, NOT FINAL PROOF**. It must never be used for a final pull-request gallery. Static screenshots also cannot prove permissions, financial calculations, file durability, Undo timing or printing; the separate functional test and print reports provide that evidence.
