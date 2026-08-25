/**
 * Manifest-only definitions — no JSX, safe to import from vite.config.ts.
 * Schemas and metadata are declared here; render functions live in openscene.tsx.
 */
import {
  defineOpenSceneSolidApp,
  defineOpenSceneSolidComponent,
  defineOpenSceneSolidAction,
  defineOpenApiRequestAction,
  defineAppManifest,
} from "@openscene-ai/solid";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Schemas (exported so openscene.tsx can spread them into render definitions)
// ---------------------------------------------------------------------------

export const guildCardSchema = z.object({
  name: z.string().optional(),
  avatar: z.string().optional(),
  membersCount: z.number().optional(),
  weeklyRevenue: z.string().optional(),
  level: z.string().optional(),
  isOnline: z.boolean().optional(),
});

export const statBlockSchema = z.object({
  label: z.string().optional(),
  value: z.string().optional(),
  trend: z.string().optional(),
  trendUp: z.boolean().optional(),
});

export const memberRowSchema = z.object({
  name: z.string().optional(),
  uid: z.string().optional(),
  avatar: z.string().optional(),
  role: z.enum(["admin", "member", "applicant"]).optional(),
  isOnline: z.boolean().optional(),
  actionLabel: z.string().optional(),
  rejectLabel: z.string().optional(),
});

export const levelTierCardSchema = z.object({
  tierName: z.string().optional(),
  minRevenue: z.string().optional(),
  commissionRate: z.string().optional(),
  isActive: z.boolean().optional(),
  color: z.string().optional(),
});

export const pageHeaderSchema = z.object({
  title: z.string().optional(),
  showBack: z.boolean().optional(),
});

export const confirmDialogSchema = z.object({
  visible: z.boolean().optional(),
  message: z.string().optional(),
  confirmLabel: z.string().optional(),
  cancelLabel: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Component metadata stubs (no render — added in openscene.tsx)
// ---------------------------------------------------------------------------

export const GuildCardMeta = defineOpenSceneSolidComponent({
  type: "GuildCard",
  title: "Guild Card",
  description: "Agency / guild list item with avatar, name and key stats.",
  category: "guild",
  schema: guildCardSchema,
});

export const StatBlockMeta = defineOpenSceneSolidComponent({
  type: "StatBlock",
  title: "Stat Block",
  description: "Single numeric stat with label and optional trend.",
  category: "guild",
  schema: statBlockSchema,
});

export const MemberRowMeta = defineOpenSceneSolidComponent({
  type: "MemberRow",
  title: "Member Row",
  description: "Member list row with avatar, name, ID and action buttons.",
  category: "guild",
  schema: memberRowSchema,
});

export const LevelTierCardMeta = defineOpenSceneSolidComponent({
  type: "LevelTierCard",
  title: "Level Tier Card",
  description: "Guild tier card showing level, revenue threshold and commission.",
  category: "guild",
  schema: levelTierCardSchema,
});

export const PageHeaderMeta = defineOpenSceneSolidComponent({
  type: "PageHeader",
  title: "Page Header",
  description: "Navigation header with back arrow and title.",
  category: "layout",
  children: true,
  schema: pageHeaderSchema,
});

export const ConfirmDialogMeta = defineOpenSceneSolidComponent({
  type: "ConfirmDialog",
  title: "Confirm Dialog",
  description: "Modal confirmation prompt.",
  category: "overlay",
  schema: confirmDialogSchema,
});

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export const openApiRequest = defineOpenApiRequestAction({ key: "openApiRequest" });

export const showDialog = defineOpenSceneSolidAction({
  key: "showDialog",
  title: "Show Dialog",
  params: z.object({ key: z.string(), visible: z.boolean().optional() }),
  handler: (params, setState) => {
    const key = params?.["key"] as string | undefined;
    if (!key) return;
    setState((prev) => ({ ...prev, [key]: params?.["visible"] !== false }));
  },
});

// ---------------------------------------------------------------------------
// Manifest-only app (no renders — for vite.config.ts import only)
// ---------------------------------------------------------------------------

const metaApp = defineOpenSceneSolidApp({
  components: [
    GuildCardMeta,
    StatBlockMeta,
    MemberRowMeta,
    LevelTierCardMeta,
    PageHeaderMeta,
    ConfirmDialogMeta,
  ],
  actions: [openApiRequest, showDialog],
});

export function createManifest(appKey: string) {
  return defineAppManifest({ ...metaApp.manifest, app: { ...metaApp.manifest.app, key: appKey } });
}
