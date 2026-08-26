import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  createBridgeEnvelope,
  createEmptySceneDocument,
  type PublishedSceneDocument,
  type SceneManifest,
} from "@openscene-ai/core";
import { MessageChannel } from "node:worker_threads";
import { OpenSceneController, openSceneDirectives } from "../src/index.ts";
import { evaluateDynamicValue, resolveTemplate } from "../src/solid/evaluate.ts";
import { openSceneManifestPlugin } from "../src/vite.ts";

const delivery: PublishedSceneDocument = {
  schemaVersion: "1",
  page: { key: "home", title: "Home" },
  document: createEmptySceneDocument(),
};

const manifest: SceneManifest = {
  protocolVersion: "2",
  appType: "web",
  components: {},
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
  test("loads and validates a static page into an immutable document and store", async () => {
    let requested = "";
    globalThis.fetch = async (input) => {
      requested = fetchInputUrl(input);
      return new Response(JSON.stringify(delivery), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };
    const client = new OpenSceneController(
      { baseUrl: "https://cdn.example", pageKey: "home" },
      null,
    );
    await client.loadPage();
    const snapshot = client.getSnapshot();
    expect(requested).toBe("https://cdn.example/home.json");
    expect(snapshot.status).toBe("ready");
    expect(Object.isFrozen(snapshot.document)).toBe(true);
    expect(snapshot.runtimeStore?.get("/__scene/pageInfo/title")).toBe("");
    expect(snapshot.runtimeStore).not.toBeNull();
    expect(snapshot.document?.spec).not.toBe(delivery.document.spec);
    client.destroy();
  });

  test("enters observable error state for malformed static page responses", async () => {
    globalThis.fetch = async () => new Response(JSON.stringify({ invalid: true }), { status: 200 });
    const client = new OpenSceneController(
      { baseUrl: "https://cdn.example", pageKey: "home" },
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
      { baseUrl: "https://cdn.example", pageKey: "home" },
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
  test("pushes a catalog manifest once with the publish key", async () => {
    const previous = {
      admin: process.env.OPENSCENE_ADMIN_URL,
      appId: process.env.OPENSCENE_APP_ID,
      publishKey: process.env.OPENSCENE_PUBLISH_KEY,
      httpsProxy: process.env.HTTPS_PROXY,
      httpProxy: process.env.HTTP_PROXY,
      allProxy: process.env.ALL_PROXY,
      lowerHttpsProxy: process.env.https_proxy,
      lowerHttpProxy: process.env.http_proxy,
      lowerAllProxy: process.env.all_proxy,
    };
    let calls = 0;
    let sentBody = "";
    let sentHeader = "";
    globalThis.fetch = async (input, init) => {
      calls += 1;
      sentBody = typeof init?.body === "string" ? init.body : "";
      sentHeader = new Headers(init?.headers).get("authorization") ?? "";
      expect(fetchInputUrl(input)).toContain("/api/v1/apps/app-1/manifest/push");
      return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
    };
    process.env.OPENSCENE_ADMIN_URL = "https://admin.example";
    process.env.OPENSCENE_APP_ID = "app-1";
    process.env.OPENSCENE_PUBLISH_KEY = "secret-key";
    process.env.HTTPS_PROXY = "";
    process.env.HTTP_PROXY = "";
    process.env.ALL_PROXY = "";
    process.env.https_proxy = "";
    process.env.http_proxy = "";
    process.env.all_proxy = "";
    const plugin = openSceneManifestPlugin({ manifest });
    plugin.configResolved?.({ command: "build", mode: "production", envDir: process.cwd() });
    await plugin.closeBundle?.();
    await plugin.closeBundle?.();
    expect(calls).toBe(1);
    expect(sentHeader).toBe("Bearer secret-key");
    expect(sentBody).toContain('"appType":"web"');
    process.env.OPENSCENE_ADMIN_URL = previous.admin;
    process.env.OPENSCENE_APP_ID = previous.appId;
    process.env.OPENSCENE_PUBLISH_KEY = previous.publishKey;
    process.env.HTTPS_PROXY = previous.httpsProxy;
    process.env.HTTP_PROXY = previous.httpProxy;
    process.env.ALL_PROXY = previous.allProxy;
    process.env.https_proxy = previous.lowerHttpsProxy;
    process.env.http_proxy = previous.lowerHttpProxy;
    process.env.all_proxy = previous.lowerAllProxy;
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
