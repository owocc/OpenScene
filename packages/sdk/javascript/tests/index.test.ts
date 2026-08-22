import { expect, test } from "vite-plus/test";
import { evaluateDynamicValue, setValueByPointer } from "../src/index.ts";

test("evaluates state, page, and template bindings without mutating input state", () => {
  const state = {
    count: 1,
    user: { name: "Ada" },
    __scene: { pageInfo: { title: "OpenScene" } },
  };

  expect(evaluateDynamicValue({ $state: "/user/name" }, state)).toBe("Ada");
  expect(evaluateDynamicValue({ $page: "title" }, state)).toBe("OpenScene");
  expect(evaluateDynamicValue({ $template: "Count: ${/count}" }, state)).toBe("Count: 1");
  expect(setValueByPointer(state, "/user/name", "Grace")).toEqual({
    ...state,
    user: { name: "Grace" },
  });
  expect(state.user.name).toBe("Ada");
});
