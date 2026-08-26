import { describe, expect, it } from "vite-plus/test";
import { createEmptySceneDocument, type SceneDocument } from "@openscene-ai/core";

import {
  addI18nKeyInDocument,
  convertVariableValue,
  deleteI18nKeyInDocument,
  deleteVariableInDocument,
  findI18nReferences,
  findVariableReferences,
  getDefaultVariableValue,
  getI18nDictionary,
  getI18nKeys,
  getStateVariables,
  inferVariableType,
  isValidVariableKey,
  renameI18nKeyInDocument,
  renameVariableInDocument,
  setI18nValueInDocument,
  setVariableInDocument,
} from "./document";
import { createEditorState, editorReducer } from "./editor-state";

describe("State variables logic for json-render", () => {
  const baseDoc: SceneDocument = {
    ...createEmptySceneDocument(),
    spec: {
      root: "card-1",
      elements: {
        "card-1": {
          type: "Card",
          props: {
            title: { $state: "/title" },
            counter: { $state: "/counter" },
            twoWayText: { $bindState: "/userInput" },
            greeting: { $template: "Hello, {{ name }}! Count is {{ counter }}." },
            rawString: "just text",
          },
          children: ["btn-1"],
        },
        "btn-1": {
          type: "Button",
          props: {
            label: { $state: "counter" },
          },
          visible: { $state: "/isVisible" },
          children: [],
        },
      },
      state: {
        title: "Welcome Page",
        counter: 42,
        userInput: "test input",
        name: "Alice",
        isVisible: true,
        userProfile: { bio: "Engineer", age: 30 },
        tags: ["design", "ui"],
        // Reserved keys
        i18n: { "en-US": { hello: "Hello" }, "zh-CN": { hello: "你好" } },
        lang: "en-US",
      },
    },
  };

  it("extracts state variables including protected lang variable when present", () => {
    const vars = getStateVariables(baseDoc.spec.state);
    const keys = vars.map((v) => v.key);
    expect(keys).toContain("title");
    expect(keys).toContain("counter");
    expect(keys).toContain("userInput");
    expect(keys).toContain("name");
    expect(keys).toContain("isVisible");
    expect(keys).toContain("userProfile");
    expect(keys).toContain("tags");

    // lang is present and marked as protected
    const langVar = vars.find((v) => v.key === "lang");
    expect(langVar).toBeDefined();
    expect(langVar?.isProtected).toBe(true);
    expect(langVar?.value).toBe("en-US");

    // Reserved dictionary keys MUST not be listed as normal user variables
    expect(keys).not.toContain("i18n");
    expect(keys).not.toContain("__scene");
  });

  it("does not include lang variable when not present in state", () => {
    const stateWithoutLang = { title: "Hello", count: 10 };
    const vars = getStateVariables(stateWithoutLang);
    expect(vars.map((v) => v.key)).toEqual(["title", "count"]);
    expect(vars.some((v) => v.key === "lang")).toBe(false);
  });
  it("infers variable types accurately and gets default values including asset paths", () => {
    expect(inferVariableType("hello")).toBe("string");
    expect(inferVariableType("/assets/ast_123/banner.png")).toBe("asset");
    expect(inferVariableType("/api/v1/apps/app_1/assets/ast_2/raw")).toBe("asset");
    expect(inferVariableType("https://cdn.example.com/audio.mp3")).toBe("asset");
    expect(inferVariableType(123)).toBe("number");
    expect(inferVariableType(true)).toBe("boolean");
    expect(inferVariableType({ a: 1 })).toBe("object");
    expect(inferVariableType([1, 2])).toBe("array");
    expect(inferVariableType(null)).toBe("null");

    expect(getDefaultVariableValue("string")).toBe("");
    expect(getDefaultVariableValue("asset")).toBe("");
    expect(getDefaultVariableValue("number")).toBe(0);
    expect(getDefaultVariableValue("boolean")).toBe(false);
    expect(getDefaultVariableValue("object")).toEqual({});
    expect(getDefaultVariableValue("array")).toEqual([]);
    expect(getDefaultVariableValue("null")).toBeNull();
  });

  it("extracts protected asset_base_url variable when present in state", () => {
    const stateWithAssetBase = { asset_base_url: "http://localhost:3000", title: "App" };
    const vars = getStateVariables(stateWithAssetBase);
    const assetBaseVar = vars.find((v) => v.key === "asset_base_url");
    expect(assetBaseVar).toBeDefined();
    expect(assetBaseVar?.isProtected).toBe(true);
    expect(assetBaseVar?.value).toBe("http://localhost:3000");
  });

  it("validates variable keys according to json-render identifier rules", () => {
    expect(isValidVariableKey("counter")).toBe(true);
    expect(isValidVariableKey("user_name")).toBe(true);
    expect(isValidVariableKey("isLoggedIn")).toBe(true);
    expect(isValidVariableKey("$special")).toBe(true);
    expect(isValidVariableKey("item-1")).toBe(true);

    expect(isValidVariableKey("")).toBe(false);
    expect(isValidVariableKey("   ")).toBe(false);
    expect(isValidVariableKey("i18n")).toBe(false);
    expect(isValidVariableKey("lang")).toBe(false);
    expect(isValidVariableKey("__scene")).toBe(false);
    expect(isValidVariableKey("has space")).toBe(false);
  });

  it("converts values across types safely", () => {
    expect(convertVariableValue("123", "number")).toBe(123);
    expect(convertVariableValue(123, "string")).toBe("123");
    expect(convertVariableValue("true", "boolean")).toBe(true);
    expect(convertVariableValue(true, "number")).toBe(1);
    expect(convertVariableValue('{"x": 1}', "object")).toEqual({ x: 1 });
    expect(convertVariableValue("[1, 2]", "array")).toEqual([1, 2]);
  });

  it("finds all variable references in elements props and conditions", () => {
    const titleRefs = findVariableReferences(baseDoc, "title");
    expect(titleRefs.length).toBe(1);
    expect(titleRefs[0].elementId).toBe("card-1");
    expect(titleRefs[0].kind).toBe("$state");

    const counterRefs = findVariableReferences(baseDoc, "counter");
    expect(counterRefs.length).toBe(3); // card-1.props.counter, card-1.props.greeting ($template), btn-1.props.label

    const inputRefs = findVariableReferences(baseDoc, "userInput");
    expect(inputRefs.length).toBe(1);
    expect(inputRefs[0].kind).toBe("$bindState");

    const visibleRefs = findVariableReferences(baseDoc, "isVisible");
    expect(visibleRefs.length).toBe(1);
    expect(visibleRefs[0].elementId).toBe("btn-1");
  });

  it("sets and deletes variables in document", () => {
    const docWithNewVar = setVariableInDocument(baseDoc, "newCounter", 100);
    expect(docWithNewVar.spec.state?.newCounter).toBe(100);

    const docDeleted = deleteVariableInDocument(docWithNewVar, "newCounter");
    expect(docDeleted.spec.state?.newCounter).toBeUndefined();
    expect(docDeleted.spec.state?.title).toBe("Welcome Page");
  });

  it("renames a variable and automatically migrates all references", () => {
    const renamedDoc = renameVariableInDocument(baseDoc, "counter", "totalCount");

    // State key updated
    expect(renamedDoc.spec.state?.counter).toBeUndefined();
    expect(renamedDoc.spec.state?.totalCount).toBe(42);

    // References migrated in element props
    const cardProps = renamedDoc.spec.elements["card-1"].props as Record<string, any>;
    expect(cardProps.counter).toEqual({ $state: "/totalCount" });
    expect(cardProps.greeting).toEqual({
      $template: "Hello, {{ name }}! Count is {{ totalCount }}.",
    });

    const btnProps = renamedDoc.spec.elements["btn-1"].props as Record<string, any>;
    expect(btnProps.label).toEqual({ $state: "totalCount" });
  });

  it("supports editorReducer actions for state variable CRUD with undo/redo", () => {
    const state = createEditorState(baseDoc, 0);

    // 1. Add variable
    const withVar = editorReducer(state, {
      type: "state.setVariable",
      key: "theme",
      value: "dark",
    });
    expect(withVar.document.spec.state?.theme).toBe("dark");
    expect(withVar.past.length).toBe(1);

    // 2. Rename variable
    const renamed = editorReducer(withVar, {
      type: "state.renameVariable",
      oldKey: "theme",
      newKey: "currentTheme",
    });
    expect(renamed.document.spec.state?.theme).toBeUndefined();
    expect(renamed.document.spec.state?.currentTheme).toBe("dark");
    expect(renamed.past.length).toBe(2);

    // 3. Delete variable
    const deleted = editorReducer(renamed, {
      type: "state.deleteVariable",
      key: "currentTheme",
    });
    expect(deleted.document.spec.state?.currentTheme).toBeUndefined();

    // 4. Undo delete
    const undoneDelete = editorReducer(deleted, { type: "history.undo" });
    expect(undoneDelete.document.spec.state?.currentTheme).toBe("dark");

    // 5. Undo rename
    const undoneRename = editorReducer(undoneDelete, { type: "history.undo" });
    expect(undoneRename.document.spec.state?.theme).toBe("dark");

    // 6. Undo add
    const undoneAdd = editorReducer(undoneRename, { type: "history.undo" });
    expect(undoneAdd.document.spec.state?.theme).toBeUndefined();

    // 7. Redo add
    const redoneAdd = editorReducer(undoneAdd, { type: "history.redo" });
    expect(redoneAdd.document.spec.state?.theme).toBe("dark");
  });

  it("extracts i18n keys and dictionary with default locale priority", () => {
    const state = {
      i18n: {
        "en-US": { welcome: "Welcome", title: "My Title" },
        "zh-CN": { welcome: "欢迎", extra: "附加内容" },
      },
    };
    const dict = getI18nDictionary(state);
    expect(dict["en-US"]?.welcome).toBe("Welcome");
    expect(dict["zh-CN"]?.welcome).toBe("欢迎");

    const keys = getI18nKeys(state, "en-US");
    expect(keys).toEqual(["welcome", "title", "extra"]);
  });

  it("adds, edits, renames, and deletes i18n keys across all locales", () => {
    const doc: SceneDocument = {
      ...baseDoc,
      spec: {
        ...baseDoc.spec,
        elements: {
          ...baseDoc.spec.elements,
          "card-1": {
            ...baseDoc.spec.elements["card-1"],
            props: {
              header: { $t: "/i18n/$lang/welcome" },
            },
          },
        },
        state: {
          i18n: {
            "en-US": { welcome: "Welcome" },
            "zh-CN": { welcome: "欢迎" },
          },
        },
      },
    };

    // 1. Check references
    const refs = findI18nReferences(doc, "welcome");
    expect(refs.length).toBe(1);
    expect(refs[0].elementId).toBe("card-1");

    // 2. Add key across all locales
    const docWithNewKey = addI18nKeyInDocument(doc, "button.save", "Save", "en-US", "en-US", [
      "zh-CN",
    ]);
    const dictAfterAdd = getI18nDictionary(docWithNewKey.spec.state);
    expect(dictAfterAdd["en-US"]?.["button.save"]).toBe("Save");
    expect(dictAfterAdd["zh-CN"]?.["button.save"]).toBe("");

    // 3. Edit translation in zh-CN
    const docEdited = setI18nValueInDocument(
      docWithNewKey,
      "zh-CN",
      "button.save",
      "保存",
      "en-US",
      ["zh-CN"],
    );
    const dictAfterEdit = getI18nDictionary(docEdited.spec.state);
    expect(dictAfterEdit["zh-CN"]?.["button.save"]).toBe("保存");
    expect(dictAfterEdit["en-US"]?.["button.save"]).toBe("Save");

    // 4. Rename key -> updates all locales and element dynamic value references
    const docRenamed = renameI18nKeyInDocument(docEdited, "welcome", "greeting.welcome");
    const dictAfterRename = getI18nDictionary(docRenamed.spec.state);
    expect(dictAfterRename["en-US"]?.welcome).toBeUndefined();
    expect(dictAfterRename["en-US"]?.["greeting.welcome"]).toBe("Welcome");
    expect(dictAfterRename["zh-CN"]?.["greeting.welcome"]).toBe("欢迎");

    const updatedProps = docRenamed.spec.elements["card-1"]?.props as Record<
      string,
      { $t?: string }
    >;
    expect(updatedProps?.header?.$t).toBe("/i18n/$lang/greeting.welcome");

    // 5. Delete key -> removes from all locales
    const docDeleted = deleteI18nKeyInDocument(docRenamed, "greeting.welcome");
    const dictAfterDelete = getI18nDictionary(docDeleted.spec.state);
    expect(dictAfterDelete["en-US"]?.["greeting.welcome"]).toBeUndefined();
    expect(dictAfterDelete["zh-CN"]?.["greeting.welcome"]).toBeUndefined();
  });

  it("supports editorReducer actions for i18n CRUD with undo/redo", () => {
    const state = createEditorState(baseDoc, 1);

    // 1. Add i18n key
    const state1 = editorReducer(state, {
      type: "i18n.addKey",
      key: "login.btn",
      value: "Log In",
      currentLocale: "en-US",
      defaultLocale: "en-US",
      allLocales: ["en-US", "zh-CN"],
    });
    const dict1 = getI18nDictionary(state1.document.spec.state);
    expect(dict1["en-US"]?.["login.btn"]).toBe("Log In");
    expect(dict1["zh-CN"]?.["login.btn"]).toBe("");

    // 2. Set translation in zh-CN
    const state2 = editorReducer(state1, {
      type: "i18n.setValue",
      locale: "zh-CN",
      key: "login.btn",
      value: "登录",
      defaultLocale: "en-US",
    });
    const dict2 = getI18nDictionary(state2.document.spec.state);
    expect(dict2["zh-CN"]?.["login.btn"]).toBe("登录");

    // 3. Undo set translation
    const undone = editorReducer(state2, { type: "history.undo" });
    const dictUndone = getI18nDictionary(undone.document.spec.state);
    expect(dictUndone["zh-CN"]?.["login.btn"]).toBe("");

    // 4. Redo set translation
    const redone = editorReducer(undone, { type: "history.redo" });
    const dictRedone = getI18nDictionary(redone.document.spec.state);
    expect(dictRedone["zh-CN"]?.["login.btn"]).toBe("登录");
  });
});
