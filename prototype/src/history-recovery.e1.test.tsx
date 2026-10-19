import { useState } from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { shellProviderFixture } from "./shell-provider-test-fixture";
import { DemoProvider, initialState, STORAGE_KEY, useDemo } from "./store";
import type { ProviderOptions } from "./store";
import type { DemoState } from "./types";
import {
  AUTHORITY_DATABASE_NAME,
  AuthorityStorageError,
} from "./authority-repository";
import { prepareAuthorityDocument } from "./authority-initialization";
import type { AuthorityDocument } from "./authority-document";
import { createAuthenticationService } from "./authentication-service";
import { credentialVerifier } from "./credentials";
import { readIdentity, writeIdentity } from "./auth-preferences.e1";
import {
  browserFileRepository,
  FILE_DATABASE_NAME,
  FileStorageError,
  readFileStorageBackup,
} from "./file-database";
import { productEditSnapshot, saveProductEdits } from "./product-editor";
import { sha256Bytes } from "./sha256";

const fixtures: ReturnType<typeof shellProviderFixture>[] = [];
const company = () => initialState().config.company.seed_key;
const sha = (raw: string) => sha256Bytes(new TextEncoder().encode(raw));
const backupReference = (raw: string) =>
  `idb-backup:v1:${encodeURIComponent(company())}:${encodeURIComponent(STORAGE_KEY)}:${sha(raw)}`;
function corruptHistory() {
  return JSON.stringify({
    ...initialState(),
    prototype_history_dictionary: {
      version: 1,
      blocks: [],
      bindings: [],
      integrity: "deliberate-history-corruption",
    },
  });
}
function fixture() {
  const result = shellProviderFixture();
  fixtures.push(result);
  return result;
}
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => {
  fixtures.splice(0).forEach((value) => value.dispose());
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
let actionCompleted: Promise<void> = Promise.resolve();
function Probe({
  password = "demo1234",
  secondStepResponse,
}: {
  password?: string;
  secondStepResponse: string;
}) {
  const demo = useDemo();
  const [completed, setCompleted] = useState("");
  const perform = (name: string, operation: () => Promise<unknown>) => {
    actionCompleted = (async () => {
      setCompleted("");
      try {
        await operation();
        setCompleted(`${name}:ok`);
      } catch {
        setCompleted(`${name}:rejected`);
      }
    })();
    return actionCompleted;
  };
  return (
    <>
      <output data-testid="stage">{demo.authStage}</output>
      <output data-testid="recovery">{String(demo.historyLoadError)}</output>
      <output data-testid="visible-name">
        {demo.state.products.find((row) => row.code === "0006")?.name_en ?? ""}
      </output>
      <output data-testid="public-marker">
        {String(Object.hasOwn(demo.state, "prototype_e1_history_recovery"))}
      </output>
      <output data-testid="completed">{completed}</output>
      <button
        onClick={() =>
          void perform("signin", async () => {
            const first = await demo.signIn("manager", password);
            if (first) throw new Error(first);
            const second = await demo.completeSecondStep(secondStepResponse);
            if (second) throw new Error(second);
          })
        }
      >
        Sign in Manager
      </button>
      <button
        onClick={() =>
          void perform("edit", () =>
            demo.command(
              "catalog.edit",
              {
                company_id: company(),
                kind: "company_shared",
                mutation: true,
              },
              (draft, actor) => {
                const product = draft.products.find(
                  (row) => row.code === "0006",
                )!;
                saveProductEdits(
                  draft,
                  actor,
                  product.code,
                  {
                    name_en: "Separate quarantine edit",
                    name_fa: product.name_fa ?? "",
                    description_en: product.description_en ?? "",
                    description_fa: product.description_fa ?? "",
                    unit_size: product.unit_size,
                    ai_category: product.ai_category ?? "",
                    pricing_category: product.pricing_category,
                    barcode: product.barcode ?? "",
                    main_supplier: product.main_supplier,
                    date_tracking: product.date_tracking,
                    scope: "all",
                  },
                  productEditSnapshot(draft, actor, product.code),
                );
              },
            ),
          )
        }
      >
        Edit fictional product
      </button>
      <button onClick={() => void perform("reset", () => demo.reset())}>
        Reset demo
      </button>
      <button onClick={() => void perform("signout", () => demo.signOut())}>
        Sign out
      </button>
    </>
  );
}
async function mount(options: ProviderOptions, password?: string) {
  const result = render(
    <DemoProvider options={options}>
      <Probe
        password={password}
        secondStepResponse={
          options.demoUsers.find((row) => row.username === "manager")!.setup
            .second_step_method === "passkey"
            ? "simulated-passkey"
            : initialState().config.session.simulated_authenticator_code!
        }
      />
    </DemoProvider>,
  );
  await waitFor(() =>
    expect(screen.getByTestId("stage")).not.toHaveTextContent("loading"),
  );
  return result;
}
async function click(name: string, operation: string, outcome = "ok") {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
    await actionCompleted;
  });
  await waitFor(() =>
    expect(screen.getByTestId("completed")).toHaveTextContent(
      `${operation}:${outcome}`,
    ),
  );
}
async function canonical(value: ReturnType<typeof fixture>) {
  return (await value.repository.loadBusiness<DemoState>(company())).state;
}
async function directory(value: ReturnType<typeof fixture>) {
  return (
    await value.repository.transaction(company(), (document) =>
      structuredClone(document),
    )
  ).value;
}
async function removeOnlyBusiness() {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(AUTHORITY_DATABASE_NAME, 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction("business", "readwrite");
      transaction.objectStore("business").delete(company());
      transaction.oncomplete = () => resolve();
      transaction.onabort = transaction.onerror = () =>
        reject(transaction.error);
    });
  } finally {
    database.close();
  }
}
async function authorityEvidence() {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(AUTHORITY_DATABASE_NAME, 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    return await new Promise<AuthorityDocument>((resolve, reject) => {
      const transaction = database.transaction("companies", "readonly");
      const request = transaction.objectStore("companies").get(company());
      let document: AuthorityDocument;
      request.onsuccess = () => {
        document = request.result;
      };
      transaction.oncomplete = () => resolve(document);
      transaction.onabort = transaction.onerror = () =>
        reject(transaction.error);
    });
  } finally {
    database.close();
  }
}
async function verifyOriginal(raw: string) {
  const reference = backupReference(raw);
  expect(await readFileStorageBackup(reference, company())).toBe(raw);
  const backup = await browserFileRepository.getBackup(reference);
  expect(backup?.storage_key).toBe(STORAGE_KEY);
  expect(backup?.sha256).toBe(sha(raw));
  expect(await backup?.raw.text()).toBe(raw);
}

describe("genuine E1 damaged History quarantine and ordered Reset", () => {
  it("verifies original bytes before a separate fictional demo, signs in normally, retains guarded edits and its notice on reload", async () => {
    const value = fixture();
    const raw = corruptHistory();
    localStorage.setItem(STORAGE_KEY, raw);
    const view = await mount(value.options);
    expect(screen.getByTestId("recovery")).toHaveTextContent("true");
    expect(
      screen.getByText(/You are using a separate fictional demo/),
    ).toBeVisible();
    expect(screen.getByTestId("visible-name")).toBeEmptyDOMElement();
    expect(screen.getByTestId("public-marker")).toHaveTextContent("false");
    await verifyOriginal(raw);
    expect((await canonical(value)).prototype_e1_history_recovery?.phase).toBe(
      "quarantined",
    );
    await click("Sign in Manager", "signin");
    await click("Edit fictional product", "edit");
    const after = await canonical(value);
    expect(after.products.find((row) => row.code === "0006")?.name_en).toBe(
      "Separate quarantine edit",
    );
    expect(after.activity.at(-1)?.actor_user_id).toBe("demo-person-manager");
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
    const identity = readIdentity(sessionStorage);
    expect(identity?.company_id).toBe(company());
    view.unmount();
    await mount(value.options);
    expect(screen.getByTestId("stage")).toHaveTextContent("complete");
    expect(screen.getByTestId("visible-name")).toHaveTextContent(
      "Separate quarantine edit",
    );
    expect(screen.getByTestId("recovery")).toHaveTextContent("true");
    expect(readIdentity(sessionStorage)).toEqual(identity);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
    expect(screen.getByTestId("public-marker")).toHaveTextContent("false");
    await verifyOriginal(raw);
  });

  it("keeps the existing directory, retained password and genuine current SID during first quarantine import and reload", async () => {
    const value = fixture();
    const state = initialState();
    const prepared = prepareAuthorityDocument({
      state,
      demo_users: value.options.demoUsers,
      registered_computers: value.options.configuredComputers,
    }).document;
    const credential = prepared.credentials.find(
      (row) => row.user_id === "demo-person-manager",
    )!;
    credential.password_verifier = credentialVerifier(
      "retained-demo-password",
      credential.password_salt,
    );
    await value.repository.initialize(prepared);
    await value.repository.initializeBusiness(state);
    const auth = createAuthenticationService({ repository: value.repository });
    const challenge = await auth.signIn({
      company_id: company(),
      username: "manager",
      password_or_setup_code: "retained-demo-password",
    });
    const actual = await auth.completeSecondStep(
      challenge.identity,
      challenge.person.setup.second_step_method === "passkey"
        ? "simulated-passkey"
        : state.config.session.simulated_authenticator_code!,
    );
    writeIdentity(actual.identity, sessionStorage);
    const original = await directory(value);
    await removeOnlyBusiness();
    const raw = corruptHistory();
    localStorage.setItem(STORAGE_KEY, raw);
    const view = await mount(value.options, "retained-demo-password");
    expect(screen.getByTestId("stage")).toHaveTextContent("complete");
    expect(readIdentity(sessionStorage)).toEqual(actual.identity);
    expect((await directory(value)).credentials).toEqual(original.credentials);
    expect((await directory(value)).people).toEqual(original.people);
    expect(
      (await directory(value)).sessions.find(
        (row) => row.id === actual.identity.session_id,
      )?.revoked_at,
    ).toBeUndefined();
    view.unmount();
    await mount(value.options, "retained-demo-password");
    expect(readIdentity(sessionStorage)).toEqual(actual.identity);
    await click("Sign out", "signout");
    await click("Sign in Manager", "signin");
    expect(screen.getByTestId("stage")).toHaveTextContent("complete");
    expect((await directory(value)).credentials).toEqual(original.credentials);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
  });

  it("uses healthy canonical data and ignores stale corrupt legacy text", async () => {
    const value = fixture();
    const state = initialState();
    state.products.find((row) => row.code === "0006")!.name_en =
      "Healthy canonical business";
    await value.repository.initializeBusiness(state);
    const raw = corruptHistory();
    localStorage.setItem(STORAGE_KEY, raw);
    await mount(value.options);
    await click("Sign in Manager", "signin");
    expect(screen.getByTestId("recovery")).toHaveTextContent("false");
    expect(
      screen.queryByText(/Saved history could not be read/),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("visible-name")).toHaveTextContent(
      "Healthy canonical business",
    );
    expect(
      (await canonical(value)).prototype_e1_history_recovery,
    ).toBeUndefined();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
    expect(
      await browserFileRepository.getBackup(backupReference(raw)),
    ).toBeUndefined();
  });

  it("rejects another company's corrupt dictionary before any backup or canonical import while preserving existing credentials", async () => {
    const value = fixture();
    const state = initialState();
    const existing = prepareAuthorityDocument({
      state,
      demo_users: value.options.demoUsers,
      registered_computers: value.options.configuredComputers,
    }).document;
    await value.repository.initialize(existing);
    const before = await authorityEvidence();
    const foreign = JSON.parse(corruptHistory());
    foreign.config.company.seed_key = "unrelated-company";
    const raw = JSON.stringify(foreign);
    localStorage.setItem(STORAGE_KEY, raw);
    const savedBackup = vi.spyOn(browserFileRepository, "putBackup");
    await mount(value.options);
    expect(
      screen.getByText(/Browser storage could not be read or updated/),
    ).toBeVisible();
    expect(
      screen.queryByText(/You are using a separate fictional demo/),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("visible-name")).toBeEmptyDOMElement();
    expect(screen.getByTestId("public-marker")).toHaveTextContent("false");
    await click("Sign in Manager", "signin", "rejected");
    expect(screen.getByTestId("stage")).toHaveTextContent("signed_out");
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
    expect(savedBackup).not.toHaveBeenCalled();
    expect(
      (await indexedDB.databases()).some(
        (row) => row.name === FILE_DATABASE_NAME,
      ),
    ).toBe(false);
    await expect(canonical(value)).rejects.toThrow(AuthorityStorageError);
    expect(await authorityEvidence()).toEqual(before);
    expect((await authorityEvidence()).credentials).toEqual(
      existing.credentials,
    );
    expect(
      await browserFileRepository.getBackup(backupReference(raw)),
    ).toBeUndefined();
    const foreignReference = `idb-backup:v1:${encodeURIComponent("unrelated-company")}:${encodeURIComponent(STORAGE_KEY)}:${sha(raw)}`;
    expect(
      await browserFileRepository.getBackup(foreignReference),
    ).toBeUndefined();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
  });

  it("blocks first import and sign-in when the original backup cannot commit", async () => {
    const value = fixture();
    const raw = corruptHistory();
    localStorage.setItem(STORAGE_KEY, raw);
    vi.spyOn(browserFileRepository, "putBackup").mockRejectedValueOnce(
      new FileStorageError("quota"),
    );
    await mount(value.options);
    expect(
      screen.getByText(/Browser storage could not be read or updated/),
    ).toBeVisible();
    await click("Sign in Manager", "signin", "rejected");
    expect(screen.getByTestId("visible-name")).toBeEmptyDOMElement();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
    await expect(canonical(value)).rejects.toThrow(AuthorityStorageError);
    await expect(value.repository.load(company())).rejects.toThrow(
      AuthorityStorageError,
    );
  });

  it("rejects first import if actual read-back backup bytes do not match", async () => {
    const value = fixture();
    const raw = corruptHistory();
    localStorage.setItem(STORAGE_KEY, raw);
    const actualPut = browserFileRepository.putBackup;
    vi.spyOn(browserFileRepository, "putBackup").mockImplementationOnce(
      (record) =>
        actualPut({ ...record, raw: new Blob(["changed backup bytes"]) }),
    );
    await mount(value.options);
    expect(screen.getByTestId("visible-name")).toBeEmptyDOMElement();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
    await expect(canonical(value)).rejects.toThrow();
    await expect(value.repository.load(company())).rejects.toThrow();
  });

  it("does not announce a usable fictional quarantine when verified backup metadata is invalid", async () => {
    const value = fixture();
    const raw = corruptHistory();
    localStorage.setItem(STORAGE_KEY, raw);
    await browserFileRepository.putBackup({
      reference: backupReference(raw),
      company_id: company(),
      storage_key: "different-source-key",
      sha256: sha(raw),
      raw: new Blob([raw], { type: "application/json" }),
      saved_at: new Date().toISOString(),
    });
    await mount(value.options);
    expect(
      screen.getByText(
        "Saved history could not be read. Your original data is retained. Allow browser storage, then reload.",
      ),
    ).toBeVisible();
    expect(
      screen.queryByText(/You are using a separate fictional demo/),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("visible-name")).toBeEmptyDOMElement();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
    await expect(canonical(value)).rejects.toThrow();
    await expect(value.repository.load(company())).rejects.toThrow();
  });

  it("uses the actual healthy record that another initializer commits while legacy import is being prepared", async () => {
    const value = fixture();
    const raw = corruptHistory();
    localStorage.setItem(STORAGE_KEY, raw);
    const healthy = initialState();
    healthy.products.find((row) => row.code === "0006")!.name_en =
      "Concurrent healthy canonical business";
    const productionLoad = value.options.loadInitialBusiness;
    await mount({
      ...value.options,
      loadInitialBusiness: async () => {
        const prepared = await productionLoad();
        await value.repository.initializeBusiness(healthy);
        return prepared;
      },
    });
    await click("Sign in Manager", "signin");
    expect(screen.getByTestId("visible-name")).toHaveTextContent(
      "Concurrent healthy canonical business",
    );
    expect(screen.getByTestId("recovery")).toHaveTextContent("false");
    expect(
      (await canonical(value)).prototype_e1_history_recovery,
    ).toBeUndefined();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
    await verifyOriginal(raw);
  });

  it("rejects Reset before any canonical/directory replacement when its original backup fails verification", async () => {
    const value = fixture();
    const raw = corruptHistory();
    localStorage.setItem(STORAGE_KEY, raw);
    await mount(value.options);
    await click("Sign in Manager", "signin");
    await click("Edit fictional product", "edit");
    const before = await canonical(value);
    const peopleBefore = await directory(value);
    vi.spyOn(browserFileRepository, "getBackup").mockRejectedValueOnce(
      new FileStorageError("unavailable"),
    );
    await click("Reset demo", "reset", "rejected");
    expect(await canonical(value)).toEqual(before);
    expect(await directory(value)).toEqual(peopleBefore);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
    expect(screen.getByTestId("recovery")).toHaveTextContent("true");
    expect(
      screen.queryByText(/Demo reset is complete/),
    ).not.toBeInTheDocument();
    await verifyOriginal(raw);
  });

  it("rejects a failed canonical Reset transaction while retaining its directory, edits, raw source and notice", async () => {
    const value = fixture();
    const raw = corruptHistory();
    localStorage.setItem(STORAGE_KEY, raw);
    await mount(value.options);
    await click("Sign in Manager", "signin");
    await click("Edit fictional product", "edit");
    const before = await canonical(value);
    const peopleBefore = await directory(value);
    vi.spyOn(value.repository, "resetDemo").mockRejectedValueOnce(
      new AuthorityStorageError("transaction"),
    );
    await click("Reset demo", "reset", "rejected");
    expect(await canonical(value)).toEqual(before);
    expect(await directory(value)).toEqual(peopleBefore);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
    expect(screen.getByTestId("recovery")).toHaveTextContent("true");
    expect(
      screen.queryByText(/Demo reset is complete/),
    ).not.toBeInTheDocument();
    await verifyOriginal(raw);
  });

  it("records a committed Reset with retirement pending and retries retirement on real-session reload without another Reset", async () => {
    const value = fixture();
    const raw = corruptHistory();
    localStorage.setItem(STORAGE_KEY, raw);
    let view = await mount(value.options);
    await click("Sign in Manager", "signin");
    await click("Edit fictional product", "edit");
    const reset = vi.spyOn(value.repository, "resetDemo");
    const remove = Storage.prototype.removeItem;
    const failure = vi
      .spyOn(Storage.prototype, "removeItem")
      .mockImplementation(function (this: Storage, key: string) {
        if (key === STORAGE_KEY)
          throw new DOMException("Retirement unavailable", "SecurityError");
        return remove.call(this, key);
      });
    await click("Reset demo", "reset");
    expect(reset).toHaveBeenCalledTimes(1);
    expect((await canonical(value)).prototype_e1_history_recovery?.phase).toBe(
      "reset_committed",
    );
    expect(
      (await canonical(value)).products.find((row) => row.code === "0006")
        ?.name_en,
    ).toBe(initialState().products.find((row) => row.code === "0006")!.name_en);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
    expect(screen.getByText(/Demo reset is complete/)).toBeVisible();
    await verifyOriginal(raw);
    const identity = readIdentity(sessionStorage);
    await click("Edit fictional product", "edit");
    const retainedDirectory = await directory(value);
    failure.mockRestore();
    view.unmount();
    view = await mount(value.options);
    await waitFor(() =>
      expect(screen.getByTestId("recovery")).toHaveTextContent("false"),
    );
    expect(reset).toHaveBeenCalledTimes(1);
    expect(
      (await canonical(value)).prototype_e1_history_recovery,
    ).toBeUndefined();
    expect(
      (await canonical(value)).products.find((row) => row.code === "0006")
        ?.name_en,
    ).toBe("Separate quarantine edit");
    expect((await directory(value)).credentials).toEqual(
      retainedDirectory.credentials,
    );
    expect((await directory(value)).people).toEqual(retainedDirectory.people);
    expect(readIdentity(sessionStorage)).toEqual(identity);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(
      screen.queryByText(/Demo reset is complete/),
    ).not.toBeInTheDocument();
    await verifyOriginal(raw);
    view.unmount();
  });

  it("retires the matching legacy source only after successful explicit Reset and retains the exact backup through reload", async () => {
    const value = fixture();
    const raw = corruptHistory();
    localStorage.setItem(STORAGE_KEY, raw);
    const view = await mount(value.options);
    await click("Sign in Manager", "signin");
    await click("Edit fictional product", "edit");
    const oldIdentity = readIdentity(sessionStorage);
    await click("Reset demo", "reset");
    expect(
      (await canonical(value)).prototype_e1_history_recovery,
    ).toBeUndefined();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(screen.getByTestId("recovery")).toHaveTextContent("false");
    expect(
      screen.queryByText(/Saved history could not be read/),
    ).not.toBeInTheDocument();
    const currentDirectory = await directory(value);
    expect(currentDirectory.people).toHaveLength(6);
    expect(readIdentity(sessionStorage)?.session_id).not.toBe(
      oldIdentity?.session_id,
    );
    expect(
      currentDirectory.sessions.some(
        (row) => row.id === oldIdentity?.session_id,
      ),
    ).toBe(false);
    await verifyOriginal(raw);
    view.unmount();
    await mount(value.options);
    expect(screen.getByTestId("recovery")).toHaveTextContent("false");
    expect(
      (await canonical(value)).prototype_e1_history_recovery,
    ).toBeUndefined();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    await verifyOriginal(raw);
  });

  it("clears a rejected backup-attempt notice after a later verified successful Reset", async () => {
    const value = fixture();
    const raw = corruptHistory();
    localStorage.setItem(STORAGE_KEY, raw);
    await mount(value.options);
    await click("Sign in Manager", "signin");
    vi.spyOn(browserFileRepository, "getBackup").mockRejectedValueOnce(
      new FileStorageError("unavailable"),
    );
    await click("Reset demo", "reset", "rejected");
    expect(screen.getByTestId("recovery")).toHaveTextContent("true");
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
    await click("Reset demo", "reset");
    expect(screen.getByTestId("recovery")).toHaveTextContent("false");
    expect(
      screen.queryByText(
        /Browser storage could not be read or updated|Saved history could not be read|Demo reset is complete/,
      ),
    ).not.toBeInTheDocument();
    expect(
      (await canonical(value)).prototype_e1_history_recovery,
    ).toBeUndefined();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    await verifyOriginal(raw);
  });

  it("retains a changed legacy source and rejects Reset instead of deleting unverified new bytes", async () => {
    const value = fixture();
    const raw = corruptHistory();
    localStorage.setItem(STORAGE_KEY, raw);
    await mount(value.options);
    await click("Sign in Manager", "signin");
    const before = await canonical(value);
    const peopleBefore = await directory(value);
    const changed = raw + "\n";
    localStorage.setItem(STORAGE_KEY, changed);
    await click("Reset demo", "reset", "rejected");
    expect(localStorage.getItem(STORAGE_KEY)).toBe(changed);
    expect(await canonical(value)).toEqual(before);
    expect(await directory(value)).toEqual(peopleBefore);
    expect(screen.getByTestId("recovery")).toHaveTextContent("true");
    await verifyOriginal(raw);
  });
});
