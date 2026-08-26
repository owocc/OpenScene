import { afterEach, describe, expect, test } from "vite-plus/test";
import { createEmptySceneDocument,
createBridgeEnvelope,
type AppManifest, } from "@openscene-ai/core";
import { MessageChannel } from "node:worker_threads";
import { OpenSceneController, defineAppManifest, openSceneDirectives } from "../src/index.ts";
import { evaluateDynamicValue, resolveTemplate } from "../src/solid/evaluate.ts";
import { openSceneManifestPlugin } from "../src/vite.ts";

const manifest: AppManifest = defineAppManifest({
  protocolVersion: "2",
  app: { key: "demo", type: "web" },
  components: {},
});

const delivery = {
  app: { id: "app-1", key: "demo", type: "web" as const },
  page: { id: "page-1", key: "home", title: "Home" },
  document: createEmptySceneDocument(),
};

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

function fetchInputUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

describe("framework-neutral client", () => {
  test("loads and validates a runtime delivery into an immutable document and store", async () => {
    let requested = "";
    globalThis.fetch = async (input) => {
      requested = fetchInputUrl(input);
      return new Response(JSON.stringify(delivery), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };
    const client = new OpenSceneController(
      { apiBaseUrl: "https://admin.example", pageKey: "home", manifest },
      null,
    );
    await client.loadPage();
    const snapshot = client.getSnapshot();
    expect(requested).toBe("https://admin.example/api/v1/runtime/apps/demo/pages/home");
    expect(snapshot.status).toBe("ready");
    expect(Object.isFrozen(snapshot.document)).toBe(true);
    expect(snapshot.runtimeStore?.get("/__scene/pageInfo/title")).toBe("");
    expect(snapshot.runtimeStore).not.toBeNull();
    expect(snapshot.document?.spec).not.toBe(delivery.document.spec);
    client.destroy();
  });

  test("enters observable error state for malformed runtime responses", async () => {
    globalThis.fetch = async () => new Response(JSON.stringify({ invalid: true }), { status: 200 });
    const client = new OpenSceneController(
      { apiBaseUrl: "https://admin.example", pageKey: "home", manifest },
      null,
    );
    await client.loadPage();
    expect(client.getSnapshot().status).toBe("error");
    expect(client.getSnapshot().error?.message).toContain("protocol validation");
    client.destroy();
  });

  test("editor query mode skips runtime fetch and accepts only the matching Studio port", async () => {
    let fetchCalls = 0;
    globalThis.fetch = async () => {
      fetchCalls += 1;
      return new Response();
    };
    const parentMessages: unknown[] = [];
    const parent = { postMessage: (message: unknown) => parentMessages.push(message) };
    const target = Object.assign(new EventTarget(), {
      location: {
        search:
          "?openscene-editor=1&openscene-studio-origin=https%3A%2F%2Fstudio.example&openscene-editor-session=session-1",
      },
      parent,
    }) as unknown as Window;
    const controller = new OpenSceneController(
      { apiBaseUrl: "https://admin.example", pageKey: "home", manifest },
      target,
    );
    expect(fetchCalls).toBe(0);
    expect(parentMessages).toHaveLength(1);
    const channel = new MessageChannel();
    const studioConnect = new MessageEvent("message", {
      data: createBridgeEnvelope("session-1", "STUDIO_CONNECT", undefined),
      origin: "https://studio.example",
      ports: [channel.port2 as unknown as MessagePort],
    });
    Object.defineProperty(studioConnect, "source", { value: parent });
    target.dispatchEvent(studioConnect);
    let resolveDone = () => {};
    const done = new Promise<void>((resolve) => {
      resolveDone = resolve;
    });
    const unsubscribe = controller.subscribe(() => {
      if (controller.getSnapshot().status === "ready") resolveDone();
    });
    channel.port1.postMessage(
      createBridgeEnvelope("session-1", "DOCUMENT_SET", {
        document: delivery.document,
        revision: 7,
      }),
    );
    await done;
    unsubscribe();
    expect(controller.getSnapshot().status).toBe("ready");
    expect(controller.getSnapshot().revision).toBe(7);
    controller.destroy();
    channel.port1.close();
  });
});

describe("Vite manifest plugin", () => {
  test("pushes a complete build manifest once and keeps the key in a header", async () => {
    const previous = {
      admin: process.env.OPENSCENE_ADMIN_URL,
      appId: process.env.OPENSCENE_APP_ID,
      appKey: process.env.OPENSCENE_APP_KEY,
    };
    let calls = 0;
    let sentBody = "";
    let sentHeader = "";
    globalThis.fetch = async (input, init) => {
      calls += 1;
      sentBody = typeof init?.body === "string" ? init.body : "";
      sentHeader = new Headers(init?.headers).get("x-openscene-app-key") ?? "";
      expect(fetchInputUrl(input)).toContain("/api/v1/apps/app-1/manifest/push");
      return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
    };
    process.env.OPENSCENE_ADMIN_URL = "https://admin.example";
    process.env.OPENSCENE_APP_ID = "app-1";
    process.env.OPENSCENE_APP_KEY = "secret-key";
    const plugin = openSceneManifestPlugin({ manifest });
    plugin.configResolved?.({ command: "build", mode: "production", envDir: process.cwd() });
    await plugin.closeBundle?.();
    await plugin.closeBundle?.();
    expect(calls).toBe(1);
    expect(sentHeader).toBe("secret-key");
    expect(sentBody).toContain('"key":"demo"');
    process.env.OPENSCENE_ADMIN_URL = previous.admin;
    process.env.OPENSCENE_APP_ID = previous.appId;
    process.env.OPENSCENE_APP_KEY = previous.appKey;
  });
});

describe("OpenScene directives", () => {
  test("exports the two framework-neutral custom directives", () => {
    expect(openSceneDirectives.map((directive) => directive.name)).toEqual(["$page", "$t"]);
  });
});

describe("Solid SDK Dynamic Evaluation", () => {
  test("evaluates template expressions with {{/path}} and ${/path}", () => {
    const state = { hei: 100, aa: "active" };
    expect(resolveTemplate("{{/hei}}px", state)).toBe("100px");
    expect(resolveTemplate("{{hei}}px", state)).toBe("100px");
    expect(resolveTemplate("${/hei}px", state)).toBe("100px");
    expect(resolveTemplate("${hei}px", state)).toBe("100px");
    expect(resolveTemplate("btn-{{aa}}", state)).toBe("btn-active");
  });

  test("evaluates nested dynamic style properties for components like Image", () => {
    const state = { hei: 100 };
    const rawProps = {
      src: "https://example.com/photo.jpg",
      style: {
        width: { $template: "{{/hei}}px" },
        height: "100px",
      },
    };

    const evaluated = evaluateDynamicValue(rawProps, state) as typeof rawProps;
    expect(evaluated.style).toEqual({
      width: "100px",
      height: "100px",
    });
  });
});
