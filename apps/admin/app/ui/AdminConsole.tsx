"use client";

import {
  ArrowLeft,
  ArrowRight,
  CaretDown,
  CaretRight,
  ClipboardText,
  Copy,
  DotsThree,
  Lock,
  PencilSimple,
  Power,
  Plus,
  Star,
  Trash,
} from "@phosphor-icons/react";
import { APP_TYPE_WEB } from "@openscene/constants";
import { AppManifestSchema, type ComponentManifest } from "@openscene/protocol";
import { useKumoToastManager } from "@cloudflare/kumo";
import { Badge } from "@cloudflare/kumo/components/badge";
import { Button, LinkButton } from "@cloudflare/kumo/components/button";
import { Code } from "@cloudflare/kumo/components/code";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { DropdownMenu } from "@cloudflare/kumo/components/dropdown";
import { Empty } from "@cloudflare/kumo/components/empty";
import { Input } from "@cloudflare/kumo/components/input";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Loader } from "@cloudflare/kumo/components/loader";
import { Select } from "@cloudflare/kumo/components/select";
import { Surface } from "@cloudflare/kumo/components/surface";
import { Switch } from "@cloudflare/kumo/components/switch";
import { Table } from "@cloudflare/kumo/components/table";
import { Text } from "@cloudflare/kumo/components/text";
import { Textarea } from "@cloudflare/kumo/components/input";
import { Checkbox } from "@cloudflare/kumo/components/checkbox";
import { useQueryClient } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { components } from "@openscene/api-client";
import { api, fetchClient } from "./api";
import { useAdminContext, useI18n, type MessageKey } from "./i18n";
import { isAppScopedPath } from "./navigation";

type App = components["schemas"]["App"];

function getActiveManifest(data: unknown) {
  const result = AppManifestSchema.safeParse(
    typeof data === "object" && data !== null && "manifest" in data ? data.manifest : undefined,
  );
  return result.success ? result.data : null;
}

function componentPropCount(component: ComponentManifest) {
  const properties = component.props.properties;
  return typeof properties === "object" && properties !== null && !Array.isArray(properties)
    ? Object.keys(properties).length
    : 0;
}

type ManifestRevision = {
  id: string;
  source: string;
  checksum: string;
  createdAt: string;
};

function getManifestRevisions(data: unknown): ManifestRevision[] {
  if (!Array.isArray(data)) return [];

  return data.filter(
    (revision): revision is ManifestRevision =>
      typeof revision === "object" &&
      revision !== null &&
      "id" in revision &&
      typeof revision.id === "string" &&
      "source" in revision &&
      typeof revision.source === "string" &&
      "checksum" in revision &&
      typeof revision.checksum === "string" &&
      "createdAt" in revision &&
      typeof revision.createdAt === "string",
  );
}

function ComponentMetadata({
  title,
  value,
  className = "",
  maxHeight = "max-h-72",
}: {
  title: string;
  value: unknown;
  className?: string;
  maxHeight?: string;
}) {
  return (
    <Surface className={`grid gap-3 p-4 ${className}`}>
      <Text variant="heading" as="h2">
        {title}
      </Text>
      <div
        className={`overflow-auto rounded-lg border border-kumo-line bg-kumo-canvas p-3 ${maxHeight}`}
      >
        <Code code={JSON.stringify(value ?? {}, null, 2)} lang="jsonc" />
      </div>
    </Surface>
  );
}
type Resource = components["schemas"]["Resource"];

export function AdminConsole() {
  const pathname = usePathname();
  const context = useAdminContext();
  const { t } = useI18n();
  const appsQuery = api.useQuery("get", "/api/v1/apps", { params: { query: { limit: "100" } } });

  if (pathname === "/apps") return <AppsView />;
  if (pathname === "/system") return <SystemView />;
  if (
    context.appId &&
    appsQuery.data &&
    !appsQuery.data.items.some((app) => app.id === context.appId)
  ) {
    return (
      <Empty
        icon={<ClipboardText size={32} />}
        title={t("chooseApp")}
        description={t("chooseAppDescription")}
        contents={
          <Button onClick={() => context.router.push(context.href("/apps", { appId: undefined }))}>
            {t("selectApp")}
          </Button>
        }
      />
    );
  }
  if (isAppScopedPath(pathname) && !context.appId) {
    return (
      <Empty
        icon={<ClipboardText size={32} />}
        title={t("chooseApp")}
        description={t("chooseAppDescription")}
        contents={
          <Button onClick={() => context.router.push(context.href("/apps"))}>
            {t("selectApp")}
          </Button>
        }
      />
    );
  }
  if (pathname === "/overview") return <OverviewView />;
  if (pathname === "/pages" || pathname === "/templates")
    return <ResourceListView kind={pathname.slice(1) as "pages" | "templates"} />;
  if (pathname.startsWith("/pages/") || pathname.startsWith("/templates/"))
    return <ResourceDetailView />;
  if (pathname === "/preview-profiles") return <PreviewProfilesView />;
  if (pathname === "/categories") return <CategoriesView />;
  if (pathname === "/locales") return <LocalesView />;
  if (pathname === "/assets") return <AssetsView />;
  if (pathname === "/openapi-docs") return <OpenApiDocsView />;
  if (pathname === "/manifest" || pathname === "/meta") return <MetaView />;
  if (pathname === "/components") return <ComponentsView />;
  if (pathname.startsWith("/components/")) return <ComponentDetailView />;
  if (pathname === "/settings") return <SettingsView />;
  if (pathname === "/prompts" || pathname === "/prompt") return <PromptsListView />;
  if (pathname.startsWith("/prompts/") || pathname.startsWith("/prompt/"))
    return <PromptEditorView />;

  if (pathname === "/ai") return <AiView />;
  if (pathname === "/system-prompt") return <SystemPromptView />;
  return <NotFoundView />;
}

function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <Text variant="heading" as="h1" size="lg">
          {title}
        </Text>
        {description ? <Text variant="secondary">{description}</Text> : null}
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="grid place-items-center py-12">
      <Loader aria-label="Loading" />
    </div>
  );
}

function ErrorState({ error }: { error: unknown }) {
  const { t, lang } = useI18n();
  const problem =
    error && typeof error === "object"
      ? (error as { status?: number; detail?: string })
      : undefined;
  const statusText = {
    401: lang === "zh-CN" ? "登录已失效，请重新登录。" : "Your session has expired. Sign in again.",
    409:
      lang === "zh-CN"
        ? "该操作与现有引用冲突。"
        : "The operation conflicts with an existing reference.",
    413: lang === "zh-CN" ? "文件超过大小限制。" : "The file is too large.",
    415: lang === "zh-CN" ? "不支持该媒体类型。" : "This media type is not supported.",
    422: lang === "zh-CN" ? "请检查输入内容。" : "Check the submitted values.",
    503: lang === "zh-CN" ? "依赖服务暂时不可用。" : "A dependency is temporarily unavailable.",
  }[problem?.status ?? 0];
  return (
    <Surface color="secondary" className="mb-4 grid gap-1 p-4 ring ring-kumo-danger/30">
      <Text variant="error">{statusText || t("requestFailed")}</Text>
      {problem?.detail ? <Code code={problem.detail} lang="ts" /> : null}
    </Surface>
  );
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  const key = status as MessageKey;
  return (
    <Badge variant={status === "active" || status === "published" ? "green" : "neutral"}>
      {t(key) || status}
    </Badge>
  );
}

function AppsView() {
  const context = useAdminContext();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const toast = useKumoToastManager();
  const [cursor, setCursor] = useState<string | undefined>();
  const [history, setHistory] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [credentials, setCredentials] = useState<App | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<App | null>(null);
  const [form, setForm] = useState({
    key: "",
    name: "",
    description: "",
    type: APP_TYPE_WEB,
    status: "active",
    mode: "push",
  });
  const query = api.useQuery("get", "/api/v1/apps", {
    params: { query: { limit: "25", cursor } },
  });
  const create = api.useMutation("post", "/api/v1/apps", {
    onSuccess: (data) => {
      setOpen(false);
      setCredentials(data as App);
      toast.add({ title: t("created"), description: t("apps") });
      void queryClient.invalidateQueries({ queryKey: ["get", "/api/v1/apps"] });
    },
  });
  const update = api.useMutation("patch", "/api/v1/apps/{appId}", {
    onSuccess: () => {
      setEditing(null);
      toast.add({ title: t("updated"), description: t("apps") });
      void queryClient.invalidateQueries({ queryKey: ["get", "/api/v1/apps"] });
    },
  });
  const remove = api.useMutation("delete", "/api/v1/apps/{appId}", {
    onSuccess: () => {
      setDeleteId(null);
      toast.add({ title: t("deleted"), description: t("apps") });
      void queryClient.invalidateQueries({ queryKey: ["get", "/api/v1/apps"] });
      if (context.appId === deleteId)
        context.router.push(context.href("/apps", { appId: undefined }));
    },
  });

  function startCreate() {
    setForm({
      key: "",
      name: "",
      description: "",
      type: APP_TYPE_WEB,
      status: "active",
      mode: "push",
    });
  }
  function submitCreate() {
    create.mutate({
      body: {
        key: form.key,
        name: form.name,
        description: form.description,
        type: APP_TYPE_WEB,
        status: form.status as "active" | "disabled",
        manifest: { mode: form.mode as "remote" | "push" },
      },
    });
  }

  const apps = query.data?.items ?? [];
  return (
    <>
      <PageHeader
        title={t("apps")}
        description="Manage application credentials and runtime status."
      >
        <Button variant="primary" icon={Plus} onClick={startCreate}>
          {t("create")}
        </Button>
      </PageHeader>
      {query.error ? <ErrorState error={query.error} /> : null}
      {query.isLoading ? (
        <LoadingState />
      ) : apps.length === 0 ? (
        <Empty
          title={t("noResults")}
          description={t("noResultsDescription")}
          contents={<Button onClick={startCreate}>{t("create")}</Button>}
        />
      ) : (
        <LayerCard className="w-full overflow-x-auto p-0">
          <Table layout="fixed">
            <colgroup>
              <col />
              <col style={{ width: "140px" }} />
              <col style={{ width: "56px" }} />
            </colgroup>
            <Table.Header>
              <Table.Row>
                <Table.Head>{t("app")}</Table.Head>
                <Table.Head>{t("status")}</Table.Head>
                <Table.Head sticky="right">
                  <span className="sr-only">{t("actions")}</span>
                </Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {apps.map((app) => (
                <Table.Row key={app.id}>
                  <Table.Cell>
                    <a
                      className="font-medium text-kumo-link"
                      href={context.href("/overview", { appId: app.id })}
                    >
                      {app.name}
                    </a>
                    <div className="text-sm text-kumo-subtle">{app.key}</div>
                  </Table.Cell>
                  <Table.Cell>
                    <StatusBadge status={app.status} />
                  </Table.Cell>
                  <Table.Cell sticky="right" className="text-right">
                    <DropdownMenu>
                      <DropdownMenu.Trigger
                        render={
                          <Button
                            variant="ghost"
                            size="sm"
                            shape="square"
                            aria-label={t("moreOptions")}
                          >
                            <DotsThree weight="bold" size={16} />
                          </Button>
                        }
                      />
                      <DropdownMenu.Content>
                        <DropdownMenu.Item
                          icon={PencilSimple}
                          onClick={() => {
                            setEditing(app);
                            setForm({
                              key: app.key,
                              name: app.name,
                              description: app.description,
                              type: app.type,
                              status: app.status,
                              mode: app.manifest.mode,
                            });
                          }}
                        >
                          {t("edit")}
                        </DropdownMenu.Item>
                        <DropdownMenu.Item
                          icon={Power}
                          onClick={() =>
                            update.mutate({
                              params: { path: { appId: app.id } },
                              body: { status: app.status === "active" ? "disabled" : "active" },
                            })
                          }
                        >
                          {app.status === "active" ? t("disabled") : t("active")}
                        </DropdownMenu.Item>
                        <DropdownMenu.Separator />
                        <DropdownMenu.Item
                          icon={Trash}
                          variant="danger"
                          onClick={() => setDeleteId(app.id)}
                        >
                          {t("delete")}
                        </DropdownMenu.Item>
                      </DropdownMenu.Content>
                    </DropdownMenu>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </LayerCard>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <Button
          size="sm"
          icon={ArrowLeft}
          disabled={history.length === 0}
          onClick={() => {
            const next = [...history];
            setCursor(next.pop());
            setHistory(next);
          }}
        >
          {(t("previousPage") as string) || "Previous"}
        </Button>
        <Button
          size="sm"
          icon={ArrowRight}
          disabled={!query.data?.nextCursor}
          onClick={() => {
            if (query.data?.nextCursor) {
              setHistory([...history, cursor ?? ""]);
              setCursor(query.data.nextCursor);
            }
          }}
        >
          {(t("nextPage") as string) || "Next"}
        </Button>
      </div>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog size="lg" className="px-8 py-6">
          <Dialog.Title>
            {t("create")} {t("app")}
          </Dialog.Title>
          <Dialog.Description>
            Create an app and keep the generated credentials safe.
          </Dialog.Description>
          <div className="grid gap-4 py-4">
            <Input
              label="Key"
              value={form.key}
              onChange={(e) => setForm({ ...form, key: e.target.value })}
              required
            />
            <Input
              label="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <Input label="Type" value={APP_TYPE_WEB} readOnly />
            <Input
              label="Description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <Select
              label="Manifest mode"
              value={form.mode}
              items={{ push: "Push", remote: "Remote" }}
              onValueChange={(value) => {
                if (value === "push" || value === "remote") setForm({ ...form, mode: value });
              }}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Dialog.Close render={<Button>{t("cancel")}</Button>} />
            <Button variant="primary" loading={create.isPending} onClick={submitCreate}>
              {t("create")}
            </Button>
          </div>
        </Dialog>
      </Dialog.Root>
      <Dialog.Root
        open={Boolean(editing)}
        onOpenChange={(value) => {
          if (!value) setEditing(null);
        }}
      >
        <Dialog size="lg" className="px-8 py-6">
          <Dialog.Title>
            {t("edit")} {t("app")}
          </Dialog.Title>
          <div className="grid gap-4 py-4">
            <Input
              label="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <Input
              label="Description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Dialog.Close render={<Button>{t("cancel")}</Button>} />
            <Button
              variant="primary"
              loading={update.isPending}
              onClick={() =>
                editing &&
                update.mutate({
                  params: { path: { appId: editing.id } },
                  body: { name: form.name, description: form.description },
                })
              }
            >
              {t("save")}
            </Button>
          </div>
        </Dialog>
      </Dialog.Root>
      <Dialog.Root
        open={Boolean(credentials)}
        onOpenChange={(value) => {
          if (!value) setCredentials(null);
        }}
      >
        <Dialog size="lg" className="px-8 py-6">
          <Dialog.Title>{t("created")}</Dialog.Title>
          <Dialog.Description>
            These credentials are shown once. Copy them before closing.
          </Dialog.Description>
          <div className="grid gap-3 py-4">
            {credentials?.credentials ? (
              <Credential label="App Key" value={credentials.credentials.appKey} />
            ) : null}
            {credentials?.credentials ? (
              <Credential label="Runtime Key" value={credentials.credentials.runtimeKey} />
            ) : null}
          </div>
          <div className="flex justify-end">
            <Dialog.Close render={<Button variant="primary">{t("continue")}</Button>} />
          </div>
        </Dialog>
      </Dialog.Root>
      <Dialog.Root
        role="alertdialog"
        open={Boolean(deleteId)}
        onOpenChange={(value) => {
          if (!value) setDeleteId(null);
        }}
      >
        <Dialog className="px-8 py-6">
          <Dialog.Title>
            {t("delete")} {t("app")}
          </Dialog.Title>
          <Dialog.Description>
            This permanently removes the app and its resources.
          </Dialog.Description>
          <div className="flex justify-end gap-2">
            <Dialog.Close render={<Button>{t("cancel")}</Button>} />
            <Button
              variant="destructive"
              loading={remove.isPending}
              onClick={() => deleteId && remove.mutate({ params: { path: { appId: deleteId } } })}
            >
              {t("delete")}
            </Button>
          </div>
        </Dialog>
      </Dialog.Root>
    </>
  );
}

function Credential({ label, value }: { label: string; value: string }) {
  const toast = useKumoToastManager();
  const { t } = useI18n();
  return (
    <div className="grid gap-1">
      <Text variant="secondary">{label}</Text>
      <div className="flex items-center gap-2">
        <Code code={value} lang="ts" />
        <Button
          size="sm"
          shape="square"
          icon={Copy}
          aria-label={t("copied")}
          onClick={() => {
            void navigator.clipboard.writeText(value);
            toast.add({ title: t("copied") });
          }}
        />
      </div>
    </div>
  );
}

function OverviewView() {
  const context = useAdminContext();
  const { t } = useI18n();
  const appQuery = api.useQuery("get", "/api/v1/apps/{appId}", {
    params: { path: { appId: context.appId ?? "" } },
  });
  const pagesQuery = api.useQuery("get", "/api/v1/apps/{appId}/pages", {
    params: { path: { appId: context.appId ?? "" }, query: { limit: "1" } },
  });
  const templatesQuery = api.useQuery("get", "/api/v1/apps/{appId}/templates", {
    params: { path: { appId: context.appId ?? "" }, query: { limit: "1" } },
  });
  const assetsQuery = api.useQuery("get", "/api/v1/apps/{appId}/assets", {
    params: { path: { appId: context.appId ?? "" } },
  });
  const manifestQuery = api.useQuery("get", "/api/v1/apps/{appId}/manifest", {
    params: { path: { appId: context.appId ?? "" } },
  });
  const healthQuery = api.useQuery("get", "/api/v1/health");
  if (appQuery.isLoading) return <LoadingState />;
  if (appQuery.error || !appQuery.data) return <ErrorState error={appQuery.error} />;
  const app = appQuery.data;
  return (
    <>
      <PageHeader title={app.name} description={app.description}>
        <StatusBadge status={app.status} />
        <LinkButton href={context.href("/meta")}>{t("meta")}</LinkButton>
        <LinkButton href={context.href("/settings")}>{t("settings")}</LinkButton>
      </PageHeader>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label={t("status")} value={app.status === "active" ? t("active") : t("disabled")} />
        <a href={context.href("/meta")} className="transition hover:opacity-80">
          <Metric label="Manifest (Meta)" value={manifestQuery.data ? "Ready" : "Unavailable"} />
        </a>
        <Metric label={t("pages")} value={String(pagesQuery.data?.items.length ?? 0)} />
        <Metric label={t("assets")} value={String(assetsQuery.data?.length ?? 0)} />
      </div>
      <LayerCard className="mt-4">
        <div className="flex items-center justify-between">
          <LayerCard.Secondary>Meta & Manifest</LayerCard.Secondary>
          <LinkButton size="sm" href={context.href("/meta")}>
            {t("meta")}
          </LinkButton>
        </div>
        <LayerCard.Primary className="gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={manifestQuery.data ? "active" : "disabled"} />
            <Text variant="secondary">
              {manifestQuery.data
                ? "Manifest is published and active."
                : "No active build manifest."}
            </Text>
            {app.manifest?.activeRevisionId && (
              <span className="font-mono text-xs text-kumo-subtle">
                rev: {app.manifest.activeRevisionId.slice(0, 16)}…
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <LinkButton size="sm" variant="secondary" href={context.href("/meta")}>
              查看 Meta 原始信息与 JSON
            </LinkButton>
            <LinkButton size="sm" variant="secondary" href={context.href("/components")}>
              {t("components")}
            </LinkButton>
          </div>
        </LayerCard.Primary>
      </LayerCard>
      <LayerCard className="mt-4">
        <LayerCard.Secondary>Health</LayerCard.Secondary>
        <LayerCard.Primary className="gap-3">
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={healthQuery.data?.status === "ok" ? "active" : "disabled"} />
            <Text variant="secondary">
              {healthQuery.data?.database.status ?? "unknown"} ·{" "}
              {healthQuery.data?.storage.status ?? "unknown"}
            </Text>
          </div>
          <Text variant="secondary">Templates: {templatesQuery.data?.items.length ?? 0}</Text>
        </LayerCard.Primary>
      </LayerCard>
    </>
  );
}

function ResourceListView({ kind }: { kind: "pages" | "templates" }) {
  const context = useAdminContext();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const toast = useKumoToastManager();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [cursor, setCursor] = useState<string | undefined>();
  const [dialog, setDialog] = useState(false);
  const [editing, setEditing] = useState<Resource | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({
    key: "",
    title: "",
    description: "",
    status: "draft",
    categoryId: "",
    defaultPromptId: "",
    templateId: "",
    versionId: "",
  });
  const pageQuery = api.useQuery("get", "/api/v1/apps/{appId}/pages", {
    params: {
      path: { appId: context.appId ?? "" },
      query: {
        limit: "25",
        q: search || undefined,
        status: statusFilter || undefined,
        categoryId: categoryFilter || undefined,
        cursor,
      },
    },
  });
  const templateQuery = api.useQuery("get", "/api/v1/apps/{appId}/templates", {
    params: {
      path: { appId: context.appId ?? "" },
      query: {
        limit: "25",
        q: search || undefined,
        status: statusFilter || undefined,
        categoryId: categoryFilter || undefined,
        cursor,
      },
    },
  });
  const categoriesQuery = api.useQuery("get", "/api/v1/apps/{appId}/categories", {
    params: { path: { appId: context.appId ?? "" } },
  });
  const createPage = api.useMutation("post", "/api/v1/apps/{appId}/pages", {
    onSuccess: () => {
      setDialog(false);
      toast.add({ title: t("created"), description: t("pages") });
      void queryClient.invalidateQueries();
    },
  });
  const createTemplate = api.useMutation("post", "/api/v1/apps/{appId}/templates", {
    onSuccess: () => {
      setDialog(false);
      toast.add({ title: t("created"), description: t("templates") });
      void queryClient.invalidateQueries();
    },
  });
  const updatePage = api.useMutation("patch", "/api/v1/apps/{appId}/pages/{pageId}", {
    onSuccess: () => {
      setEditing(null);
      toast.add({ title: t("updated") });
      void queryClient.invalidateQueries();
    },
  });
  const updateTemplate = api.useMutation("patch", "/api/v1/apps/{appId}/templates/{templateId}", {
    onSuccess: () => {
      setEditing(null);
      toast.add({ title: t("updated") });
      void queryClient.invalidateQueries();
    },
  });
  const deletePage = api.useMutation("delete", "/api/v1/apps/{appId}/pages/{pageId}", {
    onSuccess: () => {
      setDeleteId(null);
      toast.add({ title: t("deleted") });
      void queryClient.invalidateQueries();
    },
  });
  const deleteTemplate = api.useMutation("delete", "/api/v1/apps/{appId}/templates/{templateId}", {
    onSuccess: () => {
      setDeleteId(null);
      toast.add({ title: t("deleted") });
      void queryClient.invalidateQueries();
    },
  });
  const promptsQuery = api.useQuery("get", "/api/v1/apps/{appId}/prompts", {
    params: { path: { appId: context.appId ?? "" } },
  });
  const result = kind === "pages" ? pageQuery : templateQuery;
  const resources = result.data?.items ?? [];
  const title = kind === "pages" ? t("pages") : t("templates");

  function openCreate() {
    setEditing(null);
    setForm({
      key: "",
      title: "",
      description: "",
      status: "draft",
      categoryId: "",
      defaultPromptId: "",
      templateId: "",
      versionId: "",
    });
    setDialog(true);
  }
  function openEdit(resource: Resource) {
    setEditing(resource);
    setForm({
      key: resource.key,
      title: resource.title,
      description: resource.description,
      status: resource.status,
      categoryId: resource.categoryId ?? "",
      defaultPromptId: ((resource as Record<string, unknown>).defaultPromptId as string) ?? "",
      templateId: "",
      versionId: "",
    });
    setDialog(true);
  }
  function submit() {
    const body = {
      key: form.key,
      title: form.title,
      description: form.description,
      status: form.status as "active" | "disabled" | "draft" | "published",
      ...(form.categoryId ? { categoryId: form.categoryId } : {}),
      ...(form.defaultPromptId
        ? { defaultPromptId: form.defaultPromptId }
        : editing
          ? { defaultPromptId: null }
          : {}),
    };
    if (editing) {
      if (kind === "pages")
        updatePage.mutate({
          params: { path: { appId: context.appId ?? "", pageId: editing.id } },
          body,
        });
      else
        updateTemplate.mutate({
          params: { path: { appId: context.appId ?? "", templateId: editing.id } },
          body,
        });
    } else if (kind === "pages") {
      createPage.mutate({
        params: { path: { appId: context.appId ?? "" } },
        body: {
          ...body,
          ...(form.templateId && form.versionId
            ? { sourceTemplate: { templateId: form.templateId, versionId: form.versionId } }
            : {}),
        },
      });
    } else createTemplate.mutate({ params: { path: { appId: context.appId ?? "" } }, body });
  }
  function remove() {
    if (!deleteId) return;
    if (kind === "pages")
      deletePage.mutate({ params: { path: { appId: context.appId ?? "", pageId: deleteId } } });
    else
      deleteTemplate.mutate({
        params: { path: { appId: context.appId ?? "", templateId: deleteId } },
      });
  }

  return (
    <>
      <PageHeader
        title={title}
        description="Search, filter, and manage published delivery resources."
      >
        <Button variant="primary" icon={Plus} onClick={openCreate}>
          {t("create")}
        </Button>
      </PageHeader>
      <div className="mb-4 flex flex-wrap gap-2">
        <Input
          aria-label={t("search")}
          placeholder={t("search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select
          aria-label={t("status")}
          placeholder={t("status")}
          items={{
            active: t("active"),
            disabled: t("disabled"),
            draft: t("draft"),
            published: t("published"),
          }}
          onValueChange={(value) => {
            if (typeof value === "string") {
              setStatusFilter(value);
              setCursor(undefined);
            }
          }}
        />
        <Select
          aria-label={t("categories")}
          placeholder={t("categories")}
          items={Object.fromEntries(
            (categoriesQuery.data ?? []).map((item) => [item.id, item.name]),
          )}
          onValueChange={(value) => {
            if (typeof value === "string") {
              setCategoryFilter(value);
              setCursor(undefined);
            }
          }}
        />
      </div>
      {result.error ? <ErrorState error={result.error} /> : null}
      {result.isLoading ? (
        <LoadingState />
      ) : resources.length === 0 ? (
        <Empty
          title={t("noResults")}
          description={t("noResultsDescription")}
          contents={<Button onClick={openCreate}>{t("create")}</Button>}
        />
      ) : (
        <LayerCard className="w-full overflow-x-auto p-0">
          <Table layout="fixed">
            <colgroup>
              <col />
              <col style={{ width: "140px" }} />
              <col style={{ width: "56px" }} />
            </colgroup>
            <Table.Header>
              <Table.Row>
                <Table.Head>{t("app")}</Table.Head>
                <Table.Head>{t("status")}</Table.Head>
                <Table.Head sticky="right">
                  <span className="sr-only">{t("actions")}</span>
                </Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {resources.map((resource) => (
                <Table.Row key={resource.id}>
                  <Table.Cell>
                    <a
                      className="font-medium text-kumo-link"
                      href={context.href(`/${kind}/${resource.id}`)}
                    >
                      {resource.title}
                    </a>
                    <div className="text-sm text-kumo-subtle">{resource.key}</div>
                  </Table.Cell>
                  <Table.Cell>
                    <StatusBadge status={resource.status} />
                  </Table.Cell>
                  <Table.Cell sticky="right" className="text-right">
                    <DropdownMenu>
                      <DropdownMenu.Trigger
                        render={
                          <Button
                            variant="ghost"
                            size="sm"
                            shape="square"
                            aria-label={t("moreOptions")}
                          >
                            <DotsThree weight="bold" size={16} />
                          </Button>
                        }
                      />
                      <DropdownMenu.Content>
                        <DropdownMenu.Item icon={PencilSimple} onClick={() => openEdit(resource)}>
                          {t("edit")}
                        </DropdownMenu.Item>
                        <DropdownMenu.Separator />
                        <DropdownMenu.Item
                          icon={Trash}
                          variant="danger"
                          onClick={() => setDeleteId(resource.id)}
                        >
                          {t("delete")}
                        </DropdownMenu.Item>
                      </DropdownMenu.Content>
                    </DropdownMenu>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </LayerCard>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <Button size="sm" disabled={!cursor} onClick={() => setCursor(undefined)}>
          {"Previous"}
        </Button>
        <Button
          size="sm"
          disabled={!result.data?.nextCursor}
          onClick={() => setCursor(result.data?.nextCursor ?? undefined)}
        >
          {"Next"}
        </Button>
      </div>
      <Dialog.Root open={dialog} onOpenChange={setDialog}>
        <Dialog size="lg" className="px-8 py-6">
          <Dialog.Title>
            {editing ? t("edit") : t("create")} {title}
          </Dialog.Title>
          <div className="grid gap-4 py-4">
            <Input
              label="Key"
              value={form.key}
              disabled={Boolean(editing)}
              onChange={(e) => setForm({ ...form, key: e.target.value })}
            />
            <Input
              label="Title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <Input
              label="Description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <Select
              label={t("status")}
              value={form.status}
              items={{
                active: t("active"),
                disabled: t("disabled"),
                draft: t("draft"),
                published: t("published"),
              }}
              onValueChange={(value) => {
                if (typeof value === "string") setForm({ ...form, status: value });
              }}
            />
            {kind === "pages" ? (
              <Select
                label={t("pageDefaultPrompt")}
                value={form.defaultPromptId || "none"}
                items={{
                  none: t("noneDefaultPrompt"),
                  ...Object.fromEntries(
                    (promptsQuery.data ?? []).map((p) => [p.id, `${p.name} (${p.key})`]),
                  ),
                }}
                onValueChange={(value) => {
                  if (typeof value === "string")
                    setForm({ ...form, defaultPromptId: value === "none" ? "" : value });
                }}
              />
            ) : null}
            {kind === "pages" && !editing ? (
              <>
                <Input
                  label="Template ID (optional)"
                  value={form.templateId}
                  onChange={(e) => setForm({ ...form, templateId: e.target.value })}
                />
                <Input
                  label="Template version ID (optional)"
                  value={form.versionId}
                  onChange={(e) => setForm({ ...form, versionId: e.target.value })}
                />
              </>
            ) : null}
          </div>
          <div className="flex justify-end gap-2">
            <Dialog.Close render={<Button>{t("cancel")}</Button>} />
            <Button
              variant="primary"
              loading={
                createPage.isPending ||
                createTemplate.isPending ||
                updatePage.isPending ||
                updateTemplate.isPending
              }
              onClick={submit}
            >
              {t("save")}
            </Button>
          </div>
        </Dialog>
      </Dialog.Root>
      <Dialog.Root
        role="alertdialog"
        open={Boolean(deleteId)}
        onOpenChange={(value) => {
          if (!value) setDeleteId(null);
        }}
      >
        <Dialog className="px-8 py-6">
          <Dialog.Title>
            {t("delete")} {title}
          </Dialog.Title>
          <Dialog.Description>
            This action may be rejected when the resource is referenced.
          </Dialog.Description>
          <div className="flex justify-end gap-2">
            <Dialog.Close render={<Button>{t("cancel")}</Button>} />
            <Button
              variant="destructive"
              loading={deletePage.isPending || deleteTemplate.isPending}
              onClick={remove}
            >
              {t("delete")}
            </Button>
          </div>
        </Dialog>
      </Dialog.Root>
    </>
  );
}

function ResourceDetailView() {
  const pathname = usePathname();
  const context = useAdminContext();
  const { t } = useI18n();
  const toast = useKumoToastManager();
  const queryClient = useQueryClient();
  const kind = pathname.startsWith("/pages/") ? "page" : "template";
  const id = pathname.split("/")[2] ?? "";
  const pageQuery = api.useQuery(
    "get",
    "/api/v1/apps/{appId}/pages/{pageId}",
    { params: { path: { appId: context.appId ?? "", pageId: id } } },
    { enabled: kind === "page" },
  );
  const pageResource = pageQuery.data as Resource | undefined;
  const sourceTemplateId =
    kind === "template" ? id : (pageResource?.sourceTemplate?.templateId ?? "");
  const templateQuery = api.useQuery(
    "get",
    "/api/v1/apps/{appId}/templates/{templateId}",
    { params: { path: { appId: context.appId ?? "", templateId: sourceTemplateId } } },
    {
      enabled: kind === "template" || Boolean(pageResource?.sourceTemplate?.templateId),
    },
  );
  const resource = (kind === "page" ? pageQuery.data : templateQuery.data) as Resource | undefined;
  const _documentQuery = api.useQuery(
    "get",
    "/api/v1/apps/{appId}/documents/{documentId}",
    { params: { path: { appId: context.appId ?? "", documentId: resource?.documentId ?? "" } } },
    { enabled: Boolean(resource?.documentId) },
  );
  const draftQuery = api.useQuery(
    "get",
    "/api/v1/apps/{appId}/documents/{documentId}/draft",
    { params: { path: { appId: context.appId ?? "", documentId: resource?.documentId ?? "" } } },
    { enabled: Boolean(resource?.documentId) },
  );
  const versionsQuery = api.useQuery(
    "get",
    "/api/v1/apps/{appId}/documents/{documentId}/versions",
    { params: { path: { appId: context.appId ?? "", documentId: resource?.documentId ?? "" } } },
    { enabled: Boolean(resource?.documentId) },
  );
  const releasesQuery = api.useQuery(
    "get",
    "/api/v1/apps/{appId}/documents/{documentId}/releases",
    { params: { path: { appId: context.appId ?? "", documentId: resource?.documentId ?? "" } } },
    { enabled: Boolean(resource?.documentId) },
  );
  const profilesQuery = api.useQuery("get", "/api/v1/apps/{appId}/preview-profiles", {
    params: { path: { appId: context.appId ?? "" } },
  });
  const promptsQuery = api.useQuery("get", "/api/v1/apps/{appId}/prompts", {
    params: { path: { appId: context.appId ?? "" } },
  });
  const updatePageMutation = api.useMutation("patch", "/api/v1/apps/{appId}/pages/{pageId}", {
    onSuccess: () => {
      toast.add({ title: t("updated") });
      void queryClient.invalidateQueries();
    },
  });
  const version = api.useMutation("post", "/api/v1/apps/{appId}/documents/{documentId}/versions", {
    onSuccess: () => {
      toast.add({ title: t("created"), description: t("versions") });
      void queryClient.invalidateQueries();
    },
  });
  const release = api.useMutation("post", "/api/v1/apps/{appId}/documents/{documentId}/releases", {
    onSuccess: () => {
      toast.add({ title: t("created"), description: t("releases") });
      void queryClient.invalidateQueries();
    },
  });
  const studioWindow = useRef<Window | null>(null);
  const studio = api.useMutation("post", "/api/v1/apps/{appId}/studio-sessions", {
    onSuccess: (data) => {
      const launchWindow = studioWindow.current;
      studioWindow.current = null;
      if (!data?.launchUrl) {
        launchWindow?.close();
        return;
      }
      if (launchWindow && !launchWindow.closed) {
        launchWindow.location.replace(data.launchUrl);
        return;
      }
      window.location.assign(data.launchUrl);
    },
    onError: () => {
      studioWindow.current?.close();
      studioWindow.current = null;
    },
  });
  const [versionMessage, setVersionMessage] = useState("");
  const [channel, setChannel] = useState("production");
  if (pageQuery.isLoading || templateQuery.isLoading) return <LoadingState />;
  if (!resource) return <ErrorState error={pageQuery.error || templateQuery.error} />;
  const profile = profilesQuery.data?.find((item) => item.isDefault) ?? profilesQuery.data?.[0];
  const json = JSON.stringify(
    (draftQuery.data as { document?: unknown } | undefined)?.document ?? {},
    null,
    2,
  );
  return (
    <>
      <PageHeader title={resource.title} description={resource.description}>
        <StatusBadge status={resource.status} />
        <Button
          loading={studio.isPending}
          onClick={() => {
            if (!profile) return;
            studioWindow.current = window.open("", "_blank");
            if (studioWindow.current) studioWindow.current.opener = null;
            studio.mutate({
              params: { path: { appId: context.appId ?? "" } },
              body: {
                resourceKind: kind,
                resourceId: resource.id,
                previewProfileId: profile.id,
                returnUrl: window.location.href,
              },
            });
          }}
        >
          {t("studio")}
        </Button>
      </PageHeader>
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Surface className="grid gap-3 p-4">
          <Text variant="heading" as="h2">
            {t("draft")}
          </Text>
          <Code code={json} lang="jsonc" />
        </Surface>
        <Surface className="grid gap-4 p-4">
          <Text variant="heading" as="h2">
            {t("versions")}
          </Text>
          <Button
            onClick={() =>
              version.mutate({
                params: { path: { appId: context.appId ?? "", documentId: resource.documentId } },
                body: { message: versionMessage },
              })
            }
          >
            {t("create")}
          </Button>
          <Input
            label="Message"
            value={versionMessage}
            onChange={(e) => setVersionMessage(e.target.value)}
          />
          {(versionsQuery.data ?? []).map((item) => (
            <div key={item.id} className="flex justify-between border-b border-kumo-line py-2">
              <Text>
                v{item.versionNumber} · {item.message || "—"}
              </Text>
              <Button
                size="sm"
                onClick={() =>
                  release.mutate({
                    params: {
                      path: { appId: context.appId ?? "", documentId: resource.documentId },
                    },
                    body: { versionId: item.id, channel },
                  })
                }
              >
                {t("releases")}
              </Button>
            </div>
          ))}
          <Input label="Channel" value={channel} onChange={(e) => setChannel(e.target.value)} />
        </Surface>
        {kind === "page" && (
          <Surface className="grid gap-3 p-4">
            <Text variant="heading" as="h2">
              {t("pageDefaultPrompt")}
            </Text>
            <Text variant="secondary">{t("pageDefaultPromptDescription")}</Text>
            <Select
              label={t("pageDefaultPrompt")}
              value={((resource as Record<string, unknown>)?.defaultPromptId as string) ?? "none"}
              items={{
                none: t("noneDefaultPrompt"),
                ...Object.fromEntries(
                  (promptsQuery.data ?? []).map((p) => [p.id, `${p.name} (${p.key})`]),
                ),
              }}
              onValueChange={(val) => {
                if (typeof val === "string") {
                  updatePageMutation.mutate({
                    params: { path: { appId: context.appId ?? "", pageId: resource.id } },
                    body: { defaultPromptId: val === "none" ? null : val },
                  });
                }
              }}
            />
          </Surface>
        )}
      </div>
      <Surface className="mt-4 grid gap-2 p-4">
        <Text variant="heading" as="h2">
          {t("releases")}
        </Text>
        {(releasesQuery.data ?? []).map((item) => (
          <div key={item.id} className="flex justify-between">
            <Text>{item.channel}</Text>
            <StatusBadge status={item.status} />
          </div>
        ))}
      </Surface>
    </>
  );
}

function PreviewProfilesView() {
  const context = useAdminContext();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const toast = useKumoToastManager();
  const [dialog, setDialog] = useState(false);
  const [editing, setEditing] = useState<{ id: string } | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", url: "", origins: "", isDefault: false });
  const query = api.useQuery("get", "/api/v1/apps/{appId}/preview-profiles", {
    params: { path: { appId: context.appId ?? "" } },
  });
  const create = api.useMutation("post", "/api/v1/apps/{appId}/preview-profiles", {
    onSuccess: () => {
      setDialog(false);
      toast.add({ title: t("created") });
      void queryClient.invalidateQueries();
    },
  });
  const update = api.useMutation("patch", "/api/v1/apps/{appId}/preview-profiles/{profileId}", {
    onSuccess: () => {
      setDialog(false);
      setEditing(null);
      toast.add({ title: t("updated") });
      void queryClient.invalidateQueries();
    },
  });
  const remove = api.useMutation("delete", "/api/v1/apps/{appId}/preview-profiles/{profileId}", {
    onSuccess: () => {
      setDeleteId(null);
      toast.add({ title: t("deleted") });
      void queryClient.invalidateQueries();
    },
  });
  const profiles = query.data ?? [];
  function openCreate() {
    setEditing(null);
    setForm({ name: "", url: "", origins: "", isDefault: false });
    setDialog(true);
  }
  function openEdit(profile: (typeof profiles)[number]) {
    setEditing(profile);
    setForm({
      name: profile.name,
      url: profile.url,
      origins: profile.allowedOrigins.join("\n"),
      isDefault: profile.isDefault,
    });
    setDialog(true);
  }
  function submit() {
    const body = {
      name: form.name,
      url: form.url,
      allowedOrigins: form.origins
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean),
      isDefault: form.isDefault,
    };
    if (editing)
      update.mutate({
        params: { path: { appId: context.appId ?? "", profileId: editing.id } },
        body,
      });
    else create.mutate({ params: { path: { appId: context.appId ?? "" } }, body });
  }
  return (
    <>
      <PageHeader
        title={t("previewProfiles")}
        description="Configure allowed origins for Studio handoff."
      >
        <Button variant="primary" icon={Plus} onClick={openCreate}>
          {t("create")}
        </Button>
      </PageHeader>
      {query.error ? <ErrorState error={query.error} /> : null}
      {query.isLoading ? (
        <LoadingState />
      ) : profiles.length === 0 ? (
        <Empty
          title={t("noResults")}
          contents={<Button onClick={openCreate}>{t("create")}</Button>}
        />
      ) : (
        <LayerCard className="w-full overflow-x-auto p-0">
          <Table layout="fixed">
            <colgroup>
              <col />
              <col />
              <col style={{ width: "140px" }} />
              <col style={{ width: "56px" }} />
            </colgroup>
            <Table.Header>
              <Table.Row>
                <Table.Head>Name</Table.Head>
                <Table.Head>URL</Table.Head>
                <Table.Head>{t("status")}</Table.Head>
                <Table.Head sticky="right">
                  <span className="sr-only">{t("actions")}</span>
                </Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {profiles.map((profile) => (
                <Table.Row key={profile.id}>
                  <Table.Cell>{profile.name}</Table.Cell>
                  <Table.Cell>
                    <Code code={profile.url} lang="ts" />
                  </Table.Cell>
                  <Table.Cell>
                    {profile.isDefault ? <Badge variant="green">{t("default")}</Badge> : "—"}
                  </Table.Cell>
                  <Table.Cell sticky="right" className="text-right">
                    <DropdownMenu>
                      <DropdownMenu.Trigger
                        render={
                          <Button
                            variant="ghost"
                            size="sm"
                            shape="square"
                            aria-label={t("moreOptions")}
                          >
                            <DotsThree weight="bold" size={16} />
                          </Button>
                        }
                      />
                      <DropdownMenu.Content>
                        <DropdownMenu.Item icon={PencilSimple} onClick={() => openEdit(profile)}>
                          {t("edit")}
                        </DropdownMenu.Item>
                        <DropdownMenu.Item
                          icon={Star}
                          onClick={() =>
                            update.mutate({
                              params: {
                                path: { appId: context.appId ?? "", profileId: profile.id },
                              },
                              body: { isDefault: !profile.isDefault },
                            })
                          }
                        >
                          {profile.isDefault ? t("removeDefault") : t("setDefault")}
                        </DropdownMenu.Item>
                        <DropdownMenu.Separator />
                        <DropdownMenu.Item
                          icon={Trash}
                          variant="danger"
                          onClick={() => setDeleteId(profile.id)}
                        >
                          {t("delete")}
                        </DropdownMenu.Item>
                      </DropdownMenu.Content>
                    </DropdownMenu>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </LayerCard>
      )}
      <Dialog.Root open={dialog} onOpenChange={setDialog}>
        <Dialog size="lg" className="px-8 py-6">
          <Dialog.Title>
            {editing ? t("edit") : t("create")} {t("previewProfiles")}
          </Dialog.Title>
          <div className="grid gap-4 py-4">
            <Input
              label="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <Input
              label="URL"
              type="url"
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
            />
            <Textarea
              label="Allowed origins"
              value={form.origins}
              onChange={(e) => setForm({ ...form, origins: e.target.value })}
              description="One URL per line."
            />
            <Switch
              checked={form.isDefault}
              label={t("default")}
              onCheckedChange={(checked) => setForm({ ...form, isDefault: checked })}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Dialog.Close render={<Button>{t("cancel")}</Button>} />
            <Button variant="primary" onClick={submit}>
              {t("save")}
            </Button>
          </div>
        </Dialog>
      </Dialog.Root>
      <Dialog.Root
        role="alertdialog"
        open={Boolean(deleteId)}
        onOpenChange={(value) => {
          if (!value) setDeleteId(null);
        }}
      >
        <Dialog className="px-8 py-6">
          <Dialog.Title>{t("delete")}</Dialog.Title>
          <div className="flex justify-end gap-2">
            <Dialog.Close render={<Button>{t("cancel")}</Button>} />
            <Button
              variant="destructive"
              onClick={() =>
                deleteId &&
                remove.mutate({
                  params: { path: { appId: context.appId ?? "", profileId: deleteId } },
                })
              }
            >
              {t("delete")}
            </Button>
          </div>
        </Dialog>
      </Dialog.Root>
    </>
  );
}

function CategoriesView() {
  const context = useAdminContext();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const toast = useKumoToastManager();
  const [dialog, setDialog] = useState(false);
  const [editing, setEditing] = useState<{ id: string } | null>(null);
  const [form, setForm] = useState({ scope: "shared", key: "", name: "", isDefault: false });
  const query = api.useQuery("get", "/api/v1/apps/{appId}/categories", {
    params: { path: { appId: context.appId ?? "" } },
  });
  const create = api.useMutation("post", "/api/v1/apps/{appId}/categories", {
    onSuccess: () => {
      setDialog(false);
      toast.add({ title: t("created") });
      void queryClient.invalidateQueries();
    },
  });
  const update = api.useMutation("patch", "/api/v1/apps/{appId}/categories/{categoryId}", {
    onSuccess: () => {
      setDialog(false);
      setEditing(null);
      toast.add({ title: t("updated") });
      void queryClient.invalidateQueries();
    },
  });
  const remove = api.useMutation("delete", "/api/v1/apps/{appId}/categories/{categoryId}", {
    onSuccess: () => {
      toast.add({ title: t("deleted") });
      void queryClient.invalidateQueries();
    },
  });
  const items = query.data ?? [];
  return (
    <>
      <PageHeader title={t("categories")}>
        <Button
          variant="primary"
          icon={Plus}
          onClick={() => {
            setEditing(null);
            setForm({ scope: "shared", key: "", name: "", isDefault: false });
            setDialog(true);
          }}
        >
          {t("create")}
        </Button>
      </PageHeader>
      {query.error ? <ErrorState error={query.error} /> : null}
      <LayerCard className="w-full overflow-x-auto p-0">
        <Table layout="fixed">
          <colgroup>
            <col />
            <col />
            <col style={{ width: "140px" }} />
            <col style={{ width: "140px" }} />
            <col style={{ width: "56px" }} />
          </colgroup>
          <Table.Header>
            <Table.Row>
              <Table.Head>Key</Table.Head>
              <Table.Head>Name</Table.Head>
              <Table.Head>Scope</Table.Head>
              <Table.Head>{t("status")}</Table.Head>
              <Table.Head sticky="right">
                <span className="sr-only">{t("actions")}</span>
              </Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {items.map((item) => (
              <Table.Row key={item.id}>
                <Table.Cell>
                  <Code code={item.key} lang="ts" />
                </Table.Cell>
                <Table.Cell>{item.name}</Table.Cell>
                <Table.Cell>{item.scope}</Table.Cell>
                <Table.Cell>
                  {item.isDefault ? <Badge variant="green">{t("default")}</Badge> : "—"}
                </Table.Cell>
                <Table.Cell sticky="right" className="text-right">
                  <DropdownMenu>
                    <DropdownMenu.Trigger
                      render={
                        <Button
                          variant="ghost"
                          size="sm"
                          shape="square"
                          aria-label={t("moreOptions")}
                        >
                          <DotsThree weight="bold" size={16} />
                        </Button>
                      }
                    />
                    <DropdownMenu.Content>
                      <DropdownMenu.Item
                        icon={PencilSimple}
                        onClick={() => {
                          setEditing(item);
                          setForm({
                            scope: item.scope,
                            key: item.key,
                            name: item.name,
                            isDefault: item.isDefault,
                          });
                          setDialog(true);
                        }}
                      >
                        {t("edit")}
                      </DropdownMenu.Item>
                      <DropdownMenu.Item
                        icon={Star}
                        onClick={() =>
                          update.mutate({
                            params: { path: { appId: context.appId ?? "", categoryId: item.id } },
                            body: { isDefault: !item.isDefault },
                          })
                        }
                      >
                        {item.isDefault ? t("removeDefault") : t("setDefault")}
                      </DropdownMenu.Item>
                      <DropdownMenu.Separator />
                      <DropdownMenu.Item
                        icon={Trash}
                        variant="danger"
                        onClick={() =>
                          remove.mutate({
                            params: { path: { appId: context.appId ?? "", categoryId: item.id } },
                          })
                        }
                      >
                        {t("delete")}
                      </DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </LayerCard>
      <Dialog.Root open={dialog} onOpenChange={setDialog}>
        <Dialog size="lg" className="px-8 py-6">
          <Dialog.Title>
            {editing ? t("edit") : t("create")} {t("categories")}
          </Dialog.Title>
          <div className="grid gap-4 py-4">
            <Input
              label="Key"
              disabled={Boolean(editing)}
              value={form.key}
              onChange={(e) => setForm({ ...form, key: e.target.value })}
            />
            <Input
              label="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <Select
              label="Scope"
              value={form.scope}
              items={{ page: t("pages"), template: t("templates"), shared: "Shared" }}
              onValueChange={(value) => {
                if (typeof value === "string") setForm({ ...form, scope: value });
              }}
            />
            <Switch
              checked={form.isDefault}
              label={t("default")}
              onCheckedChange={(checked) => setForm({ ...form, isDefault: checked })}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Dialog.Close render={<Button>{t("cancel")}</Button>} />
            <Button
              variant="primary"
              onClick={() => {
                const body = {
                  scope: form.scope as "page" | "template" | "shared",
                  name: form.name,
                  ...(editing ? {} : { key: form.key }),
                  isDefault: form.isDefault,
                };
                if (editing)
                  update.mutate({
                    params: { path: { appId: context.appId ?? "", categoryId: editing.id } },
                    body,
                  });
                else
                  create.mutate({
                    params: { path: { appId: context.appId ?? "" } },
                    body: { ...body, key: form.key },
                  });
              }}
            >
              {t("save")}
            </Button>
          </div>
        </Dialog>
      </Dialog.Root>
    </>
  );
}

function OpenApiDocsView() {
  const context = useAdminContext();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const toast = useKumoToastManager();
  const [dialog, setDialog] = useState(false);
  const [editing, setEditing] = useState<{ id: string } | null>(null);
  const [form, setForm] = useState({ name: "", json: "", isDefault: false });
  const [jsonInvalid, setJsonInvalid] = useState(false);
  const query = api.useQuery("get", "/api/v1/apps/{appId}/openapi-docs", {
    params: { path: { appId: context.appId ?? "" } },
  });
  const create = api.useMutation("post", "/api/v1/apps/{appId}/openapi-docs", {
    onSuccess: () => {
      setDialog(false);
      toast.add({ title: t("created") });
      void queryClient.invalidateQueries();
    },
  });
  const update = api.useMutation("patch", "/api/v1/apps/{appId}/openapi-docs/{openApiDocId}", {
    onSuccess: () => {
      setDialog(false);
      setEditing(null);
      toast.add({ title: t("updated") });
      void queryClient.invalidateQueries();
    },
  });
  const remove = api.useMutation("delete", "/api/v1/apps/{appId}/openapi-docs/{openApiDocId}", {
    onSuccess: () => {
      toast.add({ title: t("deleted") });
      void queryClient.invalidateQueries();
    },
  });
  const items = query.data ?? [];
  return (
    <>
      <PageHeader title={t("openapiDocs")}>
        <Button
          variant="primary"
          icon={Plus}
          onClick={() => {
            setEditing(null);
            setForm({ name: "", json: "", isDefault: false });
            setJsonInvalid(false);
            setDialog(true);
          }}
        >
          {t("create")}
        </Button>
      </PageHeader>
      {query.error ? <ErrorState error={query.error} /> : null}
      <LayerCard className="w-full overflow-x-auto p-0">
        <Table layout="fixed">
          <colgroup>
            <col />
            <col style={{ width: "140px" }} />
            <col style={{ width: "140px" }} />
            <col style={{ width: "56px" }} />
          </colgroup>
          <Table.Header>
            <Table.Row>
              <Table.Head>{t("openApiName")}</Table.Head>
              <Table.Head>{t("openApiEndpoints")}</Table.Head>
              <Table.Head>{t("status")}</Table.Head>
              <Table.Head sticky="right">
                <span className="sr-only">{t("actions")}</span>
              </Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {items.map((item) => (
              <Table.Row key={item.id}>
                <Table.Cell>{item.name}</Table.Cell>
                <Table.Cell>
                  {
                    Object.keys((item.json as { paths?: Record<string, unknown> })?.paths ?? {})
                      .length
                  }
                </Table.Cell>
                <Table.Cell>
                  {item.isDefault ? <Badge variant="green">{t("default")}</Badge> : "—"}
                </Table.Cell>
                <Table.Cell sticky="right" className="text-right">
                  <DropdownMenu>
                    <DropdownMenu.Trigger
                      render={
                        <Button
                          variant="ghost"
                          size="sm"
                          shape="square"
                          aria-label={t("moreOptions")}
                        >
                          <DotsThree weight="bold" size={16} />
                        </Button>
                      }
                    />
                    <DropdownMenu.Content>
                      <DropdownMenu.Item
                        icon={PencilSimple}
                        onClick={() => {
                          setEditing(item);
                          setForm({
                            name: item.name,
                            json: JSON.stringify(item.json, null, 2),
                            isDefault: item.isDefault,
                          });
                          setJsonInvalid(false);
                          setDialog(true);
                        }}
                      >
                        {t("edit")}
                      </DropdownMenu.Item>
                      <DropdownMenu.Item
                        icon={Star}
                        onClick={() =>
                          update.mutate({
                            params: {
                              path: { appId: context.appId ?? "", openApiDocId: item.id },
                            },
                            body: { isDefault: !item.isDefault },
                          })
                        }
                      >
                        {item.isDefault ? t("removeDefault") : t("setDefault")}
                      </DropdownMenu.Item>
                      <DropdownMenu.Separator />
                      <DropdownMenu.Item
                        icon={Trash}
                        variant="danger"
                        onClick={() =>
                          remove.mutate({
                            params: {
                              path: { appId: context.appId ?? "", openApiDocId: item.id },
                            },
                          })
                        }
                      >
                        {t("delete")}
                      </DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </LayerCard>
      <Dialog.Root open={dialog} onOpenChange={setDialog}>
        <Dialog size="lg" className="px-8 py-6">
          <Dialog.Title>
            {editing ? t("edit") : t("create")} {t("openapiDocs")}
          </Dialog.Title>
          <div className="grid gap-4 py-4">
            <Input
              label={t("openApiName")}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <Textarea
              label={t("openApiJson")}
              className="font-mono"
              rows={14}
              value={form.json}
              error={jsonInvalid ? t("openApiJsonInvalid") : undefined}
              onChange={(e) => {
                const next = e.target.value;
                setForm({ ...form, json: next });
                if (next.trim() === "") {
                  setJsonInvalid(false);
                  return;
                }
                try {
                  const parsed = JSON.parse(next);
                  setJsonInvalid(
                    typeof parsed !== "object" ||
                      parsed === null ||
                      Array.isArray(parsed) ||
                      typeof (parsed as { paths?: unknown }).paths !== "object" ||
                      (parsed as { paths?: unknown }).paths === null ||
                      Array.isArray((parsed as { paths?: unknown }).paths),
                  );
                } catch {
                  setJsonInvalid(true);
                }
              }}
            />
            <Switch
              checked={form.isDefault}
              label={t("default")}
              onCheckedChange={(checked) => setForm({ ...form, isDefault: checked })}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Dialog.Close render={<Button>{t("cancel")}</Button>} />
            <Button
              variant="primary"
              disabled={jsonInvalid || form.name.trim() === ""}
              onClick={() => {
                let parsedJson: Record<string, unknown>;
                try {
                  parsedJson = JSON.parse(form.json);
                } catch {
                  setJsonInvalid(true);
                  return;
                }
                const body = {
                  name: form.name,
                  json: parsedJson,
                  isDefault: form.isDefault,
                };
                if (editing)
                  update.mutate({
                    params: {
                      path: { appId: context.appId ?? "", openApiDocId: editing.id },
                    },
                    body,
                  });
                else
                  create.mutate({
                    params: { path: { appId: context.appId ?? "" } },
                    body,
                  });
              }}
            >
              {t("save")}
            </Button>
          </div>
        </Dialog>
      </Dialog.Root>
    </>
  );
}

function LocalesView() {
  const context = useAdminContext();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const toast = useKumoToastManager();
  const [dialog, setDialog] = useState(false);
  const [editing, setEditing] = useState<{ id: string } | null>(null);
  const [form, setForm] = useState({ code: "", name: "", isDefault: false });
  const query = api.useQuery("get", "/api/v1/apps/{appId}/locales", {
    params: { path: { appId: context.appId ?? "" } },
  });
  const create = api.useMutation("post", "/api/v1/apps/{appId}/locales", {
    onSuccess: () => {
      setDialog(false);
      toast.add({ title: t("created") });
      void queryClient.invalidateQueries();
    },
  });
  const update = api.useMutation("patch", "/api/v1/apps/{appId}/locales/{localeId}", {
    onSuccess: () => {
      setDialog(false);
      toast.add({ title: t("updated") });
      void queryClient.invalidateQueries();
    },
  });
  const remove = api.useMutation("delete", "/api/v1/apps/{appId}/locales/{localeId}", {
    onSuccess: () => {
      toast.add({ title: t("deleted") });
      void queryClient.invalidateQueries();
    },
  });
  const items = query.data ?? [];
  return (
    <>
      <PageHeader title={t("locales")}>
        <Button
          variant="primary"
          icon={Plus}
          onClick={() => {
            setEditing(null);
            setForm({ code: "", name: "", isDefault: false });
            setDialog(true);
          }}
        >
          {t("create")}
        </Button>
      </PageHeader>
      {query.error ? <ErrorState error={query.error} /> : null}
      <LayerCard className="w-full overflow-x-auto p-0">
        <Table layout="fixed">
          <colgroup>
            <col />
            <col />
            <col style={{ width: "140px" }} />
            <col style={{ width: "56px" }} />
          </colgroup>
          <Table.Header>
            <Table.Row>
              <Table.Head>Code</Table.Head>
              <Table.Head>Name</Table.Head>
              <Table.Head>{t("status")}</Table.Head>
              <Table.Head sticky="right">
                <span className="sr-only">{t("actions")}</span>
              </Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {items.map((item) => (
              <Table.Row key={item.id}>
                <Table.Cell>
                  <Code code={item.code} lang="ts" />
                </Table.Cell>
                <Table.Cell>{item.name}</Table.Cell>
                <Table.Cell>
                  {item.isDefault ? <Badge variant="green">{t("default")}</Badge> : "—"}
                </Table.Cell>
                <Table.Cell sticky="right" className="text-right">
                  <DropdownMenu>
                    <DropdownMenu.Trigger
                      render={
                        <Button
                          variant="ghost"
                          size="sm"
                          shape="square"
                          aria-label={t("moreOptions")}
                        >
                          <DotsThree weight="bold" size={16} />
                        </Button>
                      }
                    />
                    <DropdownMenu.Content>
                      <DropdownMenu.Item
                        icon={PencilSimple}
                        onClick={() => {
                          setEditing(item);
                          setForm({ code: item.code, name: item.name, isDefault: item.isDefault });
                          setDialog(true);
                        }}
                      >
                        {t("edit")}
                      </DropdownMenu.Item>
                      <DropdownMenu.Item
                        icon={Star}
                        onClick={() =>
                          update.mutate({
                            params: { path: { appId: context.appId ?? "", localeId: item.id } },
                            body: { isDefault: !item.isDefault },
                          })
                        }
                      >
                        {item.isDefault ? t("removeDefault") : t("setDefault")}
                      </DropdownMenu.Item>
                      <DropdownMenu.Separator />
                      <DropdownMenu.Item
                        icon={Trash}
                        variant="danger"
                        onClick={() =>
                          remove.mutate({
                            params: { path: { appId: context.appId ?? "", localeId: item.id } },
                          })
                        }
                      >
                        {t("delete")}
                      </DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </LayerCard>
      <Dialog.Root open={dialog} onOpenChange={setDialog}>
        <Dialog size="lg" className="px-8 py-6">
          <Dialog.Title>
            {editing ? t("edit") : t("create")} {t("locales")}
          </Dialog.Title>
          <div className="grid gap-4 py-4">
            <Input
              label="Code"
              disabled={Boolean(editing)}
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
            />
            <Input
              label="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <Switch
              checked={form.isDefault}
              label={t("default")}
              onCheckedChange={(checked) => setForm({ ...form, isDefault: checked })}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Dialog.Close render={<Button>{t("cancel")}</Button>} />
            <Button
              variant="primary"
              onClick={() =>
                editing
                  ? update.mutate({
                      params: { path: { appId: context.appId ?? "", localeId: editing.id } },
                      body: { name: form.name },
                    })
                  : create.mutate({ params: { path: { appId: context.appId ?? "" } }, body: form })
              }
            >
              {t("save")}
            </Button>
          </div>
        </Dialog>
      </Dialog.Root>
    </>
  );
}

function AssetsView() {
  const context = useAdminContext();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const toast = useKumoToastManager();
  const [file, setFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState("");
  const query = api.useQuery("get", "/api/v1/apps/{appId}/assets", {
    params: { path: { appId: context.appId ?? "" } },
  });
  const intent = api.useMutation("post", "/api/v1/apps/{appId}/assets/upload-intents", {
    onSuccess: () => {
      toast.add({ title: t("created") });
    },
  });
  const complete = api.useMutation("post", "/api/v1/apps/{appId}/assets/{assetId}/complete", {
    onSuccess: () => {
      setFile(null);
      setUploadError("");
      toast.add({ title: t("updated") });
      void queryClient.invalidateQueries();
    },
  });
  const remove = api.useMutation("delete", "/api/v1/apps/{appId}/assets/{assetId}", {
    onSuccess: () => {
      toast.add({ title: t("deleted") });
      void queryClient.invalidateQueries();
    },
  });
  async function upload() {
    if (!file || !context.appId) return;
    setUploadError("");
    try {
      const result = await intent.mutateAsync({
        params: { path: { appId: context.appId } },
        body: {
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
        },
      });
      const put = await fetch(result.uploadUrl, {
        method: "PUT",
        headers: { "content-type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!put.ok) throw new Error(`Upload failed (${put.status})`);
      await complete.mutateAsync({
        params: { path: { appId: context.appId, assetId: result.asset.id } },
        body: {},
      });
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : t("requestFailed"));
    }
  }
  return (
    <>
      <PageHeader
        title={t("assets")}
        description="Upload through a presigned browser URL and complete the asset record."
      >
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-kumo-base px-3 py-2 ring ring-kumo-line">
          <Plus size={16} />
          {t("create")}
          <input
            type="file"
            className="sr-only"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </label>
        <Button
          variant="primary"
          loading={intent.isPending || complete.isPending}
          disabled={!file}
          onClick={upload}
        >
          {t("save")}
        </Button>
      </PageHeader>
      {file ? (
        <Surface className="mb-4 grid gap-2 p-4">
          <Text>
            {file.name} · {file.size.toLocaleString()} bytes
          </Text>
          {uploadError ? <Text variant="error">{uploadError}</Text> : null}
          <Text variant="secondary">Failed uploads keep the file selected so you can retry.</Text>
        </Surface>
      ) : null}
      {query.error ? <ErrorState error={query.error} /> : null}
      <LayerCard className="w-full overflow-x-auto p-0">
        <Table layout="fixed">
          <colgroup>
            <col />
            <col style={{ width: "120px" }} />
            <col style={{ width: "140px" }} />
            <col style={{ width: "56px" }} />
          </colgroup>
          <Table.Header>
            <Table.Row>
              <Table.Head>File</Table.Head>
              <Table.Head>Status</Table.Head>
              <Table.Head>Size</Table.Head>
              <Table.Head sticky="right">
                <span className="sr-only">{t("actions")}</span>
              </Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {(query.data ?? []).map((asset) => (
              <Table.Row key={asset.id}>
                <Table.Cell>{asset.fileName}</Table.Cell>
                <Table.Cell>
                  <StatusBadge
                    status={
                      asset.status === "ready"
                        ? "active"
                        : asset.status === "failed"
                          ? "disabled"
                          : "draft"
                    }
                  />
                </Table.Cell>
                <Table.Cell>{asset.size.toLocaleString()} bytes</Table.Cell>
                <Table.Cell sticky="right" className="text-right">
                  <DropdownMenu>
                    <DropdownMenu.Trigger
                      render={
                        <Button
                          variant="ghost"
                          size="sm"
                          shape="square"
                          aria-label={t("moreOptions")}
                        >
                          <DotsThree weight="bold" size={16} />
                        </Button>
                      }
                    />
                    <DropdownMenu.Content>
                      <DropdownMenu.Item
                        icon={Trash}
                        variant="danger"
                        onClick={() =>
                          remove.mutate({
                            params: { path: { appId: context.appId ?? "", assetId: asset.id } },
                          })
                        }
                      >
                        {t("delete")}
                      </DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </LayerCard>
    </>
  );
}

function JsonModalDialog({
  open,
  onOpenChange,
  title,
  description,
  data,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  data: unknown;
}) {
  const { t } = useI18n();
  const toast = useKumoToastManager();
  const jsonString = useMemo(() => JSON.stringify(data ?? {}, null, 2), [data]);

  const copyToClipboard = () => {
    void navigator.clipboard?.writeText(jsonString);
    toast.add({ title: t("copied") });
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog size="xl" className="max-h-[85vh] max-w-4xl overflow-y-auto px-8 py-6">
        <div className="flex items-center justify-between pb-2">
          <div>
            <Dialog.Title>{title}</Dialog.Title>
            {description ? <Dialog.Description>{description}</Dialog.Description> : null}
          </div>
          <Button size="sm" variant="secondary" onClick={copyToClipboard}>
            <Copy size={14} className="mr-1 inline" />
            {t("copyJson")}
          </Button>
        </div>
        <div className="my-3 max-h-[55vh] overflow-auto rounded-lg border border-kumo-line bg-kumo-canvas p-3">
          <Code code={jsonString} lang="jsonc" />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Dialog.Close render={<Button variant="primary">{t("continue")}</Button>} />
        </div>
      </Dialog>
    </Dialog.Root>
  );
}

function ComponentsView() {
  const context = useAdminContext();
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const query = api.useQuery("get", "/api/v1/apps/{appId}/manifest", {
    params: { path: { appId: context.appId ?? "" } },
  });
  const manifest = getActiveManifest(query.data);
  const revision =
    typeof query.data === "object" &&
    query.data !== null &&
    "revision" in query.data &&
    typeof query.data.revision === "object" &&
    query.data.revision !== null &&
    "createdAt" in query.data.revision &&
    typeof query.data.revision.createdAt === "string"
      ? query.data.revision.createdAt
      : null;

  const categoryCounts = useMemo(() => {
    if (!manifest) return {};
    const counts: Record<string, number> = {};
    for (const component of Object.values(manifest.components)) {
      const category = component.category?.trim() || "uncategorized";
      counts[category] = (counts[category] || 0) + 1;
    }
    return counts;
  }, [manifest]);

  const categoryItems = useMemo(() => {
    const total = manifest ? Object.keys(manifest.components).length : 0;
    const items: Record<string, string> = {
      all: `${t("allCategories")} (${total})`,
    };
    for (const [category, count] of Object.entries(categoryCounts).sort((a, b) =>
      a[0].localeCompare(b[0]),
    )) {
      const label = category === "uncategorized" ? t("uncategorized") : category;
      items[category] = `${label} (${count})`;
    }
    return items;
  }, [categoryCounts, manifest, t]);

  const normalizedSearch = search.trim().toLocaleLowerCase();
  const components = manifest
    ? Object.entries(manifest.components)
        .map(([key, component]) => ({ key, component }))
        .sort((left, right) => (left.key < right.key ? -1 : left.key > right.key ? 1 : 0))
        .filter(({ key, component }) => {
          const category = component.category?.trim() || "uncategorized";
          if (categoryFilter !== "all" && category !== categoryFilter) {
            return false;
          }
          if (!normalizedSearch) return true;
          return [key, component.title, component.category ?? ""].some((value) =>
            value.toLocaleLowerCase().includes(normalizedSearch),
          );
        })
    : [];
  if (query.isLoading) return <LoadingState />;
  if (query.error) return <ErrorState error={query.error} />;

  return (
    <>
      <PageHeader
        title={t("components")}
        description="Read-only component metadata from the active build manifest."
      />
      {!manifest ? (
        <Empty
          icon={<ClipboardText size={32} />}
          title="No active manifest"
          description="Components are managed by build output. Run the app build with manifest push configured to publish them."
        />
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Input
              aria-label="Search components"
              placeholder={t("search")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full sm:max-w-xs"
            />
            <Select
              aria-label={t("categories")}
              value={categoryFilter}
              items={categoryItems}
              onValueChange={(value) => {
                if (typeof value === "string") setCategoryFilter(value);
              }}
              className="w-full sm:w-60"
            />
          </div>
          {components.length === 0 ? (
            <Empty title={t("noResults")} description={t("noResultsDescription")} />
          ) : (
            <LayerCard className="w-full overflow-x-auto p-0">
              <Table layout="fixed">
                <Table.Header>
                  <Table.Row>
                    <Table.Head>{t("components")}</Table.Head>
                    <Table.Head>Category</Table.Head>
                    <Table.Head>Props</Table.Head>
                    <Table.Head>Manifest revision</Table.Head>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {components.map(({ key, component }) => (
                    <Table.Row
                      key={key}
                      className="cursor-pointer transition hover:bg-kumo-hover"
                      onClick={() =>
                        context.router.push(context.href(`/components/${encodeURIComponent(key)}`))
                      }
                    >
                      <Table.Cell>
                        <a
                          className="inline-block w-fit font-medium text-kumo-link hover:underline"
                          href={context.href(`/components/${encodeURIComponent(key)}`)}
                          title={component.description || component.title}
                          onClick={(e) => {
                            e.preventDefault();
                            context.router.push(
                              context.href(`/components/${encodeURIComponent(key)}`),
                            );
                          }}
                        >
                          {component.title}
                        </a>
                      </Table.Cell>
                      <Table.Cell>{component.category ?? "—"}</Table.Cell>
                      <Table.Cell>{componentPropCount(component)}</Table.Cell>
                      <Table.Cell>
                        {revision ? new Date(revision).toLocaleString() : "—"}
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            </LayerCard>
          )}
        </>
      )}
    </>
  );
}

function ComponentDetailView() {
  const pathname = usePathname();
  const context = useAdminContext();
  const { t } = useI18n();
  const [rawJsonOpen, setRawJsonOpen] = useState(false);
  const componentKey = decodeURIComponent(pathname.slice("/components/".length));
  const query = api.useQuery("get", "/api/v1/apps/{appId}/manifest", {
    params: { path: { appId: context.appId ?? "" } },
  });
  const manifest = getActiveManifest(query.data);
  const component = manifest?.components[componentKey];

  if (query.isLoading) return <LoadingState />;
  if (query.error) return <ErrorState error={query.error} />;

  if (!manifest) {
    return (
      <>
        <PageHeader title={t("components")} />
        <Empty
          icon={<ClipboardText size={32} />}
          title="No active manifest"
          description="Components are managed by build output. Run the app build with manifest push configured to publish them."
        />
      </>
    );
  }

  if (!component) {
    return (
      <>
        <PageHeader title={t("components")}>
          <LinkButton href={context.href("/components")}>{t("components")}</LinkButton>
        </PageHeader>
        <Empty title={t("notFound")} description="This component is not in the active manifest." />
      </>
    );
  }

  return (
    <>
      <PageHeader title={component.title} description={component.description}>
        <Button onClick={() => setRawJsonOpen(true)}>{t("viewComponentJson")}</Button>
      </PageHeader>
      <Surface className="mb-4 grid gap-3 p-4 sm:grid-cols-3">
        <div>
          <Text variant="secondary">Component key</Text>
          <span className="font-mono">{componentKey}</span>
        </div>
        <div>
          <Text variant="secondary">Category</Text>
          <Text>{component.category ?? "—"}</Text>
        </div>
        <div>
          <Text variant="secondary">Props</Text>
          <Text>{componentPropCount(component)}</Text>
        </div>
      </Surface>
      <div className="grid gap-4 lg:grid-cols-2">
        <ComponentMetadata
          title="Props schema"
          value={component.props}
          className="col-span-full"
          maxHeight="max-h-96"
        />
        <ComponentMetadata title="Editor metadata" value={component.editor} />
        <ComponentMetadata title="Dynamic metadata" value={component["dynamic"]} />
        <ComponentMetadata title="Events" value={component.events} />
        <ComponentMetadata title="Slots" value={component.slots} />
        <ComponentMetadata
          title="Runtime mapping"
          value={component["runtime"] ?? component["runtimeMapping"]}
        />
        <ComponentMetadata title="Capabilities" value={component.capabilities} />
      </div>

      <JsonModalDialog
        open={rawJsonOpen}
        onOpenChange={setRawJsonOpen}
        title={`${component.title} (${componentKey})`}
        description="Raw component metadata JSON."
        data={component}
      />
    </>
  );
}

function MetaView() {
  const context = useAdminContext();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const toast = useKumoToastManager();
  const [selectedComponentKey, setSelectedComponentKey] = useState<string>("");
  const [componentSearch, setComponentSearch] = useState<string>("");

  const app = api.useQuery("get", "/api/v1/apps/{appId}", {
    params: { path: { appId: context.appId ?? "" } },
  });
  const manifest = api.useQuery("get", "/api/v1/apps/{appId}/manifest", {
    params: { path: { appId: context.appId ?? "" } },
  });
  const revisions = api.useQuery("get", "/api/v1/apps/{appId}/manifest/revisions", {
    params: { path: { appId: context.appId ?? "" } },
  });
  const manifestRevisions = getManifestRevisions(revisions.data);
  const activeManifest = getActiveManifest(manifest.data);

  const sync = api.useMutation("post", "/api/v1/apps/{appId}/manifest/sync", {
    onSuccess: () => {
      toast.add({ title: t("updated") });
      void queryClient.invalidateQueries();
    },
  });
  const push = api.useMutation("post", "/api/v1/apps/{appId}/manifest/push", {
    onSuccess: () => {
      toast.add({ title: t("updated") });
      void queryClient.invalidateQueries();
    },
  });
  const [json, setJson] = useState("");
  const [appKey, setAppKey] = useState("");

  const appJson = useMemo(() => JSON.stringify(app.data ?? {}, null, 2), [app.data]);
  const manifestJson = useMemo(() => JSON.stringify(manifest.data ?? {}, null, 2), [manifest.data]);

  const components = activeManifest?.components ?? {};
  const componentKeys = Object.keys(components).sort();
  const filteredComponentKeys = useMemo(() => {
    const q = componentSearch.trim().toLowerCase();
    if (!q) return componentKeys;
    return componentKeys.filter(
      (k) =>
        k.toLowerCase().includes(q) ||
        components[k]?.title?.toLowerCase().includes(q) ||
        components[k]?.category?.toLowerCase().includes(q),
    );
  }, [componentKeys, components, componentSearch]);

  const activeComponentKey =
    (selectedComponentKey && components[selectedComponentKey] ? selectedComponentKey : null) ??
    filteredComponentKeys[0] ??
    componentKeys[0] ??
    "";
  const selectedComponentData = activeComponentKey ? components[activeComponentKey] : null;
  const selectedComponentJson = useMemo(
    () => (selectedComponentData ? JSON.stringify(selectedComponentData, null, 2) : "{}"),
    [selectedComponentData],
  );

  const copyAppJson = () => {
    void navigator.clipboard?.writeText(appJson);
    toast.add({ title: t("copied") });
  };
  const copyManifestJson = () => {
    void navigator.clipboard?.writeText(manifestJson);
    toast.add({ title: t("copied") });
  };
  const copyComponentJson = () => {
    void navigator.clipboard?.writeText(selectedComponentJson);
    toast.add({ title: t("copied") });
  };

  if (app.isLoading || manifest.isLoading) return <LoadingState />;
  if (app.error) return <ErrorState error={app.error} />;

  return (
    <>
      <PageHeader
        title={t("meta")}
        description="Inspect raw App configuration, active build manifest, and raw component definitions."
      >
        <div className="flex items-center gap-2">
          {app.data?.manifest.mode === "remote" ? (
            <Button
              variant="primary"
              onClick={() => sync.mutate({ params: { path: { appId: context.appId ?? "" } } })}
            >
              {t("refresh")}
            </Button>
          ) : null}
          <Button variant="secondary" onClick={copyManifestJson}>
            <Copy size={14} className="mr-1 inline" />
            {t("copyJson")}
          </Button>
        </div>
      </PageHeader>

      {/* 1. App 原始信息 (App Raw Information) */}
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Surface className="grid gap-3 p-4">
          <div className="flex items-center justify-between">
            <Text variant="heading" as="h2">
              App 基础信息
            </Text>
            {app.data?.status && (
              <Badge variant={app.data.status === "active" ? "green" : "red"}>
                {app.data.status}
              </Badge>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <Text variant="secondary">App ID</Text>
              <span className="font-mono">{app.data?.id ?? "—"}</span>
            </div>
            <div>
              <Text variant="secondary">App Key</Text>
              <span className="font-mono">{app.data?.key ?? "—"}</span>
            </div>
            <div>
              <Text variant="secondary">Type</Text>
              <Text>{app.data?.type ?? "—"}</Text>
            </div>
            <div>
              <Text variant="secondary">Manifest Mode</Text>
              <Text>{app.data?.manifest?.mode ?? "push"}</Text>
            </div>
            <div>
              <Text variant="secondary">Active Revision ID</Text>
              <span className="font-mono">{app.data?.manifest?.activeRevisionId ?? "—"}</span>
            </div>
            <div>
              <Text variant="secondary">Updated At</Text>
              <Text>
                {app.data?.updatedAt ? new Date(app.data.updatedAt).toLocaleString() : "—"}
              </Text>
            </div>
          </div>
        </Surface>

        <Surface className="grid gap-3 p-4">
          <div className="flex items-center justify-between">
            <Text variant="heading" as="h2">
              App 原始 JSON
            </Text>
            <Button size="sm" variant="secondary" onClick={copyAppJson}>
              <Copy size={14} className="mr-1 inline" />
              {t("copyJson")}
            </Button>
          </div>
          <div className="max-h-56 overflow-auto rounded-lg border border-kumo-line bg-kumo-canvas p-3">
            <Code code={appJson} lang="jsonc" />
          </div>
        </Surface>
      </div>

      {/* 2. 组件原始 JSON (Components Raw JSON) */}
      <Surface className="mb-6 grid gap-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-kumo-line pb-3">
          <div>
            <Text variant="heading" as="h2">
              组件原始 JSON (Component Definitions)
            </Text>
            <Text variant="secondary">当前 Manifest 包含 {componentKeys.length} 个注册组件</Text>
          </div>
          <div className="flex items-center gap-2">
            <Input
              placeholder={t("search")}
              value={componentSearch}
              onChange={(e) => setComponentSearch(e.target.value)}
              className="w-48 sm:w-64"
            />
            {selectedComponentData && (
              <Button size="sm" variant="secondary" onClick={copyComponentJson}>
                <Copy size={14} className="mr-1 inline" />
                {t("copyJson")}
              </Button>
            )}
          </div>
        </div>

        {componentKeys.length === 0 ? (
          <Empty
            icon={<ClipboardText size={32} />}
            title="暂无组件元信息"
            description="当前 App 尚未推送或同步组件 Manifest。"
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
            {/* Component Picker List */}
            <div className="max-h-[460px] overflow-y-auto rounded-lg border border-kumo-line p-1">
              {filteredComponentKeys.length === 0 ? (
                <div className="p-3 text-center text-xs text-kumo-subtle">{t("noResults")}</div>
              ) : (
                filteredComponentKeys.map((key) => {
                  const comp = components[key];
                  const isSelected = key === activeComponentKey;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedComponentKey(key)}
                      className={`flex w-full flex-col gap-0.5 rounded-md px-2.5 py-1.5 text-left transition ${
                        isSelected
                          ? "bg-kumo-tint text-kumo-high font-medium"
                          : "hover:bg-kumo-canvas text-kumo-default"
                      }`}
                    >
                      <span className="text-xs font-semibold">{comp?.title || key}</span>
                      <span className="font-mono text-[10px] text-kumo-subtle">{key}</span>
                    </button>
                  );
                })
              )}
            </div>

            {/* Component Raw JSON Viewer */}
            <div>
              {selectedComponentData ? (
                <div className="grid gap-2">
                  <div className="flex items-center justify-between text-xs">
                    <div>
                      <span className="mr-2 text-sm font-semibold">
                        {selectedComponentData.title}
                      </span>
                      <span className="font-mono text-kumo-subtle">({activeComponentKey})</span>
                      {selectedComponentData.category && (
                        <Badge className="ml-2" variant="neutral">
                          {selectedComponentData.category}
                        </Badge>
                      )}
                    </div>
                    <LinkButton
                      size="sm"
                      href={context.href(`/components/${encodeURIComponent(activeComponentKey)}`)}
                    >
                      {t("details")}
                    </LinkButton>
                  </div>
                  <div className="max-h-[410px] overflow-auto rounded-lg border border-kumo-line bg-kumo-canvas p-3">
                    <Code code={selectedComponentJson} lang="jsonc" />
                  </div>
                </div>
              ) : (
                <div className="grid h-48 place-items-center text-xs text-kumo-subtle">
                  请选择一个组件查看原始 JSON
                </div>
              )}
            </div>
          </div>
        )}
      </Surface>

      {/* 3. 完整 Manifest JSON & 手动推送 */}
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Surface className="grid gap-3 p-4">
          <div className="flex items-center justify-between">
            <Text variant="heading" as="h2">
              完整 Manifest JSON
            </Text>
            <Button size="sm" variant="secondary" onClick={copyManifestJson}>
              <Copy size={14} className="mr-1 inline" />
              {t("copyJson")}
            </Button>
          </div>
          <div className="max-h-72 overflow-auto rounded-lg border border-kumo-line bg-kumo-canvas p-3">
            <Code code={manifestJson} lang="jsonc" />
          </div>
        </Surface>

        <Surface className="grid gap-4 p-4">
          <Text variant="heading" as="h2">
            推送 Manifest
          </Text>
          <Input
            label="Temporary App Key"
            type="password"
            value={appKey}
            onChange={(e) => setAppKey(e.target.value)}
          />
          <Textarea
            label="Manifest JSON"
            value={json}
            rows={5}
            onChange={(e) => setJson(e.target.value)}
            description="Credentials are not persisted."
          />
          <Button
            variant="primary"
            loading={push.isPending}
            disabled={!json || !appKey}
            onClick={() => {
              try {
                push.mutate({
                  params: {
                    path: { appId: context.appId ?? "" },
                    header: { "x-openscene-app-key": appKey },
                  },
                  body: JSON.parse(json),
                });
              } catch {
                toast.add({ title: t("requestFailed") });
              }
            }}
          >
            {t("save")}
          </Button>
        </Surface>
      </div>

      {/* 4. 修订版本历史 (Revision History) */}
      <Surface className="grid gap-3 p-4">
        <Text variant="heading" as="h2">
          修订版本历史 (Revision history)
        </Text>
        {manifestRevisions.length === 0 ? (
          <div className="py-3 text-xs text-kumo-subtle">暂无历史修订版本</div>
        ) : (
          manifestRevisions.map((rev) => (
            <div
              key={rev.id}
              className="flex items-center justify-between border-b border-kumo-line py-2 text-xs"
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-kumo-subtle">{rev.checksum.slice(0, 12)}…</span>
                <Badge variant={rev.source === "sync" ? "blue" : "neutral"}>{rev.source}</Badge>
                {app.data?.manifest?.activeRevisionId === rev.id && (
                  <Badge variant="green">Active</Badge>
                )}
              </div>
              <Text variant="secondary">{new Date(rev.createdAt).toLocaleString()}</Text>
            </div>
          ))
        )}
      </Surface>
    </>
  );
}

function SettingsView() {
  const context = useAdminContext();
  const { t } = useI18n();
  const toast = useKumoToastManager();
  const queryClient = useQueryClient();
  const query = api.useQuery("get", "/api/v1/apps/{appId}", {
    params: { path: { appId: context.appId ?? "" } },
  });
  const update = api.useMutation("patch", "/api/v1/apps/{appId}", {
    onSuccess: () => {
      toast.add({ title: t("updated") });
      void queryClient.invalidateQueries();
    },
  });
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [runtimeUrl, setRuntimeUrl] = useState("");
  const [rotationConfirmationAppId, setRotationConfirmationAppId] = useState<string | null>(null);
  const [rotatedAppKey, setRotatedAppKey] = useState<string | null>(null);
  const [rotationError, setRotationError] = useState<unknown>(null);
  const [isRotating, setIsRotating] = useState(false);
  const app = query.data;
  async function rotateAppKey() {
    setRotationError(null);
    setIsRotating(true);
    try {
      const result = await fetchClient.POST("/api/v1/apps/{appId}/app-keys/rotate", {
        params: { path: { appId: rotationConfirmationAppId ?? "" } },
      });
      if (result.error) {
        setRotationError(result.error);
        return;
      }
      if (!result.data) {
        setRotationError(new Error(t("requestFailed")));
        return;
      }
      setRotationConfirmationAppId(null);
      setRotatedAppKey(result.data.appKey);
    } catch (error) {
      setRotationError(error);
    } finally {
      setIsRotating(false);
    }
  }
  useEffect(() => {
    if (app) {
      setName(app.name);
      setDescription(app.description);
      setRuntimeUrl(app.runtime.publicBaseUrl ?? "");
    }
  }, [app]);
  return (
    <>
      <PageHeader
        title={t("settings")}
        description="Update app configuration and runtime delivery status."
      />
      {query.error ? <ErrorState error={query.error} /> : null}
      <LayerCard className="mb-4 max-w-2xl">
        <LayerCard.Secondary>{t("preferences")}</LayerCard.Secondary>
        <LayerCard.Primary className="grid gap-4">
          <Select
            label={t("language")}
            value={context.language}
            items={{ en: t("english"), "zh-CN": t("chinese") }}
            onValueChange={(value) => {
              if (value === "en" || value === "zh-CN") context.setLanguage(value);
            }}
          />
          <Button
            onClick={async () => {
              await fetchClient.DELETE("/api/v1/auth/session");
              context.router.replace(context.href("/login", { appId: undefined }));
            }}
          >
            {t("signOut")}
          </Button>
        </LayerCard.Primary>
      </LayerCard>
      <LayerCard className="max-w-2xl">
        <LayerCard.Secondary>{t("settings")}</LayerCard.Secondary>
        <LayerCard.Primary className="grid gap-4">
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <Textarea
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <Input
            label="Runtime URL"
            type="url"
            value={runtimeUrl}
            onChange={(e) => setRuntimeUrl(e.target.value)}
          />
          <Select
            label={t("status")}
            value={app?.status ?? "active"}
            items={{ active: t("active"), disabled: t("disabled") }}
            onValueChange={(value) => {
              if (value === "active" || value === "disabled")
                update.mutate({
                  params: { path: { appId: context.appId ?? "" } },
                  body: { status: value },
                });
            }}
          />
          <Button
            variant="primary"
            loading={update.isPending}
            onClick={() =>
              update.mutate({
                params: { path: { appId: context.appId ?? "" } },
                body: { name, description, runtimePublicBaseUrl: runtimeUrl || undefined },
              })
            }
          >
            {t("save")}
          </Button>
        </LayerCard.Primary>
      </LayerCard>
      <LayerCard className="mt-4 max-w-2xl">
        <LayerCard.Secondary>{t("appKey")}</LayerCard.Secondary>
        <LayerCard.Primary className="grid gap-4">
          <Text variant="secondary">{t("rotateAppKeyDescription")}</Text>
          {rotationError ? <ErrorState error={rotationError} /> : null}
          <div>
            <Button
              onClick={() => {
                setRotationError(null);
                setRotationConfirmationAppId(context.appId ?? null);
              }}
            >
              {t("rotateAppKey")}
            </Button>
          </div>
        </LayerCard.Primary>
      </LayerCard>
      <Dialog.Root
        role="alertdialog"
        open={Boolean(rotationConfirmationAppId)}
        onOpenChange={(value) => {
          if (!value) setRotationConfirmationAppId(null);
        }}
      >
        <Dialog className="px-8 py-6">
          <Dialog.Title>{t("rotateAppKeyConfirmTitle")}</Dialog.Title>
          <Dialog.Description>{t("rotateAppKeyConfirmDescription")}</Dialog.Description>
          <div className="mt-4 flex justify-end gap-2">
            <Dialog.Close render={<Button disabled={isRotating}>{t("cancel")}</Button>} />
            <Button variant="destructive" loading={isRotating} onClick={rotateAppKey}>
              {t("rotateAppKey")}
            </Button>
          </div>
        </Dialog>
      </Dialog.Root>
      <Dialog.Root
        open={rotatedAppKey !== null}
        onOpenChange={(value) => {
          if (!value) setRotatedAppKey(null);
        }}
      >
        <Dialog size="lg" className="px-8 py-6">
          <Dialog.Title>{t("appKeyRotated")}</Dialog.Title>
          <Dialog.Description>{t("appKeyRotatedDescription")}</Dialog.Description>
          <div className="grid gap-3 py-4">
            {rotatedAppKey ? <Credential label={t("appKey")} value={rotatedAppKey} /> : null}
          </div>
          <div className="flex justify-end">
            <Dialog.Close render={<Button variant="primary">{t("continue")}</Button>} />
          </div>
        </Dialog>
      </Dialog.Root>
    </>
  );
}

function AiView() {
  const { t } = useI18n();
  const toast = useKumoToastManager();
  const queryClient = useQueryClient();
  const query = api.useQuery("get", "/api/v1/ai/config");
  const update = api.useMutation("patch", "/api/v1/ai/config", {
    onSuccess: () => {
      toast.add({ title: t("aiSaved") });
      void queryClient.invalidateQueries();
    },
  });
  const testMutation = api.useMutation("post", "/api/v1/ai/config/test");
  const [provider, setProvider] = useState<"openai" | "openai-responses" | "anthropic">("openai");
  const [model, setModel] = useState("gpt-4o-mini");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null);

  const config = query.data?.config ?? null;
  useEffect(() => {
    if (config) {
      setProvider(config.provider);
      setModel(config.model);
      setBaseUrl(config.baseUrl ?? "");
      setEnabled(config.enabled);
    }
  }, [config]);

  function save() {
    update.mutate({
      body: {
        provider,
        model,
        baseUrl: baseUrl || undefined,
        apiKey: apiKey || undefined,
        enabled,
      },
    });
  }

  function runTest() {
    setTestResult(null);
    testMutation.mutate(
      {
        body: {
          provider,
          model,
          baseUrl: baseUrl || undefined,
          apiKey: apiKey || undefined,
          enabled,
        },
      },
      {
        onSuccess: (data) => setTestResult(data ?? null),
        onError: (error) =>
          setTestResult({
            ok: false,
            error:
              error instanceof Error
                ? error.message
                : typeof error === "string"
                  ? error
                  : "Unknown error",
          }),
      },
    );
  }

  return (
    <>
      <PageHeader title={t("ai")} description={t("aiDescription")} />
      {query.error ? <ErrorState error={query.error} /> : null}
      <LayerCard className="mb-4 max-w-2xl">
        <LayerCard.Secondary>{t("aiConfiguration")}</LayerCard.Secondary>
        <LayerCard.Primary className="grid gap-4">
          <Select
            label={t("aiProvider")}
            value={provider}
            items={{
              openai: "OpenAI",
              "openai-responses": "OpenAI Responses",
              anthropic: "Anthropic",
            }}
            onValueChange={(value) => {
              if (value === "openai" || value === "openai-responses" || value === "anthropic")
                setProvider(value);
            }}
          />
          <Input
            label={t("aiModel")}
            value={model}
            onChange={(event) => setModel(event.target.value)}
            placeholder="gpt-4o-mini"
          />
          <Input
            label={t("aiBaseUrl")}
            type="url"
            value={baseUrl}
            onChange={(event) => setBaseUrl(event.target.value)}
            placeholder="https://api.openai.com/v1"
          />
          <Input
            label={t("aiApiKey")}
            type="password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder={config?.hasApiKey ? t("aiApiKeySet") : t("aiApiKeyPlaceholder")}
          />
          {config?.hasApiKey && !apiKey ? (
            <Text variant="secondary">{t("aiApiKeyHint")}</Text>
          ) : null}
          <Switch
            checked={enabled}
            label={t("aiEnabled")}
            onCheckedChange={(checked) => setEnabled(checked)}
          />
          <div className="flex gap-2">
            <Button variant="primary" loading={update.isPending} onClick={save}>
              {t("save")}
            </Button>
            <Button loading={testMutation.isPending} onClick={runTest}>
              {t("aiTest")}
            </Button>
          </div>
          {testMutation.error ? <ErrorState error={testMutation.error} /> : null}
          {testResult ? (
            <Text variant="secondary">
              {testResult.ok
                ? t("aiTestSuccess")
                : `${t("aiTestFailed")}${testResult.error ? `: ${testResult.error}` : ""}`}
            </Text>
          ) : null}
        </LayerCard.Primary>
      </LayerCard>
      <LayerCard className="max-w-2xl">
        <LayerCard.Secondary>{t("aiConsumption")}</LayerCard.Secondary>
        <LayerCard.Primary className="grid gap-2">
          <Text variant="secondary">{t("aiConsumptionDescription")}</Text>
          <Code code={`POST /api/v1/ai/chat`} />
          <Text variant="secondary">{t("aiConsumptionHint")}</Text>
        </LayerCard.Primary>
      </LayerCard>
    </>
  );
}
function SystemPromptView() {
  const { t } = useI18n();
  const toast = useKumoToastManager();
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [corePromptOpen, setCorePromptOpen] = useState(false);
  const query = api.useQuery("get", "/api/v1/ai/system-prompt");
  const data = query.data;

  useEffect(() => {
    if (data) {
      setPrompt(data.prompt);
      setEnabled(data.enabled);
    }
  }, [data]);

  const update = api.useMutation("patch", "/api/v1/ai/system-prompt", {
    onSuccess: () => {
      setConfirmOpen(false);
      toast.add({ title: t("systemPromptSaved") });
      void queryClient.invalidateQueries();
    },
  });

  function applyChanges() {
    update.mutate({
      body: {
        prompt: prompt || undefined,
        enabled,
      },
    });
  }

  if (query.isLoading) return <LoadingState />;
  if (query.error) return <ErrorState error={query.error} />;

  return (
    <>
      <PageHeader title={t("systemPrompt")} description={t("systemPromptDescription")}>
        <Button variant="primary" onClick={() => setConfirmOpen(true)}>
          {t("save")}
        </Button>
      </PageHeader>

      <Surface className="mb-4 max-w-3xl border border-red-500/20 bg-red-500/5 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="red">{t("systemPromptHighRiskBadge")}</Badge>
        </div>
        <Text variant="secondary">{t("systemPromptHighRiskWarning")}</Text>
      </Surface>

      <LayerCard className="mb-4 max-w-3xl">
        <LayerCard.Secondary>{t("systemPromptEnabled")}</LayerCard.Secondary>
        <LayerCard.Primary className="grid gap-3">
          <Switch checked={enabled} onCheckedChange={setEnabled} label={t("systemPromptEnabled")} />
          <Text variant="secondary">{t("systemPromptEnabledDescription")}</Text>
        </LayerCard.Primary>
      </LayerCard>

      <LayerCard className="mb-4 max-w-3xl">
        <LayerCard.Secondary>{t("systemPromptPrompt")}</LayerCard.Secondary>
        <LayerCard.Primary className="grid gap-3">
          <Textarea
            label={t("systemPromptPrompt")}
            rows={12}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
          />
        </LayerCard.Primary>
      </LayerCard>

      <LayerCard className="mb-4 max-w-3xl border border-dashed border-zinc-500/30">
        <LayerCard.Secondary>
          <div className="flex items-center justify-between">
            <span className="font-medium">{t("systemPromptCoreTitle")}</span>
            <Badge variant="neutral" className="gap-1">
              <Lock size={12} />
              {t("systemPromptCoreBadge")}
            </Badge>
          </div>
        </LayerCard.Secondary>
        <LayerCard.Primary className="grid gap-3">
          <div className="flex items-center justify-between">
            <Text variant="secondary">{t("systemPromptCoreDescription")}</Text>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCorePromptOpen((v) => !v)}
              className="gap-1.5"
            >
              {corePromptOpen ? <CaretDown size={14} /> : <CaretRight size={14} />}
              {corePromptOpen ? t("collapse") : t("expand")}
            </Button>
          </div>
          {corePromptOpen && (
            <div className="mt-2 rounded bg-zinc-950/80 p-3 border border-zinc-800">
              <pre className="font-mono text-xs text-zinc-300 whitespace-pre-wrap select-all">
                {PROMPT_DEFAULT_SYSTEM}
              </pre>
            </div>
          )}
        </LayerCard.Primary>
      </LayerCard>

      <Dialog.Root open={confirmOpen} onOpenChange={setConfirmOpen}>
        <Dialog size="base" className="px-6 py-6">
          <Dialog.Title>{t("systemPromptConfirmTitle")}</Dialog.Title>
          <div className="grid gap-4 py-4">
            <Text>{t("systemPromptConfirmDescription")}</Text>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
                {t("cancel")}
              </Button>
              <Button variant="primary" loading={update.isPending} onClick={applyChanges}>
                {t("systemPromptConfirmButton")}
              </Button>
            </div>
          </div>
        </Dialog>
      </Dialog.Root>
    </>
  );
}

const PROMPT_DEFAULT_SYSTEM = [
  "You are OpenScene AI Generative UI engine powered by json-render.",
  "Generate UI specifications strictly following the json-render Standalone Mode specification.",
  "",
  "CRITICAL RULES:",
  "1. Output ONLY JSONL patch lines (RFC 6902 JSON Patch format).",
  "2. Do NOT output markdown code fences (NO ```json, NO ```spec, NO backticks).",
  "3. Do NOT output conversational prose, explanations, greetings, or notes.",
  "4. Each output line MUST be a single, valid, self-contained JSON Patch object.",
  "",
  "SPECIFICATION FORMAT (RFC 6902 JSON Patch):",
  '- Set root: {"op":"add","path":"/root","value":"<root_element_id>"}',
  '- Add element: {"op":"add","path":"/elements/<element_id>","value":{"type":"<ComponentType>","props":{...},"children":["<child_id>"]}}',
  '- Update props: {"op":"replace","path":"/elements/<element_id>/props/<prop_name>","value":<value>}',
  '- Remove element: {"op":"remove","path":"/elements/<element_id>"}',
  '- Set state: {"op":"add","path":"/state/<key>","value":<value>}',
  "",
  "EXAMPLE OUTPUT:",
  '{"op":"add","path":"/root","value":"card-1"}',
  '{"op":"add","path":"/elements/card-1","value":{"type":"Card","props":{"title":"Dashboard"},"children":["metric-1","btn-1"]}}',
  '{"op":"add","path":"/elements/metric-1","value":{"type":"Metric","props":{"label":"Revenue","value":"$12,450"}}}',
  '{"op":"add","path":"/elements/btn-1","value":{"type":"Button","props":{"text":"Refresh"}}}',
].join("\n");

function PromptsListView() {
  const context = useAdminContext();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const toast = useKumoToastManager();
  const appId = context.appId ?? "";
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const query = api.useQuery("get", "/api/v1/apps/{appId}/prompts", {
    params: { path: { appId } },
  });

  const update = api.useMutation("patch", "/api/v1/apps/{appId}/prompts/{promptId}", {
    onSuccess: () => {
      toast.add({ title: t("updated") });
      void queryClient.invalidateQueries();
    },
  });

  const remove = api.useMutation("delete", "/api/v1/apps/{appId}/prompts/{promptId}", {
    onSuccess: () => {
      setDeleteId(null);
      toast.add({ title: t("deleted") });
      void queryClient.invalidateQueries();
    },
  });

  const items = query.data ?? [];

  if (query.isLoading) return <LoadingState />;
  if (query.error) return <ErrorState error={query.error} />;

  return (
    <>
      <PageHeader title={t("prompts")} description={t("promptsDescription")}>
        <LinkButton variant="primary" icon={Plus} href={context.href("/prompts/new")}>
          {t("promptCreate")}
        </LinkButton>
      </PageHeader>
      {items.length === 0 ? (
        <Empty title={t("noResults")} description={t("noResultsDescription")} />
      ) : (
        <LayerCard className="w-full overflow-x-auto p-0">
          <Table layout="fixed">
            <colgroup>
              <col style={{ width: "220px" }} />
              <col />
              <col style={{ width: "120px" }} />
              <col style={{ width: "120px" }} />
              <col style={{ width: "140px" }} />
              <col style={{ width: "56px" }} />
            </colgroup>
            <Table.Header>
              <Table.Row>
                <Table.Head>{t("promptName")}</Table.Head>
                <Table.Head>{t("promptDescriptionLabel")}</Table.Head>
                <Table.Head>{t("promptComponentsCount")}</Table.Head>
                <Table.Head>{t("promptOpenApiCount")}</Table.Head>
                <Table.Head>{t("status")}</Table.Head>
                <Table.Head sticky="right">
                  <span className="sr-only">{t("actions")}</span>
                </Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {items.map((item) => (
                <Table.Row key={item.id}>
                  <Table.Cell>
                    <div className="flex flex-col">
                      <LinkButton
                        variant="ghost"
                        className="justify-start p-0 font-medium text-kumo-foreground hover:underline"
                        href={context.href(`/prompts/${encodeURIComponent(item.id)}`)}
                      >
                        {item.name}
                      </LinkButton>
                      <span className="font-mono text-xs text-kumo-subtle">{item.key}</span>
                    </div>
                  </Table.Cell>
                  <Table.Cell className="truncate text-kumo-subtle">
                    {item.description || "—"}
                  </Table.Cell>
                  <Table.Cell>{item.injectedComponents.length}</Table.Cell>
                  <Table.Cell>{item.injectedOpenApiDocIds.length}</Table.Cell>
                  <Table.Cell>
                    <div className="flex items-center gap-1.5">
                      {item.isDefault ? <Badge variant="green">{t("default")}</Badge> : null}
                      <Badge variant={item.enabled ? "blue" : "neutral"}>
                        {item.enabled ? t("active") : t("disabled")}
                      </Badge>
                    </div>
                  </Table.Cell>
                  <Table.Cell sticky="right" className="text-right">
                    <DropdownMenu>
                      <DropdownMenu.Trigger
                        render={
                          <Button
                            variant="ghost"
                            size="sm"
                            shape="square"
                            aria-label={t("moreOptions")}
                          >
                            <DotsThree weight="bold" size={16} />
                          </Button>
                        }
                      />
                      <DropdownMenu.Content>
                        <DropdownMenu.Item
                          icon={PencilSimple}
                          onClick={() => {
                            context.router.push(
                              context.href(`/prompts/${encodeURIComponent(item.id)}`),
                            );
                          }}
                        >
                          {t("edit")}
                        </DropdownMenu.Item>
                        <DropdownMenu.Item
                          icon={Star}
                          onClick={() =>
                            update.mutate({
                              params: { path: { appId, promptId: item.id } },
                              body: { isDefault: !item.isDefault },
                            })
                          }
                        >
                          {item.isDefault ? t("promptRemoveDefault") : t("promptSetDefault")}
                        </DropdownMenu.Item>
                        <DropdownMenu.Separator />
                        <DropdownMenu.Item
                          icon={Trash}
                          variant="danger"
                          onClick={() => setDeleteId(item.id)}
                        >
                          {t("delete")}
                        </DropdownMenu.Item>
                      </DropdownMenu.Content>
                    </DropdownMenu>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </LayerCard>
      )}

      <Dialog.Root open={Boolean(deleteId)} onOpenChange={(open) => !open && setDeleteId(null)}>
        <Dialog size="sm" className="px-6 py-6">
          <Dialog.Title>{t("promptDeleteConfirmTitle")}</Dialog.Title>
          <div className="grid gap-4 py-4">
            <Text>{t("promptDeleteConfirmDescription")}</Text>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDeleteId(null)}>
                {t("cancel")}
              </Button>
              <Button
                variant="primary"
                loading={remove.isPending}
                onClick={() => {
                  if (deleteId) {
                    remove.mutate({ params: { path: { appId, promptId: deleteId } } });
                  }
                }}
              >
                {t("delete")}
              </Button>
            </div>
          </div>
        </Dialog>
      </Dialog.Root>
    </>
  );
}

function PromptEditorView() {
  const pathname = usePathname();
  const context = useAdminContext();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const toast = useKumoToastManager();
  const appId = context.appId ?? "";

  const rawId = decodeURIComponent(
    pathname.startsWith("/prompts/")
      ? pathname.slice("/prompts/".length)
      : pathname.slice("/prompt/".length),
  );
  const isNew = rawId === "new";
  const promptId = isNew ? "" : rawId;

  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [form, setForm] = useState({
    key: "",
    name: "",
    description: "",
    system: PROMPT_DEFAULT_SYSTEM,
    sections: [] as string[],
    injectedComponents: [] as string[],
    injectedOpenApiDocIds: [] as string[],
    isDefault: false,
    enabled: true,
  });

  const promptQuery = api.useQuery(
    "get",
    "/api/v1/apps/{appId}/prompts/{promptId}",
    {
      params: { path: { appId, promptId } },
    },
    {
      enabled: !isNew && Boolean(appId) && Boolean(promptId),
    },
  );

  const manifestQuery = api.useQuery("get", "/api/v1/apps/{appId}/manifest", {
    params: { path: { appId } },
  });
  const openApiQuery = api.useQuery("get", "/api/v1/apps/{appId}/openapi-docs", {
    params: { path: { appId } },
  });

  const item = promptQuery.data;
  useEffect(() => {
    if (item && !isNew) {
      setForm({
        key: item.key,
        name: item.name,
        description: item.description,
        system: item.system,
        sections: [...item.sections],
        injectedComponents: [...item.injectedComponents],
        injectedOpenApiDocIds: [...item.injectedOpenApiDocIds],
        isDefault: item.isDefault,
        enabled: item.enabled,
      });
    }
  }, [item, isNew]);

  const create = api.useMutation("post", "/api/v1/apps/{appId}/prompts", {
    onSuccess: (created) => {
      toast.add({ title: t("created") });
      void queryClient.invalidateQueries();
      context.router.push(context.href(`/prompts/${encodeURIComponent(created.id)}`));
    },
  });

  const update = api.useMutation("patch", "/api/v1/apps/{appId}/prompts/{promptId}", {
    onSuccess: () => {
      toast.add({ title: t("updated") });
      void queryClient.invalidateQueries();
    },
  });

  const remove = api.useMutation("delete", "/api/v1/apps/{appId}/prompts/{promptId}", {
    onSuccess: () => {
      setDeleteConfirm(false);
      toast.add({ title: t("deleted") });
      void queryClient.invalidateQueries();
      context.router.push(context.href("/prompts"));
    },
  });

  const manifest = getActiveManifest(manifestQuery.data);
  const componentEntries = useMemo(() => {
    if (!manifest) return [];
    return Object.entries(manifest.components)
      .map(([key, component]) => ({
        key,
        title: component.title,
        category: component.category,
      }))
      .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  }, [manifest]);

  const openApiDocs = (openApiQuery.data ?? []) as Array<{
    id: string;
    name: string;
    json: unknown;
  }>;

  const preview = useMemo(() => {
    const parts: string[] = [];
    if (form.system.trim()) parts.push(form.system.trim());
    for (const section of form.sections) if (section.trim()) parts.push(section.trim());
    if (form.injectedComponents.length > 0 && manifest) {
      const lines = form.injectedComponents
        .filter((key) => manifest.components[key])
        .map((key) => {
          const component = manifest.components[key];
          const props =
            (component.props as { properties?: Record<string, unknown> } | undefined)?.properties ??
            {};
          const propText = Object.keys(props).length
            ? ` (props: ${Object.keys(props).join(", ")})`
            : "";
          const description = component.description ? ` — ${component.description}` : "";
          return `- \`${key}\`: ${component.title ?? key}${description}${propText}`;
        });
      if (lines.length)
        parts.push(
          `## Available Components\nThe following components are published for this app:\n${lines.join("\n")}`,
        );
    }
    if (form.injectedOpenApiDocIds.length > 0) {
      const blocks = openApiDocs
        .filter((doc) => form.injectedOpenApiDocIds.includes(doc.id))
        .map((doc) => `### ${doc.name}\n${JSON.stringify(doc.json, null, 2)}`);
      if (blocks.length) parts.push(`## OpenAPI Specifications\n${blocks.join("\n\n")}`);
    }
    return parts.join("\n\n");
  }, [form, manifest, openApiDocs]);

  function toggleComponent(key: string, checked: boolean) {
    setForm((prev) => ({
      ...prev,
      injectedComponents: checked
        ? prev.injectedComponents.includes(key)
          ? prev.injectedComponents
          : [...prev.injectedComponents, key]
        : prev.injectedComponents.filter((k) => k !== key),
    }));
  }

  function toggleOpenApi(docId: string, checked: boolean) {
    setForm((prev) => ({
      ...prev,
      injectedOpenApiDocIds: checked
        ? prev.injectedOpenApiDocIds.includes(docId)
          ? prev.injectedOpenApiDocIds
          : [...prev.injectedOpenApiDocIds, docId]
        : prev.injectedOpenApiDocIds.filter((k) => k !== docId),
    }));
  }
  const isAllComponentsSelected =
    componentEntries.length > 0 &&
    componentEntries.every(({ key }) => form.injectedComponents.includes(key));
  const isSomeComponentsSelected =
    !isAllComponentsSelected &&
    componentEntries.some(({ key }) => form.injectedComponents.includes(key));

  function handleToggleAllComponents(checked: boolean) {
    setForm((prev) => ({
      ...prev,
      injectedComponents: checked ? componentEntries.map(({ key }) => key) : [],
    }));
  }

  const isAllOpenApiSelected =
    openApiDocs.length > 0 &&
    openApiDocs.every((doc) => form.injectedOpenApiDocIds.includes(doc.id));
  const isSomeOpenApiSelected =
    !isAllOpenApiSelected && openApiDocs.some((doc) => form.injectedOpenApiDocIds.includes(doc.id));

  function handleToggleAllOpenApi(checked: boolean) {
    setForm((prev) => ({
      ...prev,
      injectedOpenApiDocIds: checked ? openApiDocs.map((doc) => doc.id) : [],
    }));
  }

  function save() {
    if (isNew) {
      create.mutate({
        params: { path: { appId } },
        body: {
          key: form.key,
          name: form.name,
          description: form.description,
          system: form.system,
          sections: form.sections.filter((s) => s.trim() !== ""),
          injectedComponents: form.injectedComponents,
          injectedOpenApiDocIds: form.injectedOpenApiDocIds,
          isDefault: form.isDefault,
          enabled: form.enabled,
        },
      });
    } else {
      update.mutate({
        params: { path: { appId, promptId } },
        body: {
          name: form.name,
          description: form.description,
          system: form.system,
          sections: form.sections.filter((s) => s.trim() !== ""),
          injectedComponents: form.injectedComponents,
          injectedOpenApiDocIds: form.injectedOpenApiDocIds,
          isDefault: form.isDefault,
          enabled: form.enabled,
        },
      });
    }
  }

  if (!isNew && promptQuery.isLoading) return <LoadingState />;
  if (!isNew && promptQuery.error) return <ErrorState error={promptQuery.error} />;

  const isSaving = create.isPending || update.isPending;

  return (
    <>
      <PageHeader
        title={isNew ? t("promptCreate") : form.name || form.key || t("promptEdit")}
        description={t("promptDescription")}
      >
        <LinkButton href={context.href("/prompts")}>{t("prompts")}</LinkButton>
        <Button variant="primary" loading={isSaving} onClick={save}>
          {t("save")}
        </Button>
        {!isNew && (
          <Button variant="ghost" icon={Trash} onClick={() => setDeleteConfirm(true)}>
            {t("delete")}
          </Button>
        )}
      </PageHeader>

      <div className="grid max-w-5xl gap-6">
        <LayerCard>
          <LayerCard.Secondary>{t("details")}</LayerCard.Secondary>
          <LayerCard.Primary className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label={t("promptKey")}
                value={form.key}
                disabled={!isNew}
                placeholder="e.g. payment, campaign, core"
                onChange={(e) => setForm({ ...form, key: e.target.value })}
              />
              <Input
                label={t("promptName")}
                value={form.name}
                placeholder="e.g. 支付模块专用"
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <Input
              label={t("promptDescriptionLabel")}
              value={form.description}
              placeholder="Optional description of this module prompt profile"
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <div className="flex gap-6 pt-1">
              <Switch
                checked={form.isDefault}
                label={t("default")}
                onCheckedChange={(isDefault) => setForm({ ...form, isDefault })}
              />
              <Switch
                checked={form.enabled}
                label={t("promptEnabled")}
                onCheckedChange={(enabled) => setForm({ ...form, enabled })}
              />
            </div>
          </LayerCard.Primary>
        </LayerCard>

        <LayerCard>
          <LayerCard.Secondary>{t("promptBase")}</LayerCard.Secondary>
          <LayerCard.Primary className="grid gap-3">
            <Text variant="secondary">{t("promptBaseDescription")}</Text>
            <Textarea
              label={t("promptBase")}
              rows={10}
              className="font-mono text-sm"
              value={form.system}
              onChange={(e) => setForm({ ...form, system: e.target.value })}
            />
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setForm({ ...form, system: PROMPT_DEFAULT_SYSTEM })}
              >
                {t("promptReset")}
              </Button>
            </div>
          </LayerCard.Primary>
        </LayerCard>

        <LayerCard>
          <LayerCard.Secondary>{t("promptSections")}</LayerCard.Secondary>
          <LayerCard.Primary className="grid gap-4">
            {form.sections.map((section, index) => (
              <div key={index} className="grid gap-2 rounded-md border border-kumo-subtle/20 p-4">
                <Text variant="secondary">
                  {t("promptSections")} #{index + 1}
                </Text>
                <Textarea
                  aria-label={`${t("promptSections")} #${index + 1}`}
                  rows={3}
                  placeholder={t("promptSectionPlaceholder")}
                  value={section}
                  onChange={(e) => {
                    const next = [...form.sections];
                    next[index] = e.target.value;
                    setForm({ ...form, sections: next });
                  }}
                />
                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setForm({
                        ...form,
                        sections: form.sections.filter((_, i) => i !== index),
                      })
                    }
                  >
                    {t("promptRemoveSection")}
                  </Button>
                </div>
              </div>
            ))}
            <div>
              <Button
                variant="ghost"
                size="sm"
                icon={Plus}
                onClick={() => setForm({ ...form, sections: [...form.sections, ""] })}
              >
                {t("promptAddSection")}
              </Button>
            </div>
          </LayerCard.Primary>
        </LayerCard>

        <LayerCard>
          <LayerCard.Secondary>{t("promptInjection")}</LayerCard.Secondary>
          <LayerCard.Primary className="grid gap-6">
            <Text variant="secondary">{t("promptInjectionDescription")}</Text>

            {/* Components Injection */}
            <div className="grid gap-2.5">
              <div className="flex items-center justify-between border-b border-kumo-line/40 pb-2">
                <Text variant="heading" as="h3">
                  {t("promptComponents")}
                </Text>
                {componentEntries.length > 0 && (
                  <Checkbox
                    label={t("selectAll")}
                    checked={isAllComponentsSelected}
                    indeterminate={isSomeComponentsSelected}
                    onCheckedChange={(checked) => handleToggleAllComponents(Boolean(checked))}
                  />
                )}
              </div>
              {componentEntries.length === 0 ? (
                <Empty title={t("promptNoManifest")} />
              ) : (
                <div className="grid max-h-64 gap-1 overflow-y-auto p-2">
                  {componentEntries.map(({ key, title, category }) => (
                    <div
                      key={key}
                      className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-kumo-subtle/5"
                    >
                      <Checkbox
                        label={`${title} (${key})`}
                        checked={form.injectedComponents.includes(key)}
                        onCheckedChange={(checked) => toggleComponent(key, Boolean(checked))}
                      />
                      {category && <span className="text-xs text-kumo-subtle">{category}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* OpenAPI Injection */}
            <div className="grid gap-2.5">
              <div className="flex items-center justify-between border-b border-kumo-line/40 pb-2">
                <Text variant="heading" as="h3">
                  {t("promptOpenApi")}
                </Text>
                {openApiDocs.length > 0 && (
                  <Checkbox
                    label={t("selectAll")}
                    checked={isAllOpenApiSelected}
                    indeterminate={isSomeOpenApiSelected}
                    onCheckedChange={(checked) => handleToggleAllOpenApi(Boolean(checked))}
                  />
                )}
              </div>
              {openApiDocs.length === 0 ? (
                <Empty title={t("promptNoOpenApi")} />
              ) : (
                <div className="grid max-h-64 gap-1 overflow-y-auto p-2">
                  {openApiDocs.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-kumo-subtle/5"
                    >
                      <Checkbox
                        label={doc.name}
                        checked={form.injectedOpenApiDocIds.includes(doc.id)}
                        onCheckedChange={(checked) => toggleOpenApi(doc.id, Boolean(checked))}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </LayerCard.Primary>
        </LayerCard>

        <LayerCard>
          <LayerCard.Secondary>{t("promptPreview")}</LayerCard.Secondary>
          <LayerCard.Primary className="grid gap-3">
            <Text variant="secondary">{t("promptPreviewDescription")}</Text>
            <div className="max-h-96 overflow-auto p-1">
              <Code code={preview} />
            </div>
          </LayerCard.Primary>
        </LayerCard>
      </div>

      <Dialog.Root open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <Dialog size="sm" className="px-6 py-6">
          <Dialog.Title>{t("promptDeleteConfirmTitle")}</Dialog.Title>
          <div className="grid gap-4 py-4">
            <Text>{t("promptDeleteConfirmDescription")}</Text>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDeleteConfirm(false)}>
                {t("cancel")}
              </Button>
              <Button
                variant="primary"
                loading={remove.isPending}
                onClick={() => {
                  if (promptId) {
                    remove.mutate({ params: { path: { appId, promptId } } });
                  }
                }}
              >
                {t("delete")}
              </Button>
            </div>
          </div>
        </Dialog>
      </Dialog.Root>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <LayerCard>
      <LayerCard.Secondary>{label}</LayerCard.Secondary>
      <LayerCard.Primary className="gap-1">
        <Text variant="heading" as="p" size="lg">
          {value}
        </Text>
      </LayerCard.Primary>
    </LayerCard>
  );
}

function SystemView() {
  const { t } = useI18n();
  const health = api.useQuery("get", "/api/v1/health");
  const storage = api.useQuery("get", "/api/v1/storage/health");
  return (
    <>
      <PageHeader title={t("system")} description="Process, database, and storage health." />
      {health.error ? (
        <ErrorState error={health.error} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <Surface className="grid gap-3 p-4">
            <Text variant="heading" as="h2">
              Health
            </Text>
            <Text>Process: {health.data?.status ?? "loading"}</Text>
            <Text>Database: {health.data?.database.status ?? "loading"}</Text>
          </Surface>
          <Surface className="grid gap-3 p-4">
            <Text variant="heading" as="h2">
              Storage
            </Text>
            <Text>{storage.data ? JSON.stringify(storage.data) : "loading"}</Text>
          </Surface>
        </div>
      )}
      <Surface className="mt-4 grid gap-2 p-4">
        <a className="text-kumo-link" href="/openapi.json">
          /openapi.json
        </a>
        <a className="text-kumo-link" href="/reference">
          /reference
        </a>
      </Surface>
    </>
  );
}

function NotFoundView() {
  const { t } = useI18n();
  return <Empty title={t("notFound")} description={t("noResultsDescription")} />;
}
