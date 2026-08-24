import { and, eq, inArray } from "drizzle-orm";
import { generateText, streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import type { AppDatabase } from "../db/client";
import {
  aiConfig,
  appOpenApiDocs,
  appPrompts,
  apps,
  manifestRevisions,
  systemPrompts,
} from "../db/schema";
import { nowIso } from "../db/ids";
import { getConfig } from "../config/env";
import { forbidden, validation } from "../errors";
import { encryptSecret, decryptSecret } from "./encryption";
import { AppManifestSchema, extractAgentUiActions } from "@openscene/protocol";
import {
  AiChatRequestSchema,
  AiChatResponseSchema,
  AiConfigSchema,
  AiConfigStatusSchema,
  AiConfigUpdateSchema,
  AiTestSchema,
  DEFAULT_APP_SYSTEM_PROMPT,
  DEFAULT_GLOBAL_SYSTEM_PROMPT,
  SystemPromptSchema,
  SystemPromptUpdateSchema,
} from "../validation/schemas";
import type { z } from "zod";
const GLOBAL_ID = "global";

export type AiConfigInput = z.infer<typeof AiConfigUpdateSchema>;
export type AiChatInput = z.infer<typeof AiChatRequestSchema>;

function recordToPublic(row: typeof aiConfig.$inferSelect) {
  return AiConfigSchema.parse({
    id: row.id,
    provider: row.provider,
    model: row.model,
    baseUrl: row.baseUrl,
    enabled: row.enabled,
    hasApiKey: true,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

/** Read the global AI configuration. API key is never exposed. */
export async function getAiConfig(db: AppDatabase) {
  const row = await db.select().from(aiConfig).where(eq(aiConfig.id, GLOBAL_ID)).get();
  return AiConfigStatusSchema.parse({
    configured: Boolean(row),
    config: row ? recordToPublic(row) : undefined,
  });
}

/** Create or replace the single global AI configuration. The API key is encrypted at rest. */
export async function upsertAiConfig(db: AppDatabase, input: AiConfigInput) {
  const timestamp = nowIso();
  const encryptionKey = getConfig().ai.encryptionKey;
  const existing = await db.select().from(aiConfig).where(eq(aiConfig.id, GLOBAL_ID)).get();
  const apiKeyEnc = input.apiKey ? encryptSecret(input.apiKey, encryptionKey) : existing?.apiKeyEnc;
  if (!apiKeyEnc) {
    throw validation("An API key is required", [
      { path: "apiKey", message: "API key is required" },
    ]);
  }
  const baseUrl = input.baseUrl ? input.baseUrl : (existing?.baseUrl ?? null);
  const values = {
    id: GLOBAL_ID,
    provider: input.provider,
    model: input.model,
    baseUrl,
    apiKeyEnc,
    enabled: input.enabled,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
  };
  await db
    .insert(aiConfig)
    .values(values)
    .onConflictDoUpdate({
      target: aiConfig.id,
      set: {
        provider: values.provider,
        model: values.model,
        baseUrl: values.baseUrl,
        apiKeyEnc: values.apiKeyEnc,
        enabled: values.enabled,
        updatedAt: values.updatedAt,
      },
    })
    .run();
  const saved = await db.select().from(aiConfig).where(eq(aiConfig.id, GLOBAL_ID)).get();
  return recordToPublic(saved!);
}

const EPOCH_ISO = "1970-01-01T00:00:00.000Z";

/** Read the global deployment system prompt. Returns default prompt when unconfigured. */
export async function getSystemPrompt(db: AppDatabase) {
  const row = await db.select().from(systemPrompts).where(eq(systemPrompts.id, GLOBAL_ID)).get();
  if (!row) {
    return SystemPromptSchema.parse({
      prompt: DEFAULT_GLOBAL_SYSTEM_PROMPT,
      enabled: true,
      isDefault: true,
      createdAt: EPOCH_ISO,
      updatedAt: EPOCH_ISO,
    });
  }
  return SystemPromptSchema.parse({
    prompt: row.prompt,
    enabled: row.enabled,
    isDefault: false,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

/** Create or update the global deployment system prompt. */
export async function upsertSystemPrompt(
  db: AppDatabase,
  input: z.infer<typeof SystemPromptUpdateSchema>,
) {
  const timestamp = nowIso();
  const existing = await db
    .select()
    .from(systemPrompts)
    .where(eq(systemPrompts.id, GLOBAL_ID))
    .get();
  const prompt = input.prompt ?? existing?.prompt ?? DEFAULT_GLOBAL_SYSTEM_PROMPT;
  const enabled = input.enabled ?? existing?.enabled ?? true;
  const values = {
    id: GLOBAL_ID,
    prompt,
    enabled,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
  };
  await db
    .insert(systemPrompts)
    .values(values)
    .onConflictDoUpdate({
      target: systemPrompts.id,
      set: {
        prompt: values.prompt,
        enabled: values.enabled,
        updatedAt: values.updatedAt,
      },
    })
    .run();
  return getSystemPrompt(db);
}

/** Validate provider credentials by performing a minimal completion. */
export async function testAiConfig(db: AppDatabase, input: Partial<AiConfigInput>) {
  const existing = await db.select().from(aiConfig).where(eq(aiConfig.id, GLOBAL_ID)).get();
  const provider = input.provider ?? existing?.provider;
  const model = input.model ?? existing?.model;
  const baseUrl = input.baseUrl ?? existing?.baseUrl ?? undefined;
  const apiKey =
    input.apiKey ??
    (existing ? decryptSecret(existing.apiKeyEnc, getConfig().ai.encryptionKey) : undefined);
  if (!provider || !model || !apiKey) {
    throw validation(
      "provider, model and an API key (configured or provided) are required to test",
    );
  }
  try {
    await generateText({
      model: buildModel(provider, apiKey, baseUrl, model),
      messages: [{ role: "user", content: "Reply with the single word: ok" }],
      maxOutputTokens: 8,
    });
    return AiTestSchema.parse({ ok: true, model });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown provider error";
    return AiTestSchema.parse({ ok: false, model, error: message });
  }
}

type ResolvedConfig = {
  provider: "openai" | "openai-responses" | "anthropic";
  model: string;
  baseUrl: string | undefined;
  apiKey: string;
};

function buildModel(
  provider: ResolvedConfig["provider"],
  apiKey: string,
  baseUrl: string | undefined,
  model: string,
) {
  if (provider === "anthropic") {
    return createAnthropic({ apiKey, baseURL: baseUrl })(model);
  }
  const openai = createOpenAI({ apiKey, baseURL: baseUrl });
  return provider === "openai-responses" ? openai.responses(model) : openai.chat(model);
}

async function resolveConfig(db: AppDatabase): Promise<ResolvedConfig> {
  const row = await db.select().from(aiConfig).where(eq(aiConfig.id, GLOBAL_ID)).get();
  if (!row || !row.enabled) throw forbidden("AI is not configured or is disabled");
  const apiKey = decryptSecret(row.apiKeyEnc, getConfig().ai.encryptionKey);
  return {
    provider: row.provider as ResolvedConfig["provider"],
    model: row.model,
    baseUrl: row.baseUrl ?? undefined,
    apiKey,
  };
}
function parsePromptArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

async function resolveComponentsText(
  db: AppDatabase,
  appId: string,
  keys: string[],
): Promise<string> {
  const app = await db
    .select({ activeManifestRevisionId: apps.activeManifestRevisionId })
    .from(apps)
    .where(eq(apps.id, appId))
    .get();
  if (!app?.activeManifestRevisionId) return "";
  const revision = await db
    .select({ manifestJson: manifestRevisions.manifestJson })
    .from(manifestRevisions)
    .where(
      and(
        eq(manifestRevisions.appId, appId),
        eq(manifestRevisions.id, app.activeManifestRevisionId),
      ),
    )
    .get();
  if (!revision) return "";
  const manifest = AppManifestSchema.safeParse(JSON.parse(revision.manifestJson));
  if (!manifest.success) return "";
  const components = (manifest.data.components ?? {}) as Record<
    string,
    { title?: string; description?: string; props?: { properties?: Record<string, unknown> } }
  >;
  const lines = keys
    .filter((key) => components[key])
    .map((key) => {
      const component = components[key];
      const props = component.props?.properties ?? {};
      const propText = Object.keys(props).length
        ? ` (props: ${Object.keys(props).join(", ")})`
        : "";
      const description = component.description ? ` — ${component.description}` : "";
      return `- \`${key}\`: ${component.title ?? key}${description}${propText}`;
    });
  if (lines.length === 0) return "";
  return `## Available Components\nThe following components are published for this app:\n${lines.join("\n")}`;
}

async function resolveOpenApiText(db: AppDatabase, appId: string, ids: string[]): Promise<string> {
  const rows = await db
    .select({ id: appOpenApiDocs.id, name: appOpenApiDocs.name, json: appOpenApiDocs.json })
    .from(appOpenApiDocs)
    .where(and(eq(appOpenApiDocs.appId, appId), inArray(appOpenApiDocs.id, ids)))
    .all();
  if (rows.length === 0) return "";
  const blocks = rows.map((row) => `### ${row.name}\n${row.json}`);
  return `## OpenAPI Specifications\n${blocks.join("\n\n")}`;
}

/**
 * Assemble the system prompt for an app by combining its stored base prompt, optional
 * sections, and any injected component / OpenAPI content. The caller-supplied `system`
 * (if any) is appended as an extra instruction. When injection is disabled only the
 * caller-supplied system prompt is returned.
 */
export async function buildAppSystemPrompt(
  db: AppDatabase,
  appId: string,
  options?:
    | {
        promptKey?: string;
        promptId?: string;
        requestSystem?: string;
        selectedElement?: {
          nodeId: string;
          type: string;
          props?: Record<string, unknown>;
          children?: string[];
          slots?: Record<string, string[]>;
        };
      }
    | string,
): Promise<string> {
  const opts = typeof options === "string" ? { requestSystem: options } : (options ?? {});
  const parts: string[] = [];

  // 1. Global Deployment System Prompt
  const globalPrompt = await getSystemPrompt(db);
  if (globalPrompt.enabled && globalPrompt.prompt.trim()) {
    parts.push(globalPrompt.prompt.trim());
  }

  // 2. Resolve App-specific prompt profile
  let row: typeof appPrompts.$inferSelect | undefined;
  if (opts.promptId) {
    row = await db
      .select()
      .from(appPrompts)
      .where(and(eq(appPrompts.appId, appId), eq(appPrompts.id, opts.promptId)))
      .get();
  } else if (opts.promptKey) {
    row = await db
      .select()
      .from(appPrompts)
      .where(and(eq(appPrompts.appId, appId), eq(appPrompts.key, opts.promptKey)))
      .get();
  } else {
    row = await db
      .select()
      .from(appPrompts)
      .where(and(eq(appPrompts.appId, appId), eq(appPrompts.isDefault, true)))
      .get();
    if (!row) {
      row = await db.select().from(appPrompts).where(eq(appPrompts.appId, appId)).limit(1).get();
    }
  }

  const appPromptEnabled = row?.enabled ?? true;
  if (appPromptEnabled) {
    let system = (row?.system ?? DEFAULT_APP_SYSTEM_PROMPT).trim();
    if (system.includes("replace_document")) {
      system = DEFAULT_APP_SYSTEM_PROMPT.trim();
    }
    const sections = row ? parsePromptArray(row.sections) : [];
    const injectedComponents = row ? parsePromptArray(row.injectedComponents) : [];
    const injectedOpenApiDocIds = row ? parsePromptArray(row.injectedOpenApiDocIds) : [];

    if (system) parts.push(system);
    for (const section of sections) if (section.trim()) parts.push(section.trim());

    if (injectedComponents.length > 0) {
      const componentsText = await resolveComponentsText(db, appId, injectedComponents);
      if (componentsText) parts.push(componentsText);
    }
    if (injectedOpenApiDocIds.length > 0) {
      const openApiText = await resolveOpenApiText(db, appId, injectedOpenApiDocIds);
      if (openApiText) parts.push(openApiText);
    }
  }
  // 3. Targeted Selected Element Context
  if (opts.selectedElement && opts.selectedElement.nodeId) {
    const elSpec = {
      nodeId: opts.selectedElement.nodeId,
      type: opts.selectedElement.type,
      props: opts.selectedElement.props || {},
      children: opts.selectedElement.children || [],
      slots: opts.selectedElement.slots || {},
    };
    parts.push(
      [
        `## TARGETED ELEMENT MODIFICATION RULES (CRITICAL):`,
        `The user currently has selected the element "${opts.selectedElement.nodeId}" (type: "${opts.selectedElement.type}") on the canvas.`,
        `Selected Element Spec:`,
        JSON.stringify(elSpec, null, 2),
        "",
        `STRICT INSTRUCTIONS FOR TARGETED EDITING:`,
        `1. DO NOT output a full page or recreate the whole document.`,
        `2. DO NOT output "schemaVersion", "pageInfo", "globalConfig", or document JSON wrappers.`,
        `3. You MUST use the EXACT target element ID "${opts.selectedElement.nodeId}" in every patch path:`,
        `   - Update a prop: {"op":"replace","path":"/elements/${opts.selectedElement.nodeId}/props/<propKey>","value":<value>}`,
        `   - Replace props: {"op":"replace","path":"/elements/${opts.selectedElement.nodeId}/props","value":{...}}`,
        `   - Update style: {"op":"add","path":"/elements/${opts.selectedElement.nodeId}/props/style","value":{...}}`,
        `   - Insert a child element:`,
        `     {"op":"add","path":"/elements/<childId>","value":{"type":"<Component>","props":{...},"children":[]}}`,
        `     {"op":"add","path":"/elements/${opts.selectedElement.nodeId}/children/-","value":"<childId>"}`,
        `   - Remove this element: {"op":"remove","path":"/elements/${opts.selectedElement.nodeId}"}`,
        `4. DO NOT invent another element ID. You MUST operate on "/elements/${opts.selectedElement.nodeId}/...".`,
      ].join("\n"),
    );
  }

  // 4. Caller-supplied request instruction
  if (opts.requestSystem?.trim()) {
    parts.push(opts.requestSystem.trim());
  }

  return parts.join("\n\n").trim();
}

/**
 * Run a chat completion for a verified client. Supports multiple response formats:
 * `json` (default), `text`, and `stream` (server-sent text stream). The caller is
 * responsible for authenticating the request (app key) before invoking this.
 */
export async function chatWithAi(db: AppDatabase, input: AiChatInput): Promise<Response> {
  const config = await resolveConfig(db);
  const model = buildModel(
    config.provider,
    config.apiKey,
    config.baseUrl,
    input.model ?? config.model,
  );
  const messages = input.messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));
  const systemPrompt = await buildAppSystemPrompt(db, input.appId, {
    promptKey: input.promptKey,
    promptId: input.promptId,
    selectedElement: input.selectedElement,
    requestSystem: input.system,
  });
  const settings = {
    system: systemPrompt || undefined,
    temperature: input.temperature,
    maxOutputTokens: input.maxTokens,
  };

  if (input.format === "stream") {
    const result = streamText({ model, messages, ...settings });
    return result.toTextStreamResponse();
  }

  const result = await generateText({ model, messages, ...settings });
  if (input.format === "text") {
    return new Response(result.text, {
      status: 200,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  }

  const uiActions = extractAgentUiActions(result.text) ?? undefined;
  return Response.json(
    AiChatResponseSchema.parse({
      model: input.model ?? config.model,
      content: result.text,
      usage: {
        inputTokens: result.usage.inputTokens ?? 0,
        outputTokens: result.usage.outputTokens ?? 0,
        totalTokens: result.usage.totalTokens ?? 0,
      },
      uiActions,
    }),
    { status: 200, headers: { "cache-control": "no-store" } },
  );
}
