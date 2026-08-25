import { defineOpenSceneSolidApp, defineOpenSceneSolidComponent } from "@openscene-ai/solid/v2";
import {
  GuildCardMeta,
  StatBlockMeta,
  MemberRowMeta,
  LevelTierCardMeta,
  PageHeaderMeta,
  ConfirmDialogMeta,
  openApiRequest,
  showDialog,
} from "./openscene-manifest.ts";

// ---------------------------------------------------------------------------
// Components with JSX renders
// ---------------------------------------------------------------------------

const GuildCard = defineOpenSceneSolidComponent({
  ...GuildCardMeta,
  render: (props) => (
    <div class="flex items-center gap-3 rounded-xl bg-[#1a2040] px-4 py-3">
      <div class="relative shrink-0">
        <img
          src={(props.avatar as string | undefined) ?? "https://placehold.co/40"}
          alt={props.name as string | undefined}
          class="h-10 w-10 rounded-full object-cover ring-2 ring-blue-500/30"
        />
        {props.isOnline && (
          <span class="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#1a2040] bg-emerald-400" />
        )}
      </div>
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-semibold text-white">
          {(props.name as string | undefined) ?? "Agency"}
        </p>
        <p class="text-xs text-blue-300">{(props.level as string | undefined) ?? "Standard"}</p>
      </div>
      <div class="text-right">
        <p class="text-sm font-bold text-white">
          {(props.weeklyRevenue as string | undefined) ?? "—"}
        </p>
        <p class="text-xs text-slate-400">
          {(props.membersCount as number | undefined) ?? 0} members
        </p>
      </div>
    </div>
  ),
});

const StatBlock = defineOpenSceneSolidComponent({
  ...StatBlockMeta,
  render: (props) => (
    <div class="flex flex-col gap-1 rounded-xl bg-[#1a2040] px-4 py-3">
      <span class="text-xs text-slate-400">{(props.label as string | undefined) ?? "Stat"}</span>
      <span class="text-xl font-bold text-white">{(props.value as string | undefined) ?? "—"}</span>
      {props.trend && (
        <span class={`text-xs font-medium ${props.trendUp ? "text-emerald-400" : "text-rose-400"}`}>
          {props.trend as string}
        </span>
      )}
    </div>
  ),
});

const MemberRow = defineOpenSceneSolidComponent({
  ...MemberRowMeta,
  render: (props) => (
    <div class="flex items-center gap-3 border-b border-white/5 px-4 py-2.5 last:border-0">
      <div class="relative shrink-0">
        <img
          src={(props.avatar as string | undefined) ?? "https://placehold.co/36"}
          alt={props.name as string | undefined}
          class="h-9 w-9 rounded-full object-cover"
        />
        {props.isOnline && (
          <span class="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[#131729] bg-emerald-400" />
        )}
      </div>
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-medium text-white">
          {(props.name as string | undefined) ?? "User"}
        </p>
        <p class="text-xs text-slate-500">ID: {(props.uid as string | undefined) ?? "—"}</p>
      </div>
      {props.actionLabel && (
        <button class="rounded-lg bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-500">
          {props.actionLabel as string}
        </button>
      )}
      {props.rejectLabel && (
        <button class="rounded-lg border border-white/10 px-3 py-1 text-xs font-semibold text-slate-300 hover:bg-white/5">
          {props.rejectLabel as string}
        </button>
      )}
    </div>
  ),
});

const LevelTierCard = defineOpenSceneSolidComponent({
  ...LevelTierCardMeta,
  render: (props) => (
    <div
      class={`rounded-xl border p-4 ${
        props.isActive ? "border-blue-500 bg-blue-500/10" : "border-white/10 bg-[#1a2040]"
      }`}
    >
      <p
        class="text-sm font-bold"
        style={{
          color: (props.color as string | undefined) ?? (props.isActive ? "#60a5fa" : "#94a3b8"),
        }}
      >
        {(props.tierName as string | undefined) ?? "Standard"}
      </p>
      <p class="mt-1 text-xs text-slate-400">≥ {(props.minRevenue as string | undefined) ?? "0"}</p>
      <p class="mt-2 text-lg font-bold text-white">
        {(props.commissionRate as string | undefined) ?? "—"}
      </p>
    </div>
  ),
});

const PageHeader = defineOpenSceneSolidComponent({
  ...PageHeaderMeta,
  render: (props) => (
    <header class="flex items-center gap-3 bg-[#131729] px-4 py-3">
      {props.showBack !== false && (
        <button class="text-slate-400 hover:text-white">
          <svg
            class="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width={2}
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}
      <h1 class="flex-1 text-base font-semibold text-white">
        {(props.title as string | undefined) ?? ""}
      </h1>
      {props.children}
    </header>
  ),
});

const ConfirmDialog = defineOpenSceneSolidComponent({
  ...ConfirmDialogMeta,
  render: (props) => (
    <>
      {props.visible && (
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div class="w-full max-w-xs rounded-2xl bg-[#1e2642] p-6 shadow-xl">
            <p class="text-center text-sm text-slate-200">
              {(props.message as string | undefined) ?? "Are you sure?"}
            </p>
            <div class="mt-5 flex gap-3">
              <button class="flex-1 rounded-lg border border-white/10 py-2 text-sm text-slate-300 hover:bg-white/5">
                {(props.cancelLabel as string | undefined) ?? "Cancel"}
              </button>
              <button class="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-semibold text-white hover:bg-blue-500">
                {(props.confirmLabel as string | undefined) ?? "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  ),
});

// ---------------------------------------------------------------------------
// Full app with renders — use this in App.tsx
// ---------------------------------------------------------------------------

export const app = defineOpenSceneSolidApp({
  components: [GuildCard, StatBlock, MemberRow, LevelTierCard, PageHeader, ConfirmDialog],
  actions: [openApiRequest, showDialog],
});
