/* eslint-disable react-refresh/only-export-components -- This test-only module exports real Provider fixture lifecycle helpers and a test wrapper; it is never a production Fast Refresh boundary. */
/** Test-only real Provider boundary; application authority is never replaced. */
import { type ReactNode } from "react";
import { cleanup, render, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { DemoProvider, initialState, useDemo } from "./store";
import { authenticatedProviderFixture } from "./authority-provider-test-fixture";
import type { RoleId } from "./authority-types";

let fixture: Awaited<ReturnType<typeof authenticatedProviderFixture>> | null =
  null;

export async function prepareSharedUiFixture() {
  if (fixture) throw new Error("Previous Shared UI fixture was not disposed");
  localStorage.clear();
  sessionStorage.clear();
  fixture = await authenticatedProviderFixture({
    state: initialState,
    role: "manager",
  });
}

export function sharedUiCanonical() {
  if (!fixture) throw new Error("Shared UI fixture is not ready");
  return fixture.readCanonical();
}

function ActorReady({ children }: { children: ReactNode }) {
  const { actor, authStage, demoUsers } = useDemo();
  const ready = Boolean(actor && authStage === "complete");
  return (
    <>
      <output
        hidden
        data-testid="shared-ui-actor-ready"
        data-ready={ready ? "true" : "false"}
        data-user-id={actor?.user_id ?? ""}
        data-session-id={actor?.session_id ?? ""}
        data-demo-ready={
          demoUsers.some((person) => person.role === "manager") &&
          demoUsers.some((person) => person.role === "floor_worker")
            ? "true"
            : "false"
        }
        data-role={actor?.role ?? ""}
        data-location={actor?.branch ?? ""}
      />
      {ready ? children : null}
    </>
  );
}

export function AuthenticatedUiProvider({ children }: { children: ReactNode }) {
  if (!fixture) throw new Error("Shared UI fixture is not ready");
  return (
    <DemoProvider options={fixture.options}>
      <ActorReady>{children}</ActorReady>
    </DemoProvider>
  );
}

/** Waits for the actual mounted SDK actor, without adding or weakening an oracle. */
export async function waitForSharedUiActor(
  role?: RoleId,
  location?: string,
  previousSessionId?: string,
) {
  await waitFor(
    () => {
      const marker = document.querySelector(
        '[data-testid="shared-ui-actor-ready"]',
      );
      if (
        marker?.getAttribute("data-ready") !== "true" ||
        !marker.getAttribute("data-user-id") ||
        marker.getAttribute("data-demo-ready") !== "true" ||
        (previousSessionId &&
          marker.getAttribute("data-session-id") === previousSessionId) ||
        (role && marker.getAttribute("data-role") !== role) ||
        (location && marker.getAttribute("data-location") !== location)
      )
        throw new Error(
          "Waiting for the actual authenticated Shared UI session",
        );
    },
    { timeout: 10000 },
  );
}

export function sharedUiSessionId(): string {
  const id = document
    .querySelector('[data-testid="shared-ui-actor-ready"]')
    ?.getAttribute("data-session-id");
  if (!id) throw new Error("Actual Shared UI session is not ready");
  return id;
}

export async function renderAuthenticatedUI(content: ReactNode) {
  const view = render(content);
  await waitForSharedUiActor();
  return view;
}

export function disposeSharedUiFixture() {
  // Unmount first so no Provider job can run against a disposed repository.
  cleanup();
  fixture?.dispose();
  fixture = null;
  vi.unstubAllGlobals();
}
