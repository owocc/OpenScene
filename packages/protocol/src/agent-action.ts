import { z } from "zod";
import {
  createEmptySceneDocument,
  SceneDocumentSchema,
  type SceneDocument,
  type UIElement,
} from "./document.js";

const nonEmptyString = z.string().min(1);
const unknownRecord = z.record(z.string(), z.unknown());

export const UIElementDataSchema = z
  .object({
    id: nonEmptyString.optional(),
    type: nonEmptyString,
    props: unknownRecord.default({}),
    children: z.array(nonEmptyString).optional(),
    slots: z.record(nonEmptyString, z.array(nonEmptyString)).optional(),
  })
  .catchall(z.unknown());

export const ActionTargetSchema = z.object({
  parentId: nonEmptyString,
  slot: nonEmptyString.optional(),
  index: z.number().int().nonnegative().optional(),
});

export const ReplaceDocumentActionSchema = z.object({
  action: z.literal("replace_document"),
  document: SceneDocumentSchema,
  summary: z.string().optional(),
});

export const InsertElementActionSchema = z.object({
  action: z.literal("insert_element"),
  elementId: nonEmptyString.optional(),
  element: UIElementDataSchema,
  target: ActionTargetSchema.optional(),
  summary: z.string().optional(),
});

export const UpdateElementActionSchema = z.object({
  action: z.literal("update_element"),
  elementId: nonEmptyString,
  patch: z
    .object({
      type: nonEmptyString.optional(),
      props: unknownRecord.optional(),
      children: z.array(nonEmptyString).optional(),
      slots: z.record(nonEmptyString, z.array(nonEmptyString)).optional(),
    })
    .catchall(z.unknown()),
  summary: z.string().optional(),
});

export const DeleteElementActionSchema = z.object({
  action: z.literal("delete_element"),
  elementId: nonEmptyString,
  summary: z.string().optional(),
});

export const AgentUiActionSchema = z.discriminatedUnion("action", [
  ReplaceDocumentActionSchema,
  InsertElementActionSchema,
  UpdateElementActionSchema,
  DeleteElementActionSchema,
]);

export const AgentUiActionPlanSchema = z.array(AgentUiActionSchema);

export type ReplaceDocumentAction = z.infer<typeof ReplaceDocumentActionSchema>;
export type InsertElementAction = z.infer<typeof InsertElementActionSchema>;
export type UpdateElementAction = z.infer<typeof UpdateElementActionSchema>;
export type DeleteElementAction = z.infer<typeof DeleteElementActionSchema>;
export type AgentUiAction = z.infer<typeof AgentUiActionSchema>;
export type AgentUiActionPlan = z.infer<typeof AgentUiActionPlanSchema>;

export interface ParsedAgentMessage {
  displayText: string;
  actions: AgentUiAction[] | null;
  rawJson: string | null;
}

/**
 * Apply an array of Agent UI Actions deterministically to a SceneDocument.
 */
export function applyAgentUiActionsToDocument(
  baseDocument: SceneDocument,
  actions: AgentUiAction[],
): SceneDocument {
  let doc: SceneDocument = JSON.parse(JSON.stringify(baseDocument)) as SceneDocument;
  for (const action of actions) {
    if (action.action === "replace_document") {
      const normalized = normalizeAiDocument(action.document);
      if (normalized) {
        doc = normalized;
      }
      continue;
    }

    if (action.action === "insert_element") {
      const elementId =
        action.elementId ||
        action.element.id ||
        `elem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const elementData: UIElement = {
        type: action.element.type,
        props: (action.element.props as Record<string, unknown>) || {},
        ...(action.element.children ? { children: action.element.children } : {}),
        ...(action.element.slots ? { slots: action.element.slots } : {}),
      };

      doc.spec.elements[elementId] = elementData;

      if (action.target) {
        const parent = doc.spec.elements[action.target.parentId];
        if (parent) {
          if (action.target.slot) {
            parent.slots = parent.slots || {};
            parent.slots[action.target.slot] = parent.slots[action.target.slot] || [];
            const slotList = parent.slots[action.target.slot];
            if (typeof action.target.index === "number") {
              slotList.splice(action.target.index, 0, elementId);
            } else {
              slotList.push(elementId);
            }
          } else {
            parent.children = parent.children || [];
            if (typeof action.target.index === "number") {
              parent.children.splice(action.target.index, 0, elementId);
            } else {
              parent.children.push(elementId);
            }
          }
        }
      } else if (!doc.spec.root) {
        doc.spec.root = elementId;
      } else {
        // Append to root element's children by default if root exists
        const rootElem = doc.spec.elements[doc.spec.root];
        if (rootElem) {
          rootElem.children = rootElem.children || [];
          if (!rootElem.children.includes(elementId)) {
            rootElem.children.push(elementId);
          }
        }
      }
      continue;
    }

    if (action.action === "update_element") {
      const element = doc.spec.elements[action.elementId];
      if (element) {
        if (action.patch.type) element.type = action.patch.type;
        if (action.patch.props) {
          element.props = { ...element.props, ...(action.patch.props as Record<string, unknown>) };
        }
        if (action.patch.children) element.children = [...action.patch.children];
        if (action.patch.slots) {
          element.slots = { ...element.slots, ...action.patch.slots };
        }
      }
      continue;
    }

    if (action.action === "delete_element") {
      delete doc.spec.elements[action.elementId];
      // Remove from all parents children / slots
      for (const elem of Object.values(doc.spec.elements)) {
        if (elem.children) {
          elem.children = elem.children.filter((id) => id !== action.elementId);
        }
        if (elem.slots) {
          for (const slotKey of Object.keys(elem.slots)) {
            elem.slots[slotKey] = elem.slots[slotKey].filter((id) => id !== action.elementId);
          }
        }
      }
      if (doc.spec.root === action.elementId) {
        doc.spec.root = null;
      }
      continue;
    }
  }
  doc.schemaVersion = "1.0.0";
  const valid = SceneDocumentSchema.safeParse(doc);
  return valid.success ? valid.data : (normalizeAiDocument(doc) ?? doc);
}
/**
 * Normalizes any raw AI-generated document object into a strictly valid SceneDocument.
 */
export function normalizeAiDocument(raw: unknown): SceneDocument | null {
  if (!raw || typeof raw !== "object") return null;
  const base = createEmptySceneDocument();
  const rawObj = raw as Record<string, unknown>;
  const rawPageInfo = (rawObj.pageInfo as Record<string, unknown> | undefined) || {};
  const rawGlobalConfig = (rawObj.globalConfig as Record<string, unknown> | undefined) || {};
  const rawSpec =
    (rawObj.spec as
      | { root?: string; elements?: Record<string, unknown>; state?: unknown }
      | undefined) ||
    ("elements" in rawObj
      ? (rawObj as { root?: string; elements?: Record<string, unknown>; state?: unknown })
      : {});

  const elementsObj = (rawSpec.elements || {}) as Record<string, unknown>;
  const cleanElements: Record<string, UIElement> = {};

  for (const [id, el] of Object.entries(elementsObj)) {
    if (!el || typeof el !== "object") continue;
    const elObj = { ...(el as Record<string, unknown>) };
    delete elObj.id;
    cleanElements[id] = {
      type: typeof elObj.type === "string" ? elObj.type : "View",
      props:
        typeof elObj.props === "object" && elObj.props !== null
          ? (elObj.props as Record<string, unknown>)
          : {},
      children: Array.isArray(elObj.children) ? (elObj.children as string[]) : [],
      ...(typeof elObj.slots === "object" && elObj.slots !== null
        ? { slots: elObj.slots as Record<string, string[]> }
        : {}),
    };
  }

  const rootCandidate =
    rawSpec.root ?? (cleanElements["root"] ? "root" : (Object.keys(cleanElements)[0] ?? null));

  const doc: SceneDocument = {
    schemaVersion: "1.0.0",
    protocolVersion:
      typeof rawObj.protocolVersion === "string" ? rawObj.protocolVersion : base.protocolVersion,
    pageInfo: {
      title: typeof rawPageInfo.title === "string" ? rawPageInfo.title : base.pageInfo.title,
      description: typeof rawPageInfo.description === "string" ? rawPageInfo.description : "",
      keywords: Array.isArray(rawPageInfo.keywords) ? (rawPageInfo.keywords as string[]) : [],
      locale: typeof rawPageInfo.locale === "string" ? rawPageInfo.locale : "en-US",
      metadata:
        typeof rawPageInfo.metadata === "object" && rawPageInfo.metadata !== null
          ? (rawPageInfo.metadata as Record<string, unknown>)
          : {},
    },
    globalConfig: {
      design: {
        width:
          typeof (rawGlobalConfig.design as { width?: number } | undefined)?.width === "number"
            ? (rawGlobalConfig.design as { width: number }).width
            : 390,
      },
    },
    spec: {
      root: rootCandidate,
      elements: cleanElements,
      ...(rawSpec.state !== undefined ? { state: rawSpec.state as Record<string, unknown> } : {}),
    },
  };

  const valid = SceneDocumentSchema.safeParse(doc);
  return valid.success ? valid.data : null;
}

/**
 * Extracts and validates an AgentUiActionPlan from raw text, code blocks, or objects.
 */
export function extractAgentUiActions(content: string): AgentUiAction[] | null {
  if (!content) return null;

  // 1. Try extracting from code blocks ```json ... ``` or ```spec ... ```
  const codeBlockRegex = /```(?:json|spec|typescript|javascript)?\s*([\s\S]*?)```/g;
  let match;
  while ((match = codeBlockRegex.exec(content)) !== null) {
    const raw = match[1].trim();
    const actions = tryParseActionPlan(raw);
    if (actions) return actions;
  }

  // 2. Try parsing the entire string as raw JSON
  const trimmed = content.trim();
  if (
    (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
    (trimmed.startsWith("{") && trimmed.endsWith("}"))
  ) {
    const actions = tryParseActionPlan(trimmed);
    if (actions) return actions;
  }

  return null;
}

/**
 * Splits message content into clean conversational text (removing the raw JSON block)
 * and the extracted/validated UI Action Plan.
 */
export function splitContentAndUiActions(content: string): ParsedAgentMessage {
  if (!content) return { displayText: "", actions: null, rawJson: null };

  const codeBlockRegex = /```(?:json|spec|typescript|javascript)?\s*([\s\S]*?)```/g;
  let match;
  let rawJson: string | null = null;
  let actions: AgentUiAction[] | null = null;
  let cleanedText = content;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    const raw = match[1].trim();
    const parsed = tryParseActionPlan(raw);
    if (parsed) {
      actions = parsed;
      rawJson = raw;
      cleanedText = (
        content.slice(0, match.index) + content.slice(match.index + match[0].length)
      ).trim();
      break;
    }
  }

  if (!actions) {
    const trimmed = content.trim();
    if (
      (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
      (trimmed.startsWith("{") && trimmed.endsWith("}"))
    ) {
      const parsed = tryParseActionPlan(trimmed);
      if (parsed) {
        actions = parsed;
        rawJson = trimmed;
        cleanedText = "";
      }
    }
  }

  const displayText = cleanedText.replace(/\n{3,}/g, "\n\n").trim();
  return { displayText, actions, rawJson };
}

function tryParseActionPlan(rawJson: string): AgentUiAction[] | null {
  try {
    const parsed = JSON.parse(rawJson);

    // Case A: Array of actions
    if (Array.isArray(parsed)) {
      const actions: AgentUiAction[] = [];
      for (const item of parsed) {
        if (!item || typeof item !== "object") continue;
        const itemObj = item as Record<string, unknown>;
        if (itemObj.action === "replace_document") {
          const doc = normalizeAiDocument(itemObj.document);
          if (doc) {
            actions.push({
              action: "replace_document",
              document: doc,
              ...(typeof itemObj.summary === "string" ? { summary: itemObj.summary } : {}),
            });
          }
        } else if (itemObj.action === "insert_element") {
          const el = itemObj.element as Record<string, unknown> | undefined;
          if (el && typeof el.type === "string") {
            actions.push({
              action: "insert_element",
              elementId: (itemObj.elementId as string) || (el.id as string) || undefined,
              element: {
                id: (el.id as string) || undefined,
                type: el.type,
                props: (el.props as Record<string, unknown>) || {},
                children: Array.isArray(el.children) ? (el.children as string[]) : [],
                slots:
                  typeof el.slots === "object" && el.slots !== null
                    ? (el.slots as Record<string, string[]>)
                    : {},
              },
              target: itemObj.target as ActionTarget | undefined,
              ...(typeof itemObj.summary === "string" ? { summary: itemObj.summary } : {}),
            });
          }
        } else if (itemObj.action === "update_element") {
          if (
            typeof itemObj.elementId === "string" &&
            typeof itemObj.patch === "object" &&
            itemObj.patch !== null
          ) {
            actions.push({
              action: "update_element",
              elementId: itemObj.elementId,
              patch: itemObj.patch as Record<string, unknown>,
              ...(typeof itemObj.summary === "string" ? { summary: itemObj.summary } : {}),
            });
          }
        } else if (itemObj.action === "delete_element") {
          if (typeof itemObj.elementId === "string") {
            actions.push({
              action: "delete_element",
              elementId: itemObj.elementId,
              ...(typeof itemObj.summary === "string" ? { summary: itemObj.summary } : {}),
            });
          }
        }
      }
      if (actions.length > 0) return actions;
    }

    // Case B: Single action object
    if (parsed && typeof parsed === "object") {
      const parsedObj = parsed as Record<string, unknown>;
      if (parsedObj.action === "replace_document") {
        const doc = normalizeAiDocument(parsedObj.document);
        if (doc) return [{ action: "replace_document", document: doc }];
      }
      if (parsedObj.action === "insert_element" && (parsedObj.element as { type?: string })?.type) {
        const el = parsedObj.element as Record<string, unknown>;
        return [
          {
            action: "insert_element",
            elementId: (parsedObj.elementId as string) || (el.id as string) || undefined,
            element: {
              id: (el.id as string) || undefined,
              type: el.type as string,
              props: (el.props as Record<string, unknown>) || {},
              children: Array.isArray(el.children) ? (el.children as string[]) : [],
            },
            target: parsedObj.target as ActionTarget | undefined,
          },
        ];
      }
      if (
        parsedObj.action === "update_element" &&
        typeof parsedObj.elementId === "string" &&
        parsedObj.patch
      ) {
        return [
          {
            action: "update_element",
            elementId: parsedObj.elementId,
            patch: parsedObj.patch as Record<string, unknown>,
          },
        ];
      }
      if (parsedObj.action === "delete_element" && typeof parsedObj.elementId === "string") {
        return [{ action: "delete_element", elementId: parsedObj.elementId }];
      }

      // Case C: Raw document object
      const doc = normalizeAiDocument(parsed);
      if (doc && Object.keys(doc.spec.elements).length > 0) {
        return [{ action: "replace_document", document: doc }];
      }
    }
  } catch {
    // ignore parse errors
  }
  return null;
}

type ActionTarget = z.infer<typeof ActionTargetSchema>;
