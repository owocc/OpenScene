import { eq } from "drizzle-orm";
import { generateText, streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import type { AppDatabase } from "../db/client";
import { aiConfig } from "../db/schema";
import { nowIso } from "../db/ids";
import { getConfig } from "../config/env";
import { forbidden, validation } from "../errors";
import { encryptSecret, decryptSecret } from "./encryption";
import {
  AiChatRequestSchema,
  AiChatResponseSchema,
  AiConfigSchema,
  AiConfigStatusSchema,
  AiConfigUpdateSchema,
  AiTestSchema,
} from "../validation/schemas";
import type { z } from "zod";

const GLOBAL_ID = "global";
const OPENAI_DEFAULT_BASE_URL = "https://api.openai.com/v1";

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
    const openai = createOpenAI({ apiKey, baseURL: baseUrl || OPENAI_DEFAULT_BASE_URL });
    await generateText({
      model: openai(model),
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
  provider: "openai";
  model: string;
  baseUrl: string;
  apiKey: string;
};

async function resolveConfig(db: AppDatabase): Promise<ResolvedConfig> {
  const row = await db.select().from(aiConfig).where(eq(aiConfig.id, GLOBAL_ID)).get();
  if (!row || !row.enabled) throw forbidden("AI is not configured or is disabled");
  const apiKey = decryptSecret(row.apiKeyEnc, getConfig().ai.encryptionKey);
  return {
    provider: "openai",
    model: row.model,
    baseUrl: row.baseUrl || OPENAI_DEFAULT_BASE_URL,
    apiKey,
  };
}

/**
 * Run a chat completion for a verified client. Supports multiple response formats:
 * `json` (default), `text`, and `stream` (server-sent text stream). The caller is
 * responsible for authenticating the request (app key) before invoking this.
 */
export async function chatWithAi(db: AppDatabase, input: AiChatInput): Promise<Response> {
  const config = await resolveConfig(db);
  const openai = createOpenAI({ apiKey: config.apiKey, baseURL: config.baseUrl });
  const model = openai(input.model ?? config.model);
  const messages = input.messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));
  const settings = {
    system: input.system,
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

  return Response.json(
    AiChatResponseSchema.parse({
      model: input.model ?? config.model,
      content: result.text,
      usage: {
        inputTokens: result.usage.inputTokens ?? 0,
        outputTokens: result.usage.outputTokens ?? 0,
        totalTokens: result.usage.totalTokens ?? 0,
      },
    }),
    { status: 200, headers: { "cache-control": "no-store" } },
  );
}
