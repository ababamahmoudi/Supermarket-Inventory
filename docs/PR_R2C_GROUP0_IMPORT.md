# R2c receiving import changes

## 0.7 Handwritten delivery time

Unqualified handwritten hours 1–6 use the afternoon when it falls in the configured invoice delivery window (06:00–20:00 by default). A retained alternative supports one-click correction; handwriting remains a check. Explicit AM/PM and 13–23 are used as written. Opening hours do not infer delivery time. North York's seeded opening hours are Open 24 hours. Both clocks display 24-hour time.

To test: import an invented reading with `Aug 11 2:15`, open Invoice details and see 14:15 with Use 02:15 instead; click it and verify the Received time changes and its check clears. Explicit `2:15 am` stays 02:15.
