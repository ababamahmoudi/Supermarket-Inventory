import { useLayoutEffect } from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DemoProvider, initialState, useDemo } from "./store";
import { authenticatedProviderFixture } from "./authority-provider-test-fixture";
import html from "../index.html?raw";
import {
  emptyPreferences,
  readPreferences,
  writePreferences,
} from "./auth-preferences.e1";
import {
  clearRenderedUiReadiness,
  renderedUiReady,
} from "./test/rendered-ui-readiness";

const cleanups: (() => void)[] = [];
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => {
  clearRenderedUiReadiness();
  cleanup();
  cleanups.splice(0).forEach((close) => close());
  vi.unstubAllGlobals();
});
type Session = ReturnType<typeof useDemo>;
function ObserveSession({ onChange }: { onChange: (value: Session) => void }) {
  const value = useDemo();
  useLayoutEffect(() => onChange(value), [value, onChange]);
  return <output>{value.authStage}</output>;
}

it("remembers the displayed user's theme for bootstrap without replacing any saved user preferences", async () => {
  const fixture = await authenticatedProviderFixture({
    state: initialState(),
    role: "manager",
  });
  cleanups.push(fixture.dispose);
  const preferences = emptyPreferences();
  preferences.device_preferences = {
    theme: "light",
    comfortableText: true,
    comfortableTextExplicit: true,
  };
  preferences.by_user_id[fixture.actor.user_id] = {
    theme: "dark",
    comfortableText: false,
    comfortableTextExplicit: true,
  };
  preferences.by_user_id["demo-person-cashier"] = {
    theme: "light",
    comfortableText: false,
  };
  writePreferences(preferences);
  let current!: Session;
  const observe = (value: Session) => {
    current = value;
  };
  render(
    <DemoProvider options={fixture.options}>
      <ObserveSession onChange={observe} />
    </DemoProvider>,
  );
  await renderedUiReady(() => current?.authStage === "complete");
  expect(current.authStage).toBe("complete");
  expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  expect(document.documentElement.style.colorScheme).toBe("dark");
  const saved = readPreferences();
  expect(saved.device_preferences).toEqual({
    ...preferences.device_preferences,
    theme: "dark",
  });
  expect(saved.by_user_id).toEqual(preferences.by_user_id);
  await act(async () => {
    await current.switchDemoUser("cashier");
  });
  expect(current.authStage).toBe("complete");
  expect(current.user?.username).toBe("cashier");
  expect(document.documentElement).toHaveAttribute("data-theme", "light");
  expect(document.documentElement.style.colorScheme).toBe("light");
  expect(readPreferences().device_preferences.theme).toBe("light");
  expect(readPreferences().by_user_id).toEqual(preferences.by_user_id);
  await act(async () => {
    await current.switchDemoUser("manager");
  });
  expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  expect(readPreferences().device_preferences.theme).toBe("dark");
  await act(async () => {
    await current.signOut();
  });
  expect(current.authStage).toBe("signed_out");
  expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  expect(readPreferences().by_user_id).toEqual(preferences.by_user_id);
});

it("retains the bootstrapped legacy dark theme throughout genuine pre-completion startup", async () => {
  const fixture = await authenticatedProviderFixture({
    state: initialState(),
    role: "manager",
  });
  cleanups.push(fixture.dispose);
  const preferences = emptyPreferences();
  preferences.device_preferences.theme = "light";
  preferences.recent_user_ids = [fixture.actor.user_id];
  preferences.by_user_id[fixture.actor.user_id] = {
    theme: "dark",
    comfortableText: false,
  };
  writePreferences(preferences);
  const source = html.match(/<script>\s*([\s\S]*?)\s*<\/script>/)?.[1];
  if (!source) throw new Error("The pre-module theme bootstrap is missing.");
  new Function(source)();
  expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  let prepared!: () => void;
  let release!: () => void;
  const entered = new Promise<void>((resolve) => {
    prepared = resolve;
  });
  const publication = new Promise<void>((resolve) => {
    release = resolve;
  });
  let current!: Session;
  const observe = (value: Session) => {
    current = value;
  };
  try {
    render(
      <DemoProvider
        options={{
          ...fixture.options,
          prepareInitialBusiness: async (repository, companyId) => {
            await fixture.options.prepareInitialBusiness?.(
              repository,
              companyId,
            );
            prepared();
            await publication;
          },
        }}
      >
        <ObserveSession onChange={observe} />
      </DemoProvider>,
    );
    await act(async () => {
      await entered;
    });
    expect(current.authStage).toBe("loading");
    expect(current.actor).toBeNull();
    expect(current.state.products).toEqual([]);
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
    expect(readPreferences().device_preferences.theme).toBe("light");
    expect(readPreferences().by_user_id).toEqual(preferences.by_user_id);
  } finally {
    release();
  }
  await renderedUiReady(() => current?.authStage === "complete");
  expect(current.actor?.user_id).toBe(fixture.actor.user_id);
  expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  expect(readPreferences().device_preferences.theme).toBe("dark");
  expect(readPreferences().by_user_id).toEqual(preferences.by_user_id);
});
