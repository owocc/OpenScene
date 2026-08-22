import { createComponent } from "solid-js";
import { Dynamic } from "solid-js/web";
import { APP_TYPE_WEB } from "@openscene/constants";
import { defineAppManifest } from "@openscene/javascript";
import {
  baseSolidComponents,
  defineOpenSceneSolidAction,
  defineOpenSceneSolidApp,
  defineOpenSceneSolidComponent,
  type OpenSceneSolidApp,
  useOpenSceneNode,
  View,
} from "@openscene/solid";
import { z } from "zod";
const viewProps = z
  .object({
    class: z.string().optional(),
    className: z.string().optional(),
    style: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();
const textProps = z.object({ text: z.string().optional() }).passthrough();
const buttonProps = z
  .object({
    label: z.string().optional(),
    disabled: z.boolean().optional(),
    type: z.enum(["button", "submit", "reset"]).optional(),
  })
  .passthrough();

const baseComponents = [
  {
    ...baseSolidComponents.View,
    schema: viewProps,
    title: "View",
    description: "A layout container.",
    category: "layout",
    children: true,
  },
  {
    ...baseSolidComponents.Text,
    schema: textProps,
    title: "Text",
    description: "Text content.",
    category: "content",
    children: true,
  },
  {
    ...baseSolidComponents.Button,
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
  })
  .passthrough();

const statusCardProps = z
  .object({
    label: z.string().optional(),
    status: z.enum(["idle", "active", "complete"]).optional(),
  })
  .passthrough();

/** A composition example: use the shared View primitive as the component root. */
const Callout = defineOpenSceneSolidComponent({
  type: "SolidV1Callout",
  schema: calloutProps,
  title: "Callout",
  description: "A styled container composed from the OpenScene View primitive.",
  category: "layout",
  tags: ["example", "composition"],
  editor: { fields: ["tone"] },
  children: true,
  render: (renderProps) =>
    createComponent(View, {
      props: {
        ...renderProps.element.props,
        className: `solid-v1-callout solid-v1-callout-${String(renderProps.element.props.tone ?? "info")}`,
      },
      children: renderProps.children,
      emit: renderProps.emit,
      on: renderProps.on,
    }),
});

/** A hook example: attach the editor identity to a semantic custom root. */
const StatusCard = defineOpenSceneSolidComponent({
  type: "SolidV1StatusCard",
  schema: statusCardProps,
  title: "Status card",
  description: "A semantic custom root using useOpenSceneNode for editor identity.",
  category: "content",
  tags: ["example", "hook"],
  editor: { fields: ["label", "status"] },
  children: true,
  render: (renderProps) => {
    const node = useOpenSceneNode();
    const props = renderProps.element.props as Record<string, unknown>;
    const status = typeof props.status === "string" ? props.status : "idle";
    const label = typeof props.label === "string" ? props.label : "Status";
    return createComponent(Dynamic, {
      component: "article",
      ...node.nodeAttrs,
      class: `solid-v1-status-card solid-v1-status-card-${status}`,
      children: [
        createComponent(Dynamic, { component: "strong", children: label }),
        createComponent(Dynamic, { component: "span", children: status }),
        renderProps.children,
      ],
    });
  },
});

const setNotice = defineOpenSceneSolidAction({
  key: "solidV1SetNotice",
  title: "Set notice",
  description: "Store a short runtime notice without changing the canonical page document.",
  params: z.object({ message: z.string() }).passthrough(),
  editor: { fields: ["message"] },
  handler: (params, setState) => {
    const message = typeof params?.message === "string" ? params.message : "";
    setState((previous) => ({ ...previous, solidV1Notice: message }));
  },
});

export function createSolidApp(appKey: string): OpenSceneSolidApp {
  return defineOpenSceneSolidApp({
    app: { key: appKey, type: APP_TYPE_WEB },
    components: [...baseComponents, Callout, StatusCard],
    actions: [setNotice],
  });
}

export type SolidApp = OpenSceneSolidApp;

/** The serializable manifest shared by the browser client and Vite plugin. */
export function createManifest(appKey: string) {
  return defineAppManifest(createSolidApp(appKey).manifest);
}

// Keep the base catalog visible at this declaration boundary for editor consumers.
export { baseSolidComponents };
