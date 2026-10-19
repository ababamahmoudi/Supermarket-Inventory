# Retained failed2ceed74 phone replay

Actual committed source `2ceed74e1ba75cc303c0de1aefcf0e5de7d4d5b0` ran13 native cases:9 passed,4 failed,0 skipped/flaky/retries. Build completed. This is not a clean final result.

The4 compact-list cases failed the newly added unit locator because it assumed `.product-name [lang=en]` in Catalog; Catalog renders UnitText without that markup. The production24cm grouping was not shown to be wrong by these failures. The locator-only correction selected the real phone-name cell and exact English product and kept the visible24cm/single-client-rect checks. A later actual committed replay is recorded separately; this failure was not erased or relabelled.

[Actual verification JSON](2ceed74-failed-native-verification.json). Exact raw top-level runner logs/reports and each4 original error-context Markdown are retained base64+SHA in `2ceed74-failed-native-raw.json.gz`. The original traceZIPs remain in the execution workspace and are not embedded in this small evidence package.
