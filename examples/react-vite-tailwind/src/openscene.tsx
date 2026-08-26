import React, { useEffect, useMemo, useState } from "react";
import {
  APP_TYPE_WEB,
  defineAppManifest,
  openApiMethods,
  type OpenApiValue,
  defineOpenSceneReactAction,
  defineOpenSceneReactApp,
  defineOpenSceneReactComponent,
  defineOpenApiRequestAction,
  buildOpenApiRequest,
  executeOpenApiRequest,
  type OpenSceneReactApp,
  useOpenSceneNode,
} from "@openscene-ai/react";
import { z } from "zod";

const styleField = z
  .record(z.string(), z.unknown())
  .meta({ "x-editor": { control: "style", type: "style" } })
  .optional();

const imageProps = z
  .object({
    src: z.string().optional(),
    alt: z.string().optional(),
    fit: z.enum(["cover", "contain", "fill", "none", "scale-down"]).optional(),
    loading: z.enum(["eager", "lazy"]).optional(),
    class: z.string().optional(),
    className: z.string().optional(),
    style: styleField,
  })
  .passthrough();

const calloutProps = z
  .object({
    tone: z.enum(["info", "success", "warning"]).optional(),
    class: z.string().optional(),
    className: z.string().optional(),
    style: styleField,
  })
  .passthrough();

const statusCardProps = z
  .object({
    label: z.string().optional(),
    status: z.enum(["idle", "active", "complete"]).optional(),
    class: z.string().optional(),
    className: z.string().optional(),
    style: styleField,
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

/** A composition example: a styled container. */
const Callout = defineOpenSceneReactComponent({
  type: "Callout",
  schema: calloutProps,
  title: "Callout",
  description: "A styled container with tone variants.",
  category: "layout",
  tags: ["example", "composition"],
  editor: { fields: ["tone"] },
  children: true,
  render: (renderProps) => {
    const node = useOpenSceneNode();
    const elementProps = getComponentProps<z.infer<typeof calloutProps>>(renderProps);
    const tone = typeof elementProps.tone === "string" ? elementProps.tone : "info";
    const style = (elementProps.style as React.CSSProperties) ?? {};
    return (
      <div
        {...node.nodeAttrs}
        className={`react-vite-callout react-vite-callout-${tone}`}
        style={style}
      >
        {renderProps.children}
      </div>
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
    const elementProps = getComponentProps<z.infer<typeof openApiProviderProps>>(renderProps);
    const value = elementProps.openapi as OpenApiValue | undefined;
    return <OpenApiProviderRenderer value={value}>{renderProps.children}</OpenApiProviderRenderer>;
  },
});

const openApiRequest = defineOpenApiRequestAction({
  key: "openApiRequest",
  title: "OpenAPI Request",
  description: "Execute an OpenAPI endpoint and store the response in state.",
});

export function createReactApp(appKey: string): OpenSceneReactApp {
  return defineOpenSceneReactApp({
    app: { key: appKey, type: APP_TYPE_WEB },
    components: [Image, Callout, StatusCard, OpenApiProvider],
    actions: [setNotice, openApiRequest],
  });
}

export type ReactApp = OpenSceneReactApp;

/** The serializable manifest shared by the browser client and Vite plugin. */
export function createManifest(appKey: string) {
  return defineAppManifest(createReactApp(appKey).manifest);
}

export { Image, imageProps, Callout, StatusCard, OpenApiProvider, setNotice };
