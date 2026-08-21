import { describe, expect, test } from "vite-plus/test";
import { messages } from "../../app/ui/i18n";
import { buildHref, parseLanguage, parseMode } from "../../app/ui/navigation";

describe("admin navigation context", () => {
  test("defaults invalid modes and languages safely", () => {
    expect(parseMode(undefined)).toBe("standalone");
    expect(parseMode("invalid")).toBe("standalone");
    expect(parseMode("embedded")).toBe("embedded");
    expect(parseLanguage("fr")).toBeUndefined();
    expect(parseLanguage("zh-CN")).toBe("zh-CN");
  });

  test("preserves mode, language, and app scope in links", () => {
    expect(buildHref("/pages", { mode: "embedded", lang: "zh-CN", appId: "app_1" })).toBe(
      "/pages?mode=embedded&lang=zh-CN&appId=app_1",
    );
  });

  test("keeps dictionary keys aligned", () => {
    expect(Object.keys(messages.en).sort()).toEqual(Object.keys(messages["zh-CN"]).sort());
  });
});
