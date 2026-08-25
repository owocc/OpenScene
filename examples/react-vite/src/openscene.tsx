import React, { useEffect, useMemo, useState } from "react";
import { APP_TYPE_WEB } from "@openscene/constants";
import { defineAppManifest } from "@openscene/javascript";
import { openApiMethods, type OpenApiValue } from "@openscene/schema";
import {
  baseReactComponents,
  defineOpenSceneReactAction,
  defineOpenSceneReactApp,
  defineOpenSceneReactComponent,
  type OpenSceneReactApp,
  useOpenSceneNode,
  View,
} from "@openscene/react";
import { z } from "zod";

const baseViewProps = {
  class: z.string().optional(),
  className: z.string().optional(),
  style: z
    .record(z.string(), z.unknown())
    .meta({ "x-editor": { control: "style", type: "style" } })
    .optional(),
};

const viewProps = z.object(baseViewProps).passthrough();
const textProps = z
  .object({
    text: z.string().optional(),
    ...baseViewProps,
  })
  .passthrough();
const buttonProps = z
  .object({
    label: z.string().optional(),
    text: z.string().optional(),
    disabled: z.boolean().optional(),
    type: z.enum(["button", "submit", "reset"]).optional(),
    ...baseViewProps,
  })
  .passthrough();
const imageProps = z
  .object({
    src: z.string().optional(),
    alt: z.string().optional(),
    fit: z.enum(["cover", "contain", "fill", "none", "scale-down"]).optional(),
    loading: z.enum(["eager", "lazy"]).optional(),
    ...baseViewProps,
  })
  .passthrough();

const baseComponents = [
  {
    ...baseReactComponents.View,
    schema: viewProps,
    title: "View",
    description: "A layout container.",
    category: "layout",
    children: true,
  },
  {
    ...baseReactComponents.Text,
    schema: textProps,
    title: "Text",
    description: "Text content.",
    category: "content",
    children: true,
  },
  {
    ...baseReactComponents.Button,
    schema: buttonProps,
    title: "Button",
    description: "An interactive button.",
    category: "interactive",
    events: { press: { title: "Press" } },
    children: true,
  },
];

const calloutProps = z
  .object({
    tone: z.enum(["info", "success", "warning"]).optional(),
    ...baseViewProps,
  })
  .passthrough();

const statusCardProps = z
  .object({
    label: z.string().optional(),
    status: z.enum(["idle", "active", "complete"]).optional(),
    ...baseViewProps,
  })
  .passthrough();

const openApiProviderProps = z
  .object({
    openapi: z
      .object({
        json: z.record(z.string(), z.unknown()),
        path: z.string(),
        method: z.enum([...openApiMethods]),
        params: z
          .object({
            path: z.record(z.string(), z.string()).optional(),
            query: z.record(z.string(), z.unknown()).optional(),
            body: z.unknown().optional(),
          })
          .optional(),
      })
      .meta({ "x-editor": { control: "openapi" } })
      .optional(),
  })
  .passthrough();

function getComponentProps<T extends Record<string, unknown>>(renderProps: unknown): Partial<T> {
  if (renderProps && typeof renderProps === "object") {
    if ("props" in renderProps && renderProps.props && typeof renderProps.props === "object") {
      return renderProps.props as Partial<T>;
    }
    if (
      "element" in renderProps &&
      renderProps.element &&
      typeof renderProps.element === "object"
    ) {
      const el = renderProps.element as { props?: unknown };
      if (el.props && typeof el.props === "object") {
        return el.props as Partial<T>;
      }
    }
  }
  return {};
}

/** An image component supporting image rendering, props, basic view props, and a style editor. */
const Image = defineOpenSceneReactComponent({
  type: "Image",
  schema: imageProps,
  title: "Image",
  description: "An image element supporting source, fit, and styles.",
  category: "media",
  tags: ["image", "media"],
  editor: { fields: ["src", "alt", "fit", "loading"] },
  children: false,
  render: (renderProps) => {
    const node = useOpenSceneNode();
    const elementProps = getComponentProps<z.infer<typeof imageProps>>(renderProps);
    const className =
      typeof elementProps.className === "string"
        ? elementProps.className
        : typeof elementProps.class === "string"
          ? elementProps.class
          : undefined;
    const style = (elementProps.style as React.CSSProperties) ?? {};
    const fit =
      typeof elementProps.fit === "string"
        ? (elementProps.fit as React.CSSProperties["objectFit"])
        : undefined;
    const combinedStyle: React.CSSProperties = fit ? { objectFit: fit, ...style } : style;
    const src = typeof elementProps.src === "string" ? elementProps.src : undefined;
    const alt = typeof elementProps.alt === "string" ? elementProps.alt : "";
    const loading =
      elementProps.loading === "eager" || elementProps.loading === "lazy"
        ? elementProps.loading
        : undefined;

    return (
      <img
        {...node.nodeAttrs}
        src={src}
        alt={alt}
        loading={loading}
        className={className}
        style={combinedStyle}
      />
    );
  },
});

/** A composition example: use the shared View primitive as the component root. */
const Callout = defineOpenSceneReactComponent({
  type: "Callout",
  schema: calloutProps,
  title: "Callout",
  description: "A styled container composed from the OpenScene View primitive.",
  category: "layout",
  tags: ["example", "composition"],
  editor: { fields: ["tone"] },
  children: true,
  render: (renderProps) => {
    const elementProps = getComponentProps<z.infer<typeof calloutProps>>(renderProps);
    const tone = typeof elementProps.tone === "string" ? elementProps.tone : "info";
    return (
      <View
        props={{
          ...elementProps,
          className: `react-vite-callout react-vite-callout-${tone}`,
        }}
        emit={renderProps.emit}
        on={renderProps.on}
      >
        {renderProps.children}
      </View>
    );
  },
});

/** A hook example: attach the editor identity to a semantic custom root. */
const StatusCard = defineOpenSceneReactComponent({
  type: "StatusCard",
  schema: statusCardProps,
  title: "Status card",
  description: "A semantic custom root using useOpenSceneNode for editor identity.",
  category: "content",
  tags: ["example", "hook"],
  editor: { fields: ["label", "status"] },
  children: true,
  render: (renderProps) => {
    const node = useOpenSceneNode();
    const elementProps = getComponentProps<z.infer<typeof statusCardProps>>(renderProps);
    const status = typeof elementProps.status === "string" ? elementProps.status : "idle";
    const label = typeof elementProps.label === "string" ? elementProps.label : "Status";
    return (
      <article
        {...node.nodeAttrs}
        className={`react-vite-status-card react-vite-status-card-${status}`}
      >
        <strong>{label}</strong>
        <span>{status}</span>
        {renderProps.children}
      </article>
    );
  },
});

type OpenApiRequest = {
  url: string;
  method: string;
  body?: string;
  headers: Record<string, string>;
};

function buildOpenApiRequest(value: OpenApiValue | undefined): OpenApiRequest | null {
  if (!value || !value.json || typeof value.json !== "object" || !value.path || !value.method) {
    return null;
  }
  const rawServers = value.json.servers;
  const serverList = Array.isArray(rawServers)
    ? (rawServers as unknown as Array<{ url?: unknown }>)
    : [];
  const base =
    typeof serverList[0]?.url === "string" && serverList[0].url
      ? serverList[0].url.replace(/\/$/, "")
      : "";
  let path = value.path;
  const pathParams = value.params?.path ?? {};
  path = path.replace(/\{([^}]+)\}/g, (_, name: string) =>
    encodeURIComponent(pathParams[name] ?? ""),
  );
  const searchParams = new URLSearchParams();
  const query = value.params?.query ?? {};
  for (const [key, item] of Object.entries(query)) {
    searchParams.set(key, typeof item === "string" ? item : JSON.stringify(item));
  }
  const queryString = searchParams.toString();
  const url = `${base}${path}${queryString ? `?${queryString}` : ""}`;
  const headers: Record<string, string> = { accept: "application/json" };
  const method = value.method.toUpperCase();
  let body: string | undefined;
  if (method !== "GET" && method !== "HEAD" && value.params?.body !== undefined) {
    body = JSON.stringify(value.params.body);
    headers["content-type"] = "application/json";
  }
  return { url, method, headers, body };
}

async function executeOpenApiRequest(request: OpenApiRequest): Promise<unknown> {
  const response = await fetch(request.url, {
    method: request.method,
    headers: request.headers,
    body: request.body,
  });
  if (!response.ok) {
    throw new Error(`${request.method} ${request.url} -> ${response.status}`);
  }
  return response.json();
}

const setNotice = defineOpenSceneReactAction({
  key: "reactViteSetNotice",
  title: "Set notice",
  description: "Store a short runtime notice without changing the canonical page document.",
  params: z.object({ message: z.string() }).passthrough(),
  editor: { fields: ["message"] },
  handler: (params, setState) => {
    const message = typeof params?.message === "string" ? params.message : "";
    setState((previous) => ({ ...previous, reactViteNotice: message }));
  },
});

function OpenApiProviderRenderer(props: {
  value: OpenApiValue | undefined;
  children: React.ReactNode;
}) {
  const [data, setData] = useState<string>("Loading…");
  const request = useMemo(() => buildOpenApiRequest(props.value), [props.value]);

  useEffect(() => {
    if (!request) return;
    let cancelled = false;
    setData("Loading…");
    executeOpenApiRequest(request)
      .then((result) => {
        if (!cancelled) {
          setData(JSON.stringify(result, null, 2));
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setData(String(err));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [request]);

  if (!request) {
    return <span className="react-vite-openapi-missing">OpenAPI not configured</span>;
  }

  return (
    <>
      <pre className="react-vite-openapi-data">{data}</pre>
      {props.children}
    </>
  );
}

/** Requests an OpenAPI operation (from a self-contained document snapshot) and renders the response. */
const OpenApiProvider = defineOpenSceneReactComponent({
  type: "OpenApiProvider",
  schema: openApiProviderProps,
  title: "OpenAPI Provider",
  description: "根据 OpenAPI 文档请求接口并渲染响应。",
  category: "data",
  tags: ["openapi", "data"],
  children: true,
  render: (renderProps) => {
    const value = (renderProps as unknown as { props?: Record<string, unknown> }).props?.openapi as
      | OpenApiValue
      | undefined;
    return <OpenApiProviderRenderer value={value}>{renderProps.children}</OpenApiProviderRenderer>;
  },
});

export function createReactApp(appKey: string): OpenSceneReactApp {
  return defineOpenSceneReactApp({
    app: { key: appKey, type: APP_TYPE_WEB },
    components: [...baseComponents, Image, Callout, StatusCard, OpenApiProvider],
    actions: [setNotice],
  });
}

export type ReactApp = OpenSceneReactApp;

/** The serializable manifest shared by the browser client and Vite plugin. */
export function createManifest(appKey: string) {
  return defineAppManifest(createReactApp(appKey).manifest);
}

export {
  baseReactComponents,
  Image,
  imageProps,
  baseViewProps,
  Callout,
  StatusCard,
  OpenApiProvider,
  setNotice,
};
