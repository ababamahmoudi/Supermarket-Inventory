import { useEffect } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { navigationKey, readNavigationValue, useListState } from "./navigation";

const demo = vi.hoisted(() => ({
  value: {
    state: { config: { company: { seed_key: "fictional-filter-company" } } },
    user: { username: "fictional-manager" },
    branch: "Branch 1",
  },
}));
vi.mock("./store", () => ({ useDemo: () => demo.value }));

beforeEach(() => {
  sessionStorage.clear();
  demo.value = {
    state: { config: { company: { seed_key: "fictional-filter-company" } } },
    user: { username: "fictional-manager" },
    branch: "Branch 1",
  };
});
afterEach(cleanup);

it("keeps setters stable with inline initializers and applies queued functional changes", () => {
  const { result, rerender } = renderHook(() =>
    useListState("test.functional", () => 3),
  );
  const setter = result.current[1];
  rerender();
  expect(result.current[1]).toBe(setter);
  act(() => {
    setter((value) => value + 1);
    setter((value) => value + 1);
  });
  expect(result.current[0]).toBe(5);
  expect(result.current[1]).toBe(setter);
  expect(
    readNavigationValue(
      navigationKey(
        "fictional-filter-company",
        "fictional-manager",
        "Branch 1",
        "test.functional",
      ),
      0,
    ),
  ).toBe(5);
});

it("does not schedule a render for setting the current value again", () => {
  let renders = 0;
  const { result } = renderHook(() => {
    renders += 1;
    return useListState("test.same", "open");
  });
  const before = renders;
  act(() => result.current[1]("open"));
  expect(result.current[0]).toBe("open");
  expect(renders).toBe(before);
});

it("adopts route filters once and still lets a person change them", () => {
  let renders = 0;
  function RouteFilters() {
    renders += 1;
    const [supplier, setSupplier] = useListState(
      "test.route.supplier",
      () => "all",
    );
    const [status, setStatus] = useListState("test.route.status", "all");
    useEffect(() => {
      setSupplier("Fictional Orchard Supply");
      setStatus("open");
    }, [setSupplier, setStatus]);
    return (
      <button onClick={() => setStatus("history")}>
        {supplier} · {status}
      </button>
    );
  }
  render(<RouteFilters />);
  expect(screen.getByRole("button")).toHaveTextContent(
    "Fictional Orchard Supply · open",
  );
  fireEvent.click(screen.getByRole("button"));
  expect(screen.getByRole("button")).toHaveTextContent(
    "Fictional Orchard Supply · history",
  );
  expect(renders).toBeLessThanOrEqual(4);
});

it("restores independent company/person/location values and initializes new keys with the current default", () => {
  let defaultValue = "first default";
  const { result, rerender } = renderHook(() =>
    useListState("test.scope", () => defaultValue),
  );
  act(() => result.current[1]("Branch 1 saved"));
  demo.value.branch = "Branch 2";
  defaultValue = "second default";
  rerender();
  expect(result.current[0]).toBe("second default");
  act(() => result.current[1]("Branch 2 saved"));
  demo.value.user.username = "fictional-worker";
  rerender();
  expect(result.current[0]).toBe("second default");
  act(() => result.current[1]("worker saved"));
  demo.value.state.config.company.seed_key = "fictional-other-company";
  rerender();
  expect(result.current[0]).toBe("second default");
  demo.value.state.config.company.seed_key = "fictional-filter-company";
  rerender();
  expect(result.current[0]).toBe("worker saved");
  demo.value.user.username = "fictional-manager";
  rerender();
  expect(result.current[0]).toBe("Branch 2 saved");
  demo.value.branch = "Branch 1";
  rerender();
  expect(result.current[0]).toBe("Branch 1 saved");
});
