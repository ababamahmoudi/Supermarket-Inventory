import type { Page } from "@playwright/test";
import { AUTHORITY_DATABASE_NAME } from "../src/authority-repository";
import sourceConfig from "../../seed/arzon-config.json" with { type: "json" };
import retainedConfig from "../src/compat/configuration.json" with { type: "json" };
import type { DemoState } from "../src/types";

/**
 * Test evidence from the app's actual company-scoped business record.
 * This performs a native readonly IndexedDB transaction. It does not initialize
 * a database, mirror business data to localStorage, mint an actor, or bypass a
 * production query. Tests still sign in and perform actions through the UI.
 */
export async function readCanonicalBusinessEvidence(
  page: Page,
  traceLabel?: string,
): Promise<DemoState> {
  return page.evaluate(
    ({ databaseName, companyId, traceLabel }) =>
      new Promise<DemoState>((resolve, reject) => {
        const started = performance.now();
        const trace = (phase: string) => {
          if (traceLabel) {
            console.info(
              `[canonical-evidence:${traceLabel}] ${phase} ${Math.round(performance.now() - started)}ms`,
            );
          }
        };
        trace("evaluate entered");
        const open = indexedDB.open(databaseName);
        const fail = (message: string, database?: IDBDatabase) => {
          trace(message);
          database?.close();
          reject(new Error(message));
        };
        open.onupgradeneeded = () => {
          // Evidence must never create or upgrade the app's business database.
          open.transaction?.abort();
          fail("The canonical business database has not been initialized.");
        };
        open.onerror = () =>
          fail("Cannot open the canonical business database.");
        open.onblocked = () =>
          fail("The canonical business database is blocked.");
        open.onsuccess = () => {
          trace("database open");
          const database = open.result;
          database.onversionchange = () => database.close();
          if (!database.objectStoreNames.contains("business")) {
            fail("The canonical business store is missing.", database);
            return;
          }
          const transaction = database.transaction("business", "readonly");
          trace("transaction created");
          const request = transaction.objectStore("business").get(companyId);
          let state: DemoState | undefined;
          request.onsuccess = () => {
            trace("record read");
            const record = request.result;
            if (
              record?.company_id !== companyId ||
              record.state?.config?.company?.seed_key !== companyId ||
              !Number.isSafeInteger(record.revision)
            ) {
              transaction.abort();
              return;
            }
            state = record.state;
          };
          transaction.oncomplete = () => {
            trace("transaction complete");
            database.close();
            if (!state) {
              reject(
                new Error(
                  "The configured company's business record is missing.",
                ),
              );
              return;
            }
            resolve(state);
          };
          transaction.onabort = transaction.onerror = () =>
            fail(
              "Cannot read the configured company's canonical business record.",
              database,
            );
        };
      }),
    {
      databaseName: AUTHORITY_DATABASE_NAME,
      companyId: { ...retainedConfig.company, ...sourceConfig.company }
        .seed_key,
      traceLabel,
    },
  );
}
