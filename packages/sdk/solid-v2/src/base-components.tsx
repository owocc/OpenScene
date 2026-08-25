import type { JSX } from "@solidjs/web";
import { z } from "zod";
import type { OpenSceneSolidComponentDefinition } from "./catalog.ts";

const viewSchema = z
  .object({
    class: z.string().optional(),
    style: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

const textSchema = z
  .object({
    text: z.string().optional(),
    class: z.string().optional(),
    style: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

const buttonSchema = z
  .object({
    label: z.string().optional(),
    disabled: z.boolean().optional(),
    class: z.string().optional(),
    style: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

export const baseComponents: Record<string, OpenSceneSolidComponentDefinition> = {
  View: {
    type: "View",
    schema: viewSchema,
    title: "View",
    description: "Layout container.",
    category: "layout",
    children: true,
    render: (props) =>
      (
        <div
          class={props.class as string | undefined}
          style={props.style as Record<string, string> | undefined}
        >
          {props.children}
        </div>
      ) as JSX.Element,
  },
  Text: {
    type: "Text",
    schema: textSchema,
    title: "Text",
    description: "Text node.",
    category: "basic",
    render: (props) =>
      (
        <span
          class={props.class as string | undefined}
          style={props.style as Record<string, string> | undefined}
        >
          {(props.text as string | undefined) ?? props.children}
        </span>
      ) as JSX.Element,
  },
  Button: {
    type: "Button",
    schema: buttonSchema,
    title: "Button",
    description: "Clickable button.",
    category: "basic",
    render: (props) =>
      (
        <button
          class={props.class as string | undefined}
          style={props.style as Record<string, string> | undefined}
          disabled={props.disabled as boolean | undefined}
        >
          {(props.label as string | undefined) ?? props.children}
        </button>
      ) as JSX.Element,
  },
};

export const baseSolidComponents = baseComponents;
