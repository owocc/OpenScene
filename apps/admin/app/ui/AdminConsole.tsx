"use client";

import {
  ArrowLeft,
  ArrowRight,
  ArrowSquareOut,
  CaretDown,
  CaretRight,
  Check,
  ClipboardText as ClipboardTextIcon,
  Code as CodeIcon,
  Cloud,
  Copy,
  Database,
  DotsThree,
  Eye,
  File as FileIcon,
  Folder,
  Lock,
  MusicNotes,
  PencilSimple,
  Plus,
  Power,
  Star,
  Tag,
  Trash,
  UploadSimple,
  VideoCamera,
} from "@phosphor-icons/react";
import {
  APP_TYPE_FLUTTER,
  APP_TYPE_REACT_NATIVE,
  APP_TYPE_WEB,
  SceneManifestSchema,
  type AppType,
  type ComponentManifest,
} from "@openscene-ai/core";
import { DeleteResource, useKumoToastManager } from "@cloudflare/kumo";
import { Badge } from "@cloudflare/kumo/components/badge";
import { Button, LinkButton } from "@cloudflare/kumo/components/button";
import { Code } from "@cloudflare/kumo/components/code";
import { ClipboardText } from "@cloudflare/kumo/components/clipboard-text";
import { Collapsible } from "@cloudflare/kumo/components/collapsible";
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
import { PageSkeleton, type PageSkeletonVariant } from "./PageSkeleton";
import {
  authClient,
  useSession,
  signOut,
  useActiveOrganization,
  useListOrganizations,
  useActiveMember,
} from "@/lib/auth-client";
import { defaultRoleStatements, hasStatement, statements } from "@/lib/permissions";
import { useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { buildHref, isAppScopedPath } from "./navigation";
import { clsx as cn } from "clsx";
import type { components } from "@openscene-ai/api-client";
import type { paths } from "@openscene-ai/api-client/generated";
import { api, fetchClient } from "./api";
import { useAdminContext, useI18n, type MessageKey } from "./i18n";
import { OpenApiDocDetailView } from "./OpenApiDocDetailView";
type App = components["schemas"]["App"];

function getActiveManifest(data: unknown) {
  const result = SceneManifestSchema.safeParse(
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
  const { viewPath } = context;
  const { t } = useI18n();
  const appsQuery = api.useQuery("get", "/api/v1/apps", { params: { query: { limit: "100" } } });

  if (viewPath === "/apps") return <AppsView />;
  if (viewPath === "/keys") return <KeysView />;
  if (viewPath === "/system") return <SystemView />;
  if (
    isAppScopedPath(pathname) &&
    context.appId &&
    appsQuery.data &&
    !appsQuery.data.items.some((app) => app.id === context.appId)
  ) {
    return (
      <Empty
        icon={<ClipboardTextIcon size={32} />}
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
        icon={<ClipboardTextIcon size={32} />}
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
  if (viewPath === "/overview") return <OverviewView />;
  if (viewPath === "/pages" || viewPath === "/templates")
    return <ResourceListView kind={viewPath.slice(1) as "pages" | "templates"} />;
  if (viewPath.startsWith("/pages/") || viewPath.startsWith("/templates/"))
    return <ResourceDetailView />;
  if (viewPath === "/preview-profiles") return <PreviewProfilesView />;
  if (viewPath === "/categories") return <CategoriesView />;
  if (viewPath === "/locales") return <LocalesView />;
  if (viewPath === "/assets") return <AssetsView />;
  if (viewPath === "/openapi-docs") return <OpenApiDocsView />;
  if (viewPath.startsWith("/openapi-docs/")) return <OpenApiDocDetailView />;
  if (viewPath === "/manifest" || viewPath === "/meta") return <MetaView />;
  if (viewPath === "/components") return <ComponentsView />;
  if (viewPath.startsWith("/components/")) return <ComponentDetailView />;
  if (viewPath === "/organization") return <OrganizationView />;
  if (viewPath === "/settings") return <SettingsView />;
  if (viewPath === "/account") return <AccountView />;
  if (viewPath === "/prompts" || viewPath === "/prompt") return <PromptsListView />;
  if (viewPath.startsWith("/prompts/") || viewPath.startsWith("/prompt/"))
    return <PromptEditorView />;

  if (viewPath === "/ai") return <AiView />;
  if (viewPath === "/system-prompt") return <SystemPromptView />;
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

function LoadingState({
  variant = "table",
  hasHeader = true,
  rows = 5,
  count = 6,
}: {
  variant?: PageSkeletonVariant;
  hasHeader?: boolean;
  rows?: number;
  count?: number;
}) {
  return <PageSkeleton variant={variant} hasHeader={hasHeader} rows={rows} count={count} />;
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
  const create = api.useMutation("post", "/api/v1/apps");
  const update = api.useMutation("patch", "/api/v1/apps/{appId}", {
    onSuccess: () => {
      setEditing(null);
      toast.add({ title: t("updated"), description: t("apps") });
      void queryClient.invalidateQueries();
      void query.refetch();
    },
  });
  const remove = api.useMutation("delete", "/api/v1/apps/{appId}", {
    onSuccess: () => {
      setDeleteId(null);
      toast.add({ title: t("deleted"), description: t("apps") });
      void queryClient.invalidateQueries();
      void query.refetch();
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
    setOpen(true);
  }
  async function submitCreate() {
    try {
      await create.mutateAsync({
        body: {
          key: form.key,
          name: form.name,
          description: form.description,
          type: form.type as AppType,
          status: form.status as "active" | "disabled",
          manifest: { mode: form.mode as "remote" | "push" },
        },
      });
      setOpen(false);
      toast.add({ title: t("created"), description: t("apps") });
      void queryClient.invalidateQueries();
      await query.refetch();
    } catch (err) {
      console.error("Create app error:", err);
    }
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
        <LoadingState variant="table" hasHeader={false} />
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
              <col style={{ width: "120px" }} />
              <col style={{ width: "140px" }} />
              <col style={{ width: "56px" }} />
            </colgroup>
            <Table.Header>
              <Table.Row>
                <Table.Head>{t("app")}</Table.Head>
                <Table.Head>Type</Table.Head>
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
                    <Badge variant="neutral">{app.type}</Badge>
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
            Create an OpenScene project. Publishing keys are managed separately.
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
            <Select
              label="Type"
              value={form.type}
              className="w-full"
              items={{
                [APP_TYPE_WEB]: "Web",
                [APP_TYPE_REACT_NATIVE]: { label: "React Native (Coming soon)", disabled: true },
                [APP_TYPE_FLUTTER]: { label: "Flutter (Coming soon)", disabled: true },
              }}
              onValueChange={(value) => {
                if (value === APP_TYPE_WEB) setForm({ ...form, type: value });
              }}
            />
            <Input
              label="Description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <Select
              label="Manifest mode"
              value={form.mode}
              className="w-full"
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
  if (appQuery.isLoading) return <LoadingState variant="overview" />;
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
    templateVersionId: "",
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
  const templatesListQuery = api.useQuery(
    "get",
    "/api/v1/apps/{appId}/templates",
    {
      params: {
        path: { appId: context.appId ?? "" },
        query: { limit: "100" },
      },
    },
    { enabled: Boolean(context.appId) && kind === "pages" },
  );
  const publishedTemplates = useMemo(
    () =>
      (templatesListQuery.data?.items ?? []).filter(
        (tpl) => tpl.status === "published" || tpl.status === "active",
      ),
    [templatesListQuery.data?.items],
  );
  const selectedTemplate = publishedTemplates.find((tpl) => tpl.id === form.templateId);
  const templateVersionsQuery = api.useQuery(
    "get",
    "/api/v1/apps/{appId}/documents/{documentId}/versions",
    {
      params: {
        path: {
          appId: context.appId ?? "",
          documentId: selectedTemplate?.documentId ?? "",
        },
      },
    },
    { enabled: Boolean(context.appId && selectedTemplate?.documentId) },
  );
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
    onError: (error) => {
      setDeleteId(null);
      toast.add({
        title: t("requestFailed"),
        description:
          error instanceof Error
            ? error.message
            : typeof error === "object" && error !== null && "message" in error
              ? String(error.message)
              : undefined,
      });
    },
  });
  const deleteTemplate = api.useMutation("delete", "/api/v1/apps/{appId}/templates/{templateId}", {
    onSuccess: () => {
      setDeleteId(null);
      toast.add({ title: t("deleted") });
      void queryClient.invalidateQueries();
    },
    onError: (error) => {
      setDeleteId(null);
      toast.add({
        title: t("requestFailed"),
        description:
          error instanceof Error
            ? error.message
            : typeof error === "object" && error !== null && "message" in error
              ? String(error.message)
              : undefined,
      });
    },
  });
  const profilesQuery = api.useQuery("get", "/api/v1/apps/{appId}/preview-profiles", {
    params: { path: { appId: context.appId ?? "" } },
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

  function openStudio(resource: Resource) {
    const profile = profilesQuery.data?.find((item) => item.isDefault) ?? profilesQuery.data?.[0];
    if (!profile) return;
    studioWindow.current = window.open("", "_blank");
    if (studioWindow.current) studioWindow.current.opener = null;
    studio.mutate({
      params: { path: { appId: context.appId ?? "" } },
      body: {
        resourceKind: kind === "pages" ? "page" : "template",
        resourceId: resource.id,
        previewProfileId: profile.id,
        returnUrl: window.location.href,
      },
    });
  }
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
      templateVersionId: "",
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
      defaultPromptId: resource.defaultPromptId ?? "",
      templateId: resource.sourceTemplate?.templateId ?? "",
      templateVersionId: resource.sourceTemplate?.versionId ?? "",
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
          ...(form.templateId
            ? {
                sourceTemplate: {
                  templateId: form.templateId,
                  ...(form.templateVersionId ? { versionId: form.templateVersionId } : {}),
                },
              }
            : {}),
        },
      });
    } else {
      createTemplate.mutate({ params: { path: { appId: context.appId ?? "" } }, body });
    }
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
          items={
            kind === "pages"
              ? {
                  active: t("active"),
                  disabled: t("disabled"),
                  draft: t("draft"),
                  published: t("published"),
                }
              : {
                  draft: t("draft"),
                  published: t("published"),
                  disabled: t("disabled"),
                }
          }
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
        <LoadingState variant="table" hasHeader={false} />
      ) : resources.length === 0 ? (
        <Empty
          icon={kind === "pages" ? <FileIcon size={40} /> : <Copy size={40} />}
          title={
            statusFilter || categoryFilter || search
              ? t("noResults")
              : kind === "pages"
                ? t("noPagesYet")
                : t("noTemplatesYet")
          }
          description={
            statusFilter || categoryFilter || search
              ? t("noResultsDescription")
              : kind === "pages"
                ? t("noPagesDescription")
                : t("noTemplatesDescription")
          }
          contents={
            <Button variant="primary" icon={Plus} onClick={openCreate}>
              {t("create")} {title}
            </Button>
          }
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
                        <DropdownMenu.Item
                          icon={ArrowSquareOut}
                          onClick={() => openStudio(resource)}
                        >
                          {t("studio")}
                        </DropdownMenu.Item>
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
              className="w-full"
              items={
                kind === "pages"
                  ? {
                      draft: t("draft"),
                      active: t("active"),
                      published: t("published"),
                      disabled: t("disabled"),
                    }
                  : {
                      draft: t("draft"),
                      published: t("published"),
                      disabled: t("disabled"),
                    }
              }
              onValueChange={(value) => {
                if (typeof value === "string") setForm({ ...form, status: value });
              }}
            />
            {kind === "pages" ? (
              <Select
                label={t("pageDefaultPrompt")}
                value={form.defaultPromptId || "none"}
                className="w-full"
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
                <Select
                  label={t("template")}
                  value={form.templateId || "none"}
                  className="w-full"
                  items={{
                    none: t("noneTemplate"),
                    ...Object.fromEntries(
                      publishedTemplates.map((tpl) => [
                        tpl.id,
                        tpl.title ? `${tpl.title} (${tpl.key})` : tpl.key,
                      ]),
                    ),
                  }}
                  onValueChange={(value) => {
                    if (typeof value === "string")
                      setForm({
                        ...form,
                        templateId: value === "none" ? "" : value,
                        templateVersionId: "",
                      });
                  }}
                />
                {form.templateId ? (
                  <Select
                    label={t("templateVersion")}
                    value={form.templateVersionId || "default"}
                    className="w-full"
                    items={{
                      default: `${t("defaultTemplateVersion")}${
                        selectedTemplate?.currentVersionId
                          ? ` (v${
                              (templateVersionsQuery.data ?? []).find(
                                (v) => v.id === selectedTemplate?.currentVersionId,
                              )?.versionNumber ?? ""
                            })`
                          : ""
                      }`,
                      ...Object.fromEntries(
                        (templateVersionsQuery.data ?? []).map((v) => [
                          v.id,
                          `v${v.versionNumber}${
                            v.id === selectedTemplate?.currentVersionId
                              ? ` (${t("currentVersion")})`
                              : ""
                          } · ${v.message || "—"}`,
                        ]),
                      ),
                    }}
                    onValueChange={(value) => {
                      if (typeof value === "string")
                        setForm({
                          ...form,
                          templateVersionId: value === "default" ? "" : value,
                        });
                    }}
                  />
                ) : null}
              </>
            ) : null}
            {kind === "pages" && editing && editing.sourceTemplate?.templateId ? (
              <Input
                label={t("sourceTemplate")}
                value={
                  (templatesListQuery.data?.items ?? []).find(
                    (tpl) => tpl.id === editing.sourceTemplate?.templateId,
                  )?.title ??
                  (templatesListQuery.data?.items ?? []).find(
                    (tpl) => tpl.id === editing.sourceTemplate?.templateId,
                  )?.key ??
                  editing.sourceTemplate.templateId
                }
                disabled
              />
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
  const context = useAdminContext();
  const { t } = useI18n();
  const toast = useKumoToastManager();
  const queryClient = useQueryClient();
  const kind = context.viewPath.startsWith("/pages/") ? "page" : "template";
  const id = context.viewPath.split("/")[2] ?? "";
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
  const categoriesQuery = api.useQuery("get", "/api/v1/apps/{appId}/categories", {
    params: { path: { appId: context.appId ?? "" } },
  });
  const updatePageMutation = api.useMutation("patch", "/api/v1/apps/{appId}/pages/{pageId}", {
    onSuccess: () => {
      toast.add({ title: t("updated") });
      void queryClient.invalidateQueries();
    },
  });
  const updateTemplateMutation = api.useMutation(
    "patch",
    "/api/v1/apps/{appId}/templates/{templateId}",
    {
      onSuccess: () => {
        toast.add({ title: t("updated") });
        void queryClient.invalidateQueries();
      },
    },
  );
  const deleteVersionMutation = api.useMutation(
    "delete",
    "/api/v1/apps/{appId}/documents/{documentId}/versions/{versionId}",
    {
      onSuccess: () => {
        toast.add({ title: t("deleted") });
        void queryClient.invalidateQueries();
      },
    },
  );
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
  const [selectedVersion, setSelectedVersion] = useState<components["schemas"]["Version"] | null>(
    null,
  );
  const [deleteVersionItem, setDeleteVersionItem] = useState<
    components["schemas"]["Version"] | null
  >(null);
  const [createVersionDialog, setCreateVersionDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    status: "draft",
    categoryId: "",
    defaultPromptId: "",
    currentVersionId: "",
  });

  function openEdit() {
    if (!resource) return;
    setEditForm({
      title: resource.title,
      description: resource.description,
      status: resource.status,
      categoryId: resource.categoryId ?? "",
      defaultPromptId:
        ((resource as Record<string, unknown>)?.defaultPromptId as string | null) ?? "",
      currentVersionId:
        ((resource as Record<string, unknown>)?.currentVersionId as string | null) ?? "",
    });
    setEditDialog(true);
  }

  function saveEdit() {
    if (!resource) return;
    if (kind === "page") {
      updatePageMutation.mutate(
        {
          params: { path: { appId: context.appId ?? "", pageId: resource.id } },
          body: {
            title: editForm.title,
            description: editForm.description,
            status: editForm.status as "active" | "disabled" | "draft" | "published",
            categoryId: editForm.categoryId ? editForm.categoryId : null,
            defaultPromptId: editForm.defaultPromptId ? editForm.defaultPromptId : null,
          },
        },
        {
          onSuccess: () => setEditDialog(false),
        },
      );
    } else {
      updateTemplateMutation.mutate(
        {
          params: { path: { appId: context.appId ?? "", templateId: resource.id } },
          body: {
            title: editForm.title,
            description: editForm.description,
            status: editForm.status as "active" | "disabled" | "draft" | "published",
            categoryId: editForm.categoryId ? editForm.categoryId : null,
            currentVersionId: editForm.currentVersionId ? editForm.currentVersionId : null,
          },
        },
        {
          onSuccess: () => setEditDialog(false),
        },
      );
    }
  }
  if (pageQuery.isLoading || templateQuery.isLoading) return <LoadingState variant="detail" />;
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
        {kind === "page" && pageResource?.sourceTemplate?.templateId ? (
          <Badge variant="neutral">
            {t("template")}:{" "}
            {templateQuery.data?.title
              ? `${templateQuery.data.title} (${templateQuery.data.key})`
              : (templateQuery.data?.key ?? pageResource.sourceTemplate.templateId)}
          </Badge>
        ) : null}
        <Button icon={PencilSimple} onClick={openEdit}>
          {t("edit")}
        </Button>
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
      <div className="flex flex-col gap-4">
        {kind === "page" && (
          <Surface className="grid gap-3 p-4">
            <Text variant="heading" as="h2">
              {t("pageDefaultPrompt")}
            </Text>
            <Text variant="secondary">{t("pageDefaultPromptDescription")}</Text>
            <Select
              label={t("pageDefaultPrompt")}
              value={((resource as Record<string, unknown>)?.defaultPromptId as string) ?? "none"}
              className="w-full"
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
        <div className="flex items-center justify-between pt-2">
          <Text variant="heading" as="h2">
            {t("versions")}
          </Text>
          <Button
            variant="primary"
            size="sm"
            icon={Plus}
            onClick={() => {
              setVersionMessage("");
              setCreateVersionDialog(true);
            }}
          >
            {t("createVersion")}
          </Button>
        </div>
        {(versionsQuery.data ?? []).length === 0 ? (
          <Empty
            title={t("noResults")}
            description={t("noResultsDescription")}
            contents={
              <Button
                onClick={() => {
                  setVersionMessage("");
                  setCreateVersionDialog(true);
                }}
              >
                {t("createVersion")}
              </Button>
            }
          />
        ) : (
          <Table layout="fixed">
            <colgroup>
              <col style={{ width: "120px" }} />
              <col />
              <col style={{ width: "200px" }} />
              <col style={{ width: "120px" }} />
              <col style={{ width: "56px" }} />
            </colgroup>
            <Table.Header>
              <Table.Row>
                <Table.Head>Version</Table.Head>
                <Table.Head>Message</Table.Head>
                <Table.Head>Created</Table.Head>
                <Table.Head>{t("status")}</Table.Head>
                <Table.Head sticky="right">
                  <span className="sr-only">{t("actions")}</span>
                </Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {(versionsQuery.data ?? []).map((item) => {
                const isCurrent =
                  kind === "template" &&
                  resource &&
                  "currentVersionId" in resource &&
                  resource.currentVersionId === item.id;
                return (
                  <Table.Row
                    key={item.id}
                    className="cursor-pointer transition hover:bg-kumo-hover"
                    onClick={() => setSelectedVersion(item)}
                  >
                    <Table.Cell>
                      <button
                        type="button"
                        className="font-medium text-kumo-link hover:underline"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedVersion(item);
                        }}
                      >
                        v{item.versionNumber}
                      </button>
                    </Table.Cell>
                    <Table.Cell className="truncate">{item.message || "—"}</Table.Cell>
                    <Table.Cell className="text-kumo-secondary">
                      {new Date(item.createdAt).toLocaleString()}
                    </Table.Cell>
                    <Table.Cell>
                      {isCurrent ? <Badge variant="green">{t("currentVersion")}</Badge> : "—"}
                    </Table.Cell>
                    <Table.Cell
                      sticky="right"
                      className="text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
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
                          <DropdownMenu.Item icon={Eye} onClick={() => setSelectedVersion(item)}>
                            {t("details")}
                          </DropdownMenu.Item>
                          {kind === "template" && !isCurrent ? (
                            <DropdownMenu.Item
                              icon={Star}
                              onClick={() =>
                                updateTemplateMutation.mutate({
                                  params: {
                                    path: {
                                      appId: context.appId ?? "",
                                      templateId: resource.id,
                                    },
                                  },
                                  body: { currentVersionId: item.id },
                                })
                              }
                            >
                              {t("setCurrentVersion")}
                            </DropdownMenu.Item>
                          ) : null}
                          {kind === "page" ? (
                            <DropdownMenu.Item
                              icon={ArrowSquareOut}
                              onClick={() =>
                                release.mutate({
                                  params: {
                                    path: {
                                      appId: context.appId ?? "",
                                      documentId: resource.documentId,
                                    },
                                  },
                                  body: { versionId: item.id, channel },
                                })
                              }
                            >
                              {t("releases")}
                            </DropdownMenu.Item>
                          ) : null}
                          {!isCurrent ? (
                            <>
                              <DropdownMenu.Separator />
                              <DropdownMenu.Item
                                icon={Trash}
                                variant="danger"
                                onClick={() => {
                                  setDeleteVersionItem(item);
                                }}
                              >
                                {t("delete")}
                              </DropdownMenu.Item>
                            </>
                          ) : null}
                        </DropdownMenu.Content>
                      </DropdownMenu>
                    </Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table>
        )}
        {kind === "page" && (
          <div className="max-w-xs">
            <Input label="Channel" value={channel} onChange={(e) => setChannel(e.target.value)} />
          </div>
        )}
        {kind === "page" && (
          <Surface className="grid gap-2 p-4">
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
        )}
        <Collapsible.Root defaultOpen={false}>
          <Surface className="p-4">
            <Collapsible.DefaultTrigger className="w-full justify-between">
              <Text variant="heading" as="h2">
                {t("draft")}
              </Text>
            </Collapsible.DefaultTrigger>
            <Collapsible.Panel className="pt-3">
              <Code code={json} lang="jsonc" />
            </Collapsible.Panel>
          </Surface>
        </Collapsible.Root>
      </div>
      <Dialog.Root open={editDialog} onOpenChange={setEditDialog}>
        <Dialog size="lg" className="px-8 py-6">
          <Dialog.Title>{t("edit")}</Dialog.Title>
          <Dialog.Description>
            {kind === "page" ? t("pageEditDescription") : t("templateEditDescription")}
          </Dialog.Description>
          <div className="grid gap-3 py-4">
            <Input
              label={t("title")}
              value={editForm.title}
              onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
            />
            <Textarea
              label={t("description")}
              value={editForm.description}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
            />
            <Select
              label={t("status")}
              value={editForm.status}
              items={
                kind === "page"
                  ? {
                      draft: t("draft"),
                      active: t("active"),
                      published: t("published"),
                      disabled: t("disabled"),
                    }
                  : {
                      draft: t("draft"),
                      published: t("published"),
                      disabled: t("disabled"),
                    }
              }
              onValueChange={(val) => {
                if (typeof val === "string") setEditForm({ ...editForm, status: val });
              }}
            />
            <Select
              label={t("category")}
              value={editForm.categoryId || "none"}
              items={{
                none: t("uncategorized"),
                ...Object.fromEntries(
                  (categoriesQuery.data ?? []).map((cat) => [cat.id, cat.name]),
                ),
              }}
              onValueChange={(val) => {
                if (typeof val === "string")
                  setEditForm({ ...editForm, categoryId: val === "none" ? "" : val });
              }}
            />
            {kind === "page" ? (
              <Select
                label={t("pageDefaultPrompt")}
                value={editForm.defaultPromptId || "none"}
                items={{
                  none: t("noneDefaultPrompt"),
                  ...Object.fromEntries(
                    (promptsQuery.data ?? []).map((p) => [p.id, `${p.name} (${p.key})`]),
                  ),
                }}
                onValueChange={(val) => {
                  if (typeof val === "string")
                    setEditForm({ ...editForm, defaultPromptId: val === "none" ? "" : val });
                }}
              />
            ) : null}
            {kind === "template" ? (
              <Select
                label={t("currentVersion")}
                value={editForm.currentVersionId || "none"}
                items={{
                  none: t("none"),
                  ...Object.fromEntries(
                    (versionsQuery.data ?? []).map((v) => [
                      v.id,
                      `v${v.versionNumber} · ${v.message || "—"}`,
                    ]),
                  ),
                }}
                onValueChange={(val) => {
                  if (typeof val === "string")
                    setEditForm({ ...editForm, currentVersionId: val === "none" ? "" : val });
                }}
              />
            ) : null}
          </div>
          <div className="flex justify-end gap-2">
            <Dialog.Close render={<Button>{t("cancel")}</Button>} />
            <Button
              variant="primary"
              loading={updatePageMutation.isPending || updateTemplateMutation.isPending}
              onClick={saveEdit}
            >
              {t("save")}
            </Button>
          </div>
        </Dialog>
      </Dialog.Root>
      <Dialog.Root
        open={Boolean(selectedVersion)}
        onOpenChange={(open) => {
          if (!open) setSelectedVersion(null);
        }}
      >
        <Dialog size="lg" className="max-w-3xl px-8 py-6">
          <Dialog.Title>
            {selectedVersion
              ? `v${selectedVersion.versionNumber} ${selectedVersion.message ? `· ${selectedVersion.message}` : ""}`
              : t("details")}
          </Dialog.Title>
          <Dialog.Description>
            {selectedVersion ? new Date(selectedVersion.createdAt).toLocaleString() : ""}
          </Dialog.Description>
          {selectedVersion ? (
            <div className="flex flex-col gap-4 py-4">
              <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                <div>
                  <Text variant="secondary">Version</Text>
                  <span className="font-mono font-medium">v{selectedVersion.versionNumber}</span>
                </div>
                <div>
                  <Text variant="secondary">Revision</Text>
                  <span className="font-mono">{selectedVersion.sourceRevision}</span>
                </div>
                <div>
                  <Text variant="secondary">Created At</Text>
                  <Text>{new Date(selectedVersion.createdAt).toLocaleDateString()}</Text>
                </div>
                <div>
                  <Text variant="secondary">Status</Text>
                  <div>
                    {kind === "template" &&
                    resource &&
                    "currentVersionId" in resource &&
                    resource.currentVersionId === selectedVersion.id ? (
                      <Badge variant="green">{t("currentVersion")}</Badge>
                    ) : (
                      <Text variant="secondary">—</Text>
                    )}
                  </div>
                </div>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <Text variant="secondary">Document JSON</Text>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={Copy}
                    onClick={() => {
                      void navigator.clipboard.writeText(
                        JSON.stringify(selectedVersion.document ?? {}, null, 2),
                      );
                      toast.add({ title: t("copied") });
                    }}
                  >
                    {t("copy")}
                  </Button>
                </div>
                <div className="max-h-96 overflow-auto rounded-md border border-kumo-line bg-kumo-subtle/10 p-2">
                  <Code
                    code={JSON.stringify(selectedVersion.document ?? {}, null, 2)}
                    lang="jsonc"
                  />
                </div>
              </div>
            </div>
          ) : null}
          <div className="flex justify-between gap-2 pt-2">
            <div>
              {kind === "template" &&
              selectedVersion &&
              resource &&
              "currentVersionId" in resource &&
              resource.currentVersionId !== selectedVersion.id ? (
                <Button
                  loading={updateTemplateMutation.isPending}
                  onClick={() => {
                    updateTemplateMutation.mutate(
                      {
                        params: { path: { appId: context.appId ?? "", templateId: resource.id } },
                        body: { currentVersionId: selectedVersion.id },
                      },
                      {
                        onSuccess: () => setSelectedVersion(null),
                      },
                    );
                  }}
                >
                  {t("setCurrentVersion")}
                </Button>
              ) : null}
            </div>
            <Dialog.Close render={<Button>{t("cancel")}</Button>} />
          </div>
        </Dialog>
      </Dialog.Root>
      <Dialog.Root open={createVersionDialog} onOpenChange={setCreateVersionDialog}>
        <Dialog size="lg" className="max-w-md px-8 py-6">
          <Dialog.Title>{t("createVersion")}</Dialog.Title>
          <Dialog.Description>{t("createVersionDescription")}</Dialog.Description>
          {(() => {
            const versions = versionsQuery.data ?? [];
            const latestVersionNumber = versions.reduce(
              (max, v) => (v.versionNumber > max ? v.versionNumber : max),
              0,
            );
            const nextVersionNumber = latestVersionNumber + 1;
            return (
              <div className="flex flex-col gap-4 py-4">
                <div className="flex items-center justify-between rounded-md border border-kumo-line bg-kumo-subtle/10 px-4 py-3">
                  <div>
                    <div className="text-xs text-kumo-secondary">{t("newVersionPreview")}</div>
                    <div className="font-mono text-lg font-semibold text-kumo-default">
                      v{nextVersionNumber}
                    </div>
                  </div>
                  <Badge variant="blue">{`Revision ${
                    (draftQuery.data as { revision?: number } | undefined)?.revision ?? 0
                  }`}</Badge>
                </div>
                <Textarea
                  label={t("versionMessage")}
                  value={versionMessage}
                  onChange={(e) => setVersionMessage(e.target.value)}
                  placeholder={t("versionMessagePlaceholder")}
                  rows={3}
                  autoFocus
                />
              </div>
            );
          })()}
          <div className="flex justify-end gap-2">
            <Dialog.Close render={<Button>{t("cancel")}</Button>} />
            <Button
              variant="primary"
              loading={version.isPending}
              onClick={() =>
                version.mutate(
                  {
                    params: {
                      path: { appId: context.appId ?? "", documentId: resource.documentId },
                    },
                    body: { message: versionMessage },
                  },
                  {
                    onSuccess: () => {
                      setCreateVersionDialog(false);
                      setVersionMessage("");
                    },
                  },
                )
              }
            >
              {t("create")}
            </Button>
          </div>
        </Dialog>
      </Dialog.Root>
      <DeleteResource
        open={Boolean(deleteVersionItem)}
        onOpenChange={(open) => {
          if (!open) setDeleteVersionItem(null);
        }}
        resourceType="Version"
        resourceName={deleteVersionItem ? `v${deleteVersionItem.versionNumber}` : ""}
        deleteButtonText={`${t("delete")} Version`}
        isDeleting={deleteVersionMutation.isPending}
        onDelete={async () => {
          if (!deleteVersionItem) return;
          await deleteVersionMutation.mutateAsync({
            params: {
              path: {
                appId: context.appId ?? "",
                documentId: resource.documentId,
                versionId: deleteVersionItem.id,
              },
            },
          });
          setDeleteVersionItem(null);
        }}
      />
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
        <LoadingState variant="cards" hasHeader={false} />
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
              className="w-full"
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
  const [fileInfo, setFileInfo] = useState<{ fileName: string; endpointsCount: number } | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (file: File) => {
    if (!file.name.toLowerCase().endsWith(".json")) {
      toast.add({ title: t("onlyJsonAllowed"), type: "error" });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      try {
        const parsed = JSON.parse(text);
        if (
          typeof parsed !== "object" ||
          parsed === null ||
          Array.isArray(parsed) ||
          typeof (parsed as { paths?: unknown }).paths !== "object" ||
          (parsed as { paths?: unknown }).paths === null ||
          Array.isArray((parsed as { paths?: unknown }).paths)
        ) {
          setJsonInvalid(true);
          toast.add({ title: t("openApiJsonInvalid"), type: "error" });
          return;
        }
        const endpointsCount = Object.keys(
          (parsed as { paths?: Record<string, unknown> }).paths ?? {},
        ).length;
        const specTitle = (parsed as { info?: { title?: string } }).info?.title;
        setForm((prev) => ({
          ...prev,
          name: prev.name.trim()
            ? prev.name
            : (specTitle || file.name.replace(/\.json$/i, "")).trim(),
          json: JSON.stringify(parsed, null, 2),
        }));
        setFileInfo({ fileName: file.name, endpointsCount });
        setJsonInvalid(false);
        toast.add({
          title: `${file.name} (${endpointsCount} ${t("endpointsDetected")})`,
          type: "success",
        });
      } catch {
        setJsonInvalid(true);
        toast.add({ title: t("openApiJsonInvalid"), type: "error" });
      }
    };
    reader.readAsText(file);
  };
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
            setFileInfo(null);
            setDialog(true);
          }}
        >
          {t("create")}
        </Button>
      </PageHeader>
      {query.error ? <ErrorState error={query.error} /> : null}
      {query.isLoading ? (
        <LoadingState variant="table" hasHeader={false} />
      ) : items.length === 0 ? (
        <Empty
          icon={<CodeIcon size={40} />}
          title={t("noOpenApiDocsYet")}
          description={t("noOpenApiDocsDescription")}
          contents={
            <Button
              variant="primary"
              icon={Plus}
              onClick={() => {
                setEditing(null);
                setForm({ name: "", json: "", isDefault: false });
                setJsonInvalid(false);
                setFileInfo(null);
                setDialog(true);
              }}
            >
              {t("create")}
            </Button>
          }
        />
      ) : (
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
                  <Table.Cell>
                    <button
                      type="button"
                      onClick={() => context.router.push(context.href(`/openapi-docs/${item.id}`))}
                      className="text-left font-medium text-kumo-link hover:underline cursor-pointer"
                    >
                      {item.name}
                    </button>
                  </Table.Cell>
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
                          icon={Eye}
                          onClick={() =>
                            context.router.push(context.href(`/openapi-docs/${item.id}`))
                          }
                        >
                          {t("viewDetails")}
                        </DropdownMenu.Item>
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
                            setFileInfo(null);
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
      )}
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
            {/* File Upload Selector (.json restricted) */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-kumo-default">
                  {t("uploadJsonFile")}
                </label>
                {fileInfo ? (
                  <Badge variant="green">
                    {fileInfo.fileName} ({fileInfo.endpointsCount} {t("endpointsDetected")})
                  </Badge>
                ) : null}
              </div>
              <input
                type="file"
                ref={fileInputRef}
                accept=".json,application/json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                  if (e.target) e.target.value = "";
                }}
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-kumo-line bg-kumo-canvas/60 p-3 text-xs text-kumo-subtle hover:border-kumo-brand hover:bg-kumo-tint hover:text-kumo-brand transition-colors cursor-pointer"
              >
                <UploadSimple size={16} />
                <span>{t("dropJsonFileHere")}</span>
              </div>
            </div>
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

  // Filters
  const [currentFolder, setCurrentFolder] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // Upload dialog state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploadFolder, setUploadFolder] = useState("/");
  const [uploadTags, setUploadTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [extractedDimensions, setExtractedDimensions] = useState<{
    width?: number;
    height?: number;
    duration?: number;
  }>({});
  const [uploadError, setUploadError] = useState("");

  // Edit dialog state
  type AssetListItem =
    paths["/api/v1/apps/{appId}/assets/{assetId}"]["get"]["responses"][200]["content"]["application/json"];
  const [editingAsset, setEditingAsset] = useState<AssetListItem | null>(null);
  const [editFolder, setEditFolder] = useState("/");
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editTagInput, setEditTagInput] = useState("");

  const query = api.useQuery("get", "/api/v1/apps/{appId}/assets", {
    params: { path: { appId: context.appId ?? "" } },
  });
  const foldersQuery = api.useQuery("get", "/api/v1/apps/{appId}/assets/folders", {
    params: { path: { appId: context.appId ?? "" } },
  });
  const storageConfigQuery = api.useQuery("get", "/api/v1/apps/{appId}/storage", {
    params: { path: { appId: context.appId ?? "" } },
  });
  const isS3Enabled = Boolean(
    storageConfigQuery.data?.config?.s3Enabled || storageConfigQuery.data?.config?.driver === "s3",
  );

  const intent = api.useMutation("post", "/api/v1/apps/{appId}/assets/upload-intents", {
    onSuccess: () => {
      toast.add({ title: t("created") });
    },
  });
  const complete = api.useMutation("post", "/api/v1/apps/{appId}/assets/{assetId}/complete", {
    onSuccess: () => {
      setFile(null);
      setUploadError("");
      setIsUploadOpen(false);
      setUploadTags([]);
      toast.add({ title: t("updated") });
      void queryClient.invalidateQueries();
    },
  });
  const patch = api.useMutation("patch", "/api/v1/apps/{appId}/assets/{assetId}", {
    onSuccess: () => {
      setEditingAsset(null);
      toast.add({ title: t("assetUpdated") });
      void queryClient.invalidateQueries();
    },
  });
  const remove = api.useMutation("delete", "/api/v1/apps/{appId}/assets/{assetId}", {
    onSuccess: () => {
      toast.add({ title: t("deleted") });
      void queryClient.invalidateQueries();
    },
  });

  // Extract dimensions when file changes
  useEffect(() => {
    if (!file) {
      setExtractedDimensions({});
      return;
    }
    const isImg = file.type.startsWith("image/");
    const isAud = file.type.startsWith("audio/");
    const isVid = file.type.startsWith("video/");

    if (isImg) {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        setExtractedDimensions({ width: img.naturalWidth, height: img.naturalHeight });
        URL.revokeObjectURL(url);
      };
      img.onerror = () => URL.revokeObjectURL(url);
      img.src = url;
    } else if (isAud) {
      const url = URL.createObjectURL(file);
      const audio = new Audio();
      audio.onloadedmetadata = () => {
        setExtractedDimensions({ duration: Math.round(audio.duration) });
        URL.revokeObjectURL(url);
      };
      audio.onerror = () => URL.revokeObjectURL(url);
      audio.src = url;
    } else if (isVid) {
      const url = URL.createObjectURL(file);
      const video = document.createElement("video");
      video.onloadedmetadata = () => {
        setExtractedDimensions({
          width: video.videoWidth,
          height: video.videoHeight,
          duration: Math.round(video.duration),
        });
        URL.revokeObjectURL(url);
      };
      video.onerror = () => URL.revokeObjectURL(url);
      video.src = url;
    } else {
      setExtractedDimensions({});
    }
  }, [file]);

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
          folder: uploadFolder,
          tags: uploadTags,
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
        body: {
          width: extractedDimensions.width,
          height: extractedDimensions.height,
          duration: extractedDimensions.duration,
          folder: uploadFolder,
          tags: uploadTags,
        },
      });
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : t("requestFailed"));
    }
  }

  // Filtered asset list
  const filteredAssets = useMemo(() => {
    let list = query.data ?? [];
    if (currentFolder !== "all") {
      list = list.filter((a) => (a.folder || "/") === currentFolder);
    }
    if (selectedType !== "all") {
      if (selectedType === "image") list = list.filter((a) => a.mimeType.startsWith("image/"));
      else if (selectedType === "audio") list = list.filter((a) => a.mimeType.startsWith("audio/"));
      else if (selectedType === "video") list = list.filter((a) => a.mimeType.startsWith("video/"));
      else if (selectedType === "other")
        list = list.filter(
          (a) =>
            !a.mimeType.startsWith("image/") &&
            !a.mimeType.startsWith("audio/") &&
            !a.mimeType.startsWith("video/"),
        );
    }
    if (selectedTag) {
      list = list.filter((a) => (a.tags || []).includes(selectedTag));
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (a) =>
          a.fileName.toLowerCase().includes(q) ||
          (a.folder && a.folder.toLowerCase().includes(q)) ||
          (a.tags && a.tags.some((t) => t.toLowerCase().includes(q))),
      );
    }
    return list;
  }, [query.data, currentFolder, selectedType, selectedTag, searchQuery]);

  // Unique tags
  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const a of query.data ?? []) {
      for (const t of a.tags || []) {
        set.add(t);
      }
    }
    return Array.from(set);
  }, [query.data]);

  const folders = foldersQuery.data ?? ["/"];

  if (!isS3Enabled && !storageConfigQuery.isLoading) {
    return (
      <>
        <PageHeader
          title={t("assets")}
          description="支持图片、音频、适配文件多媒体资源存储，支持按文件夹分类与尺寸/标签管理。"
        />
        <Empty
          icon={<Folder size={32} />}
          title={t("s3StorageRequiredTitle")}
          description={t("s3StorageRequiredDescription")}
          contents={
            <LinkButton href={context.href("/settings")} variant="primary">
              {t("goToStorageSettings")}
            </LinkButton>
          }
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={t("assets")}
        description="支持图片、音频、适配文件多媒体资源存储，支持按文件夹分类与尺寸/标签管理。"
      >
        <Button
          variant="primary"
          icon={Plus}
          onClick={() => {
            setFile(null);
            setUploadError("");
            setIsUploadOpen(true);
          }}
        >
          {t("upload")}
        </Button>
      </PageHeader>

      {/* Toolbar: Search, Folder Filter, Type Filter */}
      <Surface className="mb-4 p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
          <Input
            aria-label="搜索文件名、文件夹或标签"
            placeholder="搜索文件名、文件夹或标签..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-64"
          />
          <div className="flex items-center gap-1.5 bg-kumo-base border border-kumo-line rounded-lg px-2.5 py-1 text-xs">
            <Folder size={14} className="text-kumo-subtle" />
            <select
              value={currentFolder}
              onChange={(e) => setCurrentFolder(e.target.value)}
              className="bg-transparent outline-none text-xs cursor-pointer"
            >
              <option value="all">{t("allFolders")}</option>
              {folders.map((f) => (
                <option key={f} value={f}>
                  {f === "/" ? "/ (根目录)" : f}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1 bg-kumo-base border border-kumo-line rounded-lg p-0.5 text-xs">
            {(["all", "image", "audio", "video", "other"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setSelectedType(type)}
                className={cn(
                  "px-2 py-1 rounded text-xs transition-colors cursor-pointer capitalize",
                  selectedType === type
                    ? "bg-kumo-primary text-white font-medium"
                    : "text-kumo-subtle hover:text-kumo-base",
                )}
              >
                {type === "all" ? "全部" : type}
              </button>
            ))}
          </div>
        </div>

        {allTags.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs overflow-x-auto">
            <Tag size={13} className="text-kumo-subtle shrink-0" />
            <button
              type="button"
              onClick={() => setSelectedTag(null)}
              className={cn(
                "px-2 py-0.5 rounded-full text-[11px] border transition-colors cursor-pointer",
                selectedTag === null
                  ? "bg-kumo-primary text-white border-kumo-primary"
                  : "bg-kumo-base text-kumo-subtle border-kumo-line",
              )}
            >
              全部
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                className={cn(
                  "px-2 py-0.5 rounded-full text-[11px] border transition-colors cursor-pointer",
                  selectedTag === tag
                    ? "bg-kumo-primary text-white border-kumo-primary"
                    : "bg-kumo-base text-kumo-subtle border-kumo-line",
                )}
              >
                #{tag}
              </button>
            ))}
          </div>
        )}
      </Surface>

      {query.error ? <ErrorState error={query.error} /> : null}

      <LayerCard className="w-full overflow-x-auto p-0">
        <Table layout="fixed">
          <colgroup>
            <col style={{ width: "60px" }} />
            <col />
            <col style={{ width: "140px" }} />
            <col style={{ width: "140px" }} />
            <col style={{ width: "110px" }} />
            <col style={{ width: "100px" }} />
            <col style={{ width: "56px" }} />
          </colgroup>
          <Table.Header>
            <Table.Row>
              <Table.Head>预览</Table.Head>
              <Table.Head>文件与标签</Table.Head>
              <Table.Head>{t("folder")}</Table.Head>
              <Table.Head>{t("dimensions")}</Table.Head>
              <Table.Head>大小</Table.Head>
              <Table.Head>状态</Table.Head>
              <Table.Head sticky="right">
                <span className="sr-only">{t("actions")}</span>
              </Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {filteredAssets.map((asset) => {
              const isImg = asset.mimeType.startsWith("image/");
              const isAud = asset.mimeType.startsWith("audio/");
              const isVid = asset.mimeType.startsWith("video/");
              const assetUrl =
                asset.url || asset.path || `/api/v1/apps/${context.appId}/assets/${asset.id}/raw`;

              return (
                <Table.Row key={asset.id}>
                  {/* Preview Thumbnail */}
                  <Table.Cell>
                    <div className="size-9 rounded-md bg-kumo-base border border-kumo-line overflow-hidden flex items-center justify-center">
                      {isImg ? (
                        <img
                          src={assetUrl}
                          alt={asset.fileName}
                          className="w-full h-full object-contain"
                          loading="lazy"
                        />
                      ) : isAud ? (
                        <MusicNotes size={18} className="text-amber-500" />
                      ) : isVid ? (
                        <VideoCamera size={18} className="text-sky-500" />
                      ) : (
                        <FileIcon size={18} className="text-kumo-subtle" />
                      )}
                    </div>
                  </Table.Cell>

                  {/* File Name & Tags */}
                  <Table.Cell>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium text-xs truncate" title={asset.fileName}>
                        {asset.fileName}
                      </span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] text-kumo-subtle font-mono truncate max-w-xs">
                          {asset.path || assetUrl}
                        </span>
                        {asset.tags && asset.tags.length > 0 ? (
                          <div className="flex items-center gap-1">
                            {asset.tags.map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-[9px] px-1 py-0">
                                #{tag}
                              </Badge>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </Table.Cell>

                  {/* Folder */}
                  <Table.Cell>
                    <Badge variant="outline" className="text-xs font-mono">
                      {asset.folder || "/"}
                    </Badge>
                  </Table.Cell>

                  {/* Dimensions / Duration */}
                  <Table.Cell>
                    <span className="text-xs font-mono text-kumo-subtle">
                      {asset.width && asset.height
                        ? `${asset.width} × ${asset.height}`
                        : asset.duration
                          ? `${Math.floor(asset.duration / 60)}:${String(asset.duration % 60).padStart(2, "0")}`
                          : "-"}
                    </span>
                  </Table.Cell>

                  {/* Size */}
                  <Table.Cell className="text-xs text-kumo-subtle">
                    {asset.size.toLocaleString()} bytes
                  </Table.Cell>

                  {/* Status */}
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

                  {/* Actions */}
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
                          icon={Copy}
                          onClick={() => {
                            void navigator.clipboard.writeText(asset.path || assetUrl);
                            toast.add({ title: t("pathCopied") });
                          }}
                        >
                          {t("copyPath")}
                        </DropdownMenu.Item>
                        <DropdownMenu.Item
                          icon={Copy}
                          onClick={() => {
                            void navigator.clipboard.writeText(
                              `\${/asset_base_url}${asset.path || assetUrl}`,
                            );
                            toast.add({ title: t("templateCopied") });
                          }}
                        >
                          {t("copyTemplate")}
                        </DropdownMenu.Item>
                        <DropdownMenu.Item
                          icon={PencilSimple}
                          onClick={() => {
                            setEditingAsset(asset);
                            setEditFolder(asset.folder || "/");
                            setEditTags(asset.tags || []);
                          }}
                        >
                          {t("editAsset")}
                        </DropdownMenu.Item>
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
              );
            })}
          </Table.Body>
        </Table>
      </LayerCard>

      {/* Upload Dialog */}
      <Dialog.Root open={isUploadOpen} onOpenChange={setIsUploadOpen}>
        <Dialog size="lg" className="px-8 py-6">
          <Dialog.Title>上传资源文件</Dialog.Title>
          <Dialog.Description>上传图片、音频、适配等多媒体文件至该应用资源库。</Dialog.Description>
          <div className="grid gap-3 py-4 text-xs">
            <div>
              <label className="text-xs font-medium block mb-1">选择文件</label>
              <input
                type="file"
                className="w-full text-xs file:mr-2 file:py-1 file:px-3 file:rounded-md file:border-0 file:bg-kumo-base file:ring-1 file:ring-kumo-line file:text-xs"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              {file && (
                <div className="mt-2 p-2 bg-kumo-base rounded border border-kumo-line text-[11px] text-kumo-subtle flex items-center justify-between">
                  <span>
                    {file.name} · {file.size.toLocaleString()} bytes
                  </span>
                  {extractedDimensions.width && (
                    <span className="font-mono">
                      {extractedDimensions.width} × {extractedDimensions.height} px
                    </span>
                  )}
                  {extractedDimensions.duration && (
                    <span className="font-mono">时长: {extractedDimensions.duration} 秒</span>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-medium block mb-1">文件夹分类</label>
              <div className="flex gap-2">
                <Input
                  aria-label="文件夹分类"
                  value={uploadFolder}
                  onChange={(e) => setUploadFolder(e.target.value)}
                  placeholder="/images, /icons, /audio"
                  className="flex-1"
                />
                <select
                  value={folders.includes(uploadFolder) ? uploadFolder : ""}
                  onChange={(e) => e.target.value && setUploadFolder(e.target.value)}
                  className="bg-kumo-base border border-kumo-line rounded-lg px-2 text-xs"
                >
                  <option value="">已有文件夹...</option>
                  {folders.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium block mb-1">标签 (Tags)</label>
              <div className="flex gap-2">
                <Input
                  aria-label="标签"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const t = tagInput.trim();
                      if (t && !uploadTags.includes(t)) {
                        setUploadTags([...uploadTags, t]);
                        setTagInput("");
                      }
                    }
                  }}
                  placeholder="输入标签按回车添加..."
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    const t = tagInput.trim();
                    if (t && !uploadTags.includes(t)) {
                      setUploadTags([...uploadTags, t]);
                      setTagInput("");
                    }
                  }}
                >
                  添加
                </Button>
              </div>
              {uploadTags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {uploadTags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 rounded bg-kumo-base border border-kumo-line px-2 py-0.5 text-xs cursor-pointer hover:opacity-80"
                      onClick={() => setUploadTags(uploadTags.filter((t) => t !== tag))}
                    >
                      #{tag} ×
                    </span>
                  ))}
                </div>
              )}
            </div>

            {uploadError && <Text variant="error">{uploadError}</Text>}
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="secondary" onClick={() => setIsUploadOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              variant="primary"
              loading={intent.isPending || complete.isPending}
              disabled={!file}
              onClick={upload}
            >
              {t("upload")}
            </Button>
          </div>
        </Dialog>
      </Dialog.Root>

      {/* Edit Asset Dialog */}
      <Dialog.Root
        open={editingAsset !== null}
        onOpenChange={(open) => !open && setEditingAsset(null)}
      >
        <Dialog size="lg" className="px-8 py-6">
          <Dialog.Title>{t("editAsset")}</Dialog.Title>
          <Dialog.Description>{`编辑资源属性: ${editingAsset?.fileName}`}</Dialog.Description>
          <div className="grid gap-3 py-4 text-xs">
            <div>
              <label className="text-xs font-medium block mb-1">文件夹分类</label>
              <Input
                aria-label="文件夹分类"
                value={editFolder}
                onChange={(e) => setEditFolder(e.target.value)}
                placeholder="/images, /icons, /audio"
              />
            </div>

            <div>
              <label className="text-xs font-medium block mb-1">标签 (Tags)</label>
              <div className="flex gap-2">
                <Input
                  aria-label="标签"
                  value={editTagInput}
                  onChange={(e) => setEditTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const t = editTagInput.trim();
                      if (t && !editTags.includes(t)) {
                        setEditTags([...editTags, t]);
                        setEditTagInput("");
                      }
                    }
                  }}
                  placeholder="输入标签按回车添加..."
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    const t = editTagInput.trim();
                    if (t && !editTags.includes(t)) {
                      setEditTags([...editTags, t]);
                      setEditTagInput("");
                    }
                  }}
                >
                  添加
                </Button>
              </div>
              {editTags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {editTags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 rounded bg-kumo-base border border-kumo-line px-2 py-0.5 text-xs cursor-pointer hover:opacity-80"
                      onClick={() => setEditTags(editTags.filter((t) => t !== tag))}
                    >
                      #{tag} ×
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="secondary" onClick={() => setEditingAsset(null)}>
              {t("cancel")}
            </Button>
            <Button
              variant="primary"
              loading={patch.isPending}
              onClick={() => {
                if (!editingAsset || !context.appId) return;
                patch.mutate({
                  params: { path: { appId: context.appId, assetId: editingAsset.id } },
                  body: {
                    folder: editFolder,
                    tags: editTags,
                  },
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
          icon={<ClipboardTextIcon size={32} />}
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
  const context = useAdminContext();
  const { t } = useI18n();
  const [rawJsonOpen, setRawJsonOpen] = useState(false);
  const componentKey = decodeURIComponent(context.viewPath.slice("/components/".length));
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
          icon={<ClipboardTextIcon size={32} />}
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
  const [publishKey, setPublishKey] = useState("");

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

  if (app.isLoading || manifest.isLoading) return <LoadingState variant="cards" />;
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
        <LayerCard className="grid gap-4 p-5 shadow-sm ring ring-kumo-line">
          <div className="flex items-center justify-between border-b border-kumo-line pb-3">
            <Text variant="heading" as="h2">
              App 基础信息
            </Text>
            {app.data?.status && (
              <Badge variant={app.data.status === "active" ? "green" : "red"}>
                {app.data.status}
              </Badge>
            )}
          </div>
          <div className="grid gap-3.5 text-xs">
            <div className="flex flex-col gap-1">
              <Text variant="secondary">App ID</Text>
              {app.data?.id ? (
                <div className="w-fit max-w-full">
                  <ClipboardText text={app.data.id} size="sm" />
                </div>
              ) : (
                <span className="font-mono text-kumo-subtle">—</span>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <Text variant="secondary">Type</Text>
              <span className="font-medium text-sm text-kumo-default">{app.data?.type ?? "—"}</span>
            </div>
            <div className="flex flex-col gap-1">
              <Text variant="secondary">Manifest Mode</Text>
              <span className="font-medium text-sm text-kumo-default">
                {app.data?.manifest?.mode ?? "push"}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <Text variant="secondary">Active Revision ID</Text>
              {app.data?.manifest?.activeRevisionId ? (
                <div className="w-fit max-w-full">
                  <ClipboardText text={app.data.manifest.activeRevisionId} size="sm" />
                </div>
              ) : (
                <span className="font-mono text-kumo-subtle">—</span>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <Text variant="secondary">Updated At</Text>
              <span className="text-sm text-kumo-default">
                {app.data?.updatedAt ? new Date(app.data.updatedAt).toLocaleString() : "—"}
              </span>
            </div>
          </div>
        </LayerCard>

        <LayerCard className="grid gap-4 p-5 shadow-sm ring ring-kumo-line">
          <div className="flex items-center justify-between border-b border-kumo-line pb-3">
            <Text variant="heading" as="h2">
              App 原始 JSON
            </Text>
            <Button size="sm" variant="secondary" onClick={copyAppJson}>
              <Copy size={14} className="mr-1 inline" />
              {t("copyJson")}
            </Button>
          </div>
          <div className="max-h-72 overflow-auto rounded-lg border border-kumo-line bg-kumo-canvas p-3">
            <Code code={appJson} lang="jsonc" />
          </div>
        </LayerCard>
      </div>

      {/* 2. 组件原始 JSON (Components Raw JSON) */}
      <LayerCard className="mb-6 grid gap-4 p-5 shadow-sm ring ring-kumo-line">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-kumo-line pb-3">
          <div>
            <Text variant="heading" as="h2">
              组件原始 JSON (Component Definitions)
            </Text>
            <Text variant="secondary">当前 Manifest 包含 {componentKeys.length} 个注册组件</Text>
          </div>
          <div className="flex items-center gap-2">
            <Input
              aria-label={t("search")}
              placeholder={t("search")}
              value={componentSearch}
              onChange={(e) => setComponentSearch(e.target.value)}
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
            icon={<ClipboardTextIcon size={32} />}
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
      </LayerCard>

      {/* 3. 完整 Manifest JSON & 手动推送 */}
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <LayerCard className="grid gap-4 p-5 shadow-sm ring ring-kumo-line">
          <div className="flex items-center justify-between border-b border-kumo-line pb-3">
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
        </LayerCard>

        <LayerCard className="grid gap-4 p-5 shadow-sm ring ring-kumo-line">
          <div className="border-b border-kumo-line pb-3">
            <Text variant="heading" as="h2">
              推送 Manifest
            </Text>
          </div>
          <Input
            label="Publish Key"
            type="password"
            value={publishKey}
            onChange={(e) => setPublishKey(e.target.value)}
          />
          <Textarea
            label="Manifest JSON"
            value={json}
            rows={5}
            onChange={(e) => setJson(e.target.value)}
            description="Publish keys are managed on the Publish Keys page."
          />
          <Button
            variant="primary"
            loading={push.isPending}
            disabled={!json || !publishKey}
            onClick={() => {
              try {
                push.mutate({
                  params: {
                    path: { appId: context.appId ?? "" },
                    header: { authorization: `Bearer ${publishKey}` },
                  },
                  body: JSON.parse(json) as Record<string, unknown>,
                });
              } catch {
                toast.add({ title: t("requestFailed") });
              }
            }}
          >
            {t("save")}
          </Button>
        </LayerCard>
      </div>

      {/* 4. 修订版本历史 (Revision History) */}
      <LayerCard className="grid gap-4 p-5 shadow-sm ring ring-kumo-line">
        <div className="border-b border-kumo-line pb-3">
          <Text variant="heading" as="h2">
            修订版本历史 (Revision history)
          </Text>
        </div>
        {manifestRevisions.length === 0 ? (
          <div className="py-3 text-xs text-kumo-subtle">暂无历史修订版本</div>
        ) : (
          manifestRevisions.map((rev) => (
            <div
              key={rev.id}
              className="flex items-center justify-between border-b border-kumo-line py-2 text-xs last:border-b-0"
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
      </LayerCard>
    </>
  );
}

function keyAppId(metadata: unknown): string | null {
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata) && "appId" in metadata) {
    return typeof metadata.appId === "string" ? metadata.appId : null;
  }
  return null;
}

function KeysView() {
  const { t } = useI18n();
  const toast = useKumoToastManager();
  const appsQuery = api.useQuery("get", "/api/v1/apps", {
    params: { query: { limit: "100" } },
  });
  const [keys, setKeys] = useState<Array<Record<string, unknown>>>([]);
  const [name, setName] = useState("");
  const [appId, setAppId] = useState("");
  const [expiresIn, setExpiresIn] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = () => {
    void authClient.apiKey.list({ query: { limit: 100 } }).then((result) => {
      if (result.error) {
        setError(result.error.message ?? "Unable to list publish keys");
        return;
      }
      const records = result.data?.apiKeys;
      setKeys(Array.isArray(records) ? (records as Array<Record<string, unknown>>) : []);
    });
  };

  useEffect(() => {
    reload();
  }, []);

  const create = () => {
    const selectedAppId = appId || appsQuery.data?.items[0]?.id || "";
    if (!name.trim() || !selectedAppId) {
      setError("A key name and target App are required");
      return;
    }
    setError(null);
    const parsedExpiresIn = Number(expiresIn);
    void authClient.apiKey
      .create({
        name: name.trim(),
        prefix: "osc_publish_",
        metadata: { appId: selectedAppId, scope: "manifest:write" },
        permissions: { manifest: ["write"] },
        ...(Number.isInteger(parsedExpiresIn) && parsedExpiresIn > 0
          ? { expiresIn: parsedExpiresIn * 86_400 }
          : {}),
      })
      .then((result) => {
        if (result.error || !result.data) {
          setError(result.error?.message ?? "The publish key could not be created");
          return;
        }
        setNewKey(result.data.key);
        setName("");
        setExpiresIn("");
        toast.add({ title: t("keyCreated"), description: t("keyCreatedDescription") });
        reload();
      });
  };

  const revoke = (keyId: string) => {
    void authClient.apiKey.delete({ keyId }).then((result) => {
      if (result.error) {
        setError(result.error.message ?? "Unable to revoke publish key");
        return;
      }
      reload();
    });
  };

  return (
    <div className="grid gap-6">
      <div>
        <Text variant="heading" as="h1">
          {t("keys")}
        </Text>
        <Text variant="secondary">{t("keysDescription")}</Text>
      </div>
      {error ? (
        <div role="alert" className="rounded-lg border border-kumo-danger p-3 text-sm">
          {error}
        </div>
      ) : null}
      {newKey ? (
        <Surface className="grid gap-3 border border-kumo-success p-4">
          <Text variant="heading" as="h2">
            {t("keyCreated")}
          </Text>
          <Text variant="secondary">{t("keyCreatedDescription")}</Text>
          <code className="break-all rounded bg-kumo-canvas p-3">{newKey}</code>
          <Button variant="secondary" onClick={() => setNewKey(null)}>
            {t("cancel")}
          </Button>
        </Surface>
      ) : null}
      <Surface className="grid gap-4 p-4">
        <Text variant="heading" as="h2">
          {t("createKey")}
        </Text>
        <Input
          aria-label={t("keyName")}
          placeholder={t("keyName")}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <Select
          aria-label={t("targetApp")}
          placeholder={t("targetApp")}
          value={appId || null}
          items={Object.fromEntries((appsQuery.data?.items ?? []).map((app) => [app.id, app.name]))}
          onValueChange={(value) => setAppId(typeof value === "string" ? value : "")}
        />
        <Input
          aria-label={t("expiresAt")}
          placeholder={`${t("expiresAt")} (${t("neverExpires")})`}
          value={expiresIn}
          onChange={(event) => setExpiresIn(event.target.value)}
          type="number"
          min={1}
        />
        <Button variant="primary" onClick={create}>
          {t("createKey")}
        </Button>
      </Surface>
      <Surface className="overflow-auto p-4">
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.Head>{t("keyName")}</Table.Head>
              <Table.Head>{t("targetApp")}</Table.Head>
              <Table.Head>{t("publishManifest")}</Table.Head>
              <Table.Head>{t("status")}</Table.Head>
              <Table.Head>{t("actions")}</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {keys.map((key) => {
              const id = typeof key.id === "string" ? key.id : "";
              const target = keyAppId(key.metadata);
              const label =
                typeof key.name === "string"
                  ? key.name
                  : typeof key.start === "string"
                    ? key.start
                    : "—";
              return (
                <Table.Row key={id}>
                  <Table.Cell>{label}</Table.Cell>
                  <Table.Cell className="font-mono text-xs">{target ?? "—"}</Table.Cell>
                  <Table.Cell>manifest:write</Table.Cell>
                  <Table.Cell>{key.enabled === false ? t("disabled") : t("active")}</Table.Cell>
                  <Table.Cell>
                    <Button variant="secondary" onClick={() => revoke(id)}>
                      {t("revokeKey")}
                    </Button>
                  </Table.Cell>
                </Table.Row>
              );
            })}
          </Table.Body>
        </Table>
      </Surface>
    </div>
  );
}

function SettingsView() {
  const context = useAdminContext();
  const { theme, setTheme } = useTheme();
  const { t } = useI18n();
  const toast = useKumoToastManager();
  const queryClient = useQueryClient();
  const appsQuery = api.useQuery("get", "/api/v1/apps", { params: { query: { limit: "100" } } });
  const hasAppSelected = Boolean(context.appId);
  const selectedAppExists = Boolean(
    context.appId && appsQuery.data?.items.some((item) => item.id === context.appId),
  );
  const query = api.useQuery(
    "get",
    "/api/v1/apps/{appId}",
    {
      params: { path: { appId: context.appId ?? "" } },
    },
    { enabled: hasAppSelected },
  );
  const update = api.useMutation("patch", "/api/v1/apps/{appId}", {
    onSuccess: () => {
      toast.add({ title: t("updated") });
      void queryClient.invalidateQueries();
    },
  });
  const storageQuery = api.useQuery(
    "get",
    "/api/v1/apps/{appId}/storage",
    {
      params: { path: { appId: context.appId ?? "" } },
    },
    { enabled: hasAppSelected },
  );
  const updateStorage = api.useMutation("put", "/api/v1/apps/{appId}/storage", {
    onSuccess: () => {
      toast.add({ title: t("storageSaved") });
      void queryClient.invalidateQueries();
    },
  });
  const deleteStorageMutation = api.useMutation("delete", "/api/v1/apps/{appId}/storage", {
    onSuccess: () => {
      toast.add({ title: t("storageDeleted") });
      void queryClient.invalidateQueries();
    },
  });
  const testStorageMutation = api.useMutation("post", "/api/v1/apps/{appId}/storage/test");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const [pageDriver, setPageDriver] = useState<"database" | "s3" | "memory">("database");
  const [s3Enabled, setS3Enabled] = useState(false);
  const [storageBucket, setStorageBucket] = useState("");
  const [storageEndpoint, setStorageEndpoint] = useState("");
  const [storageRegion, setStorageRegion] = useState("auto");
  const [storageAccessKeyId, setStorageAccessKeyId] = useState("");
  const [storageSecretAccessKey, setStorageSecretAccessKey] = useState("");
  const [storageForcePathStyle, setStorageForcePathStyle] = useState(true);
  const [storagePublicBaseUrl, setStoragePublicBaseUrl] = useState("");
  const [storageTestResult, setStorageTestResult] = useState<{
    status: "up" | "down" | "not_configured" | "deprecated";
    detail?: string;
  } | null>(null);

  const app = query.data;
  const storageConfig = storageQuery.data?.config;
  useEffect(() => {
    if (app) {
      setName(app.name);
      setDescription(app.description);
    }
  }, [app]);
  useEffect(() => {
    if (storageConfig) {
      setPageDriver(storageConfig.pageDriver ?? storageConfig.driver ?? "database");
      setS3Enabled(Boolean(storageConfig.s3Enabled || storageConfig.driver === "s3"));
      setStorageBucket(storageConfig.bucket ?? "");
      setStorageEndpoint(storageConfig.endpoint ?? "");
      setStorageRegion(storageConfig.region ?? "auto");
      setStorageAccessKeyId(storageConfig.accessKeyId ?? "");
      setStorageForcePathStyle(storageConfig.forcePathStyle ?? true);
      setStoragePublicBaseUrl(storageConfig.publicBaseUrl ?? "");
      setStorageSecretAccessKey("");
    } else {
      setPageDriver("database");
      setS3Enabled(false);
      setStorageBucket("");
      setStorageEndpoint("");
      setStorageRegion("auto");
      setStorageAccessKeyId("");
      setStorageSecretAccessKey("");
      setStorageForcePathStyle(true);
      setStoragePublicBaseUrl("");
    }
  }, [storageConfig]);

  function saveStorage() {
    updateStorage.mutate({
      params: { path: { appId: context.appId ?? "" } },
      body: {
        driver: pageDriver,
        pageDriver,
        s3Enabled,
        bucket: storageBucket,
        endpoint: storageEndpoint || undefined,
        region: storageRegion || "auto",
        accessKeyId: storageAccessKeyId,
        secretAccessKey: storageSecretAccessKey || undefined,
        forcePathStyle: storageForcePathStyle,
        publicBaseUrl: storagePublicBaseUrl || undefined,
      },
    });
  }

  function runStorageTest() {
    setStorageTestResult(null);
    testStorageMutation.mutate(
      {
        params: { path: { appId: context.appId ?? "" } },
        body: {
          driver: pageDriver,
          pageDriver,
          s3Enabled,
          bucket: storageBucket,
          endpoint: storageEndpoint || undefined,
          region: storageRegion || "auto",
          accessKeyId: storageAccessKeyId,
          secretAccessKey: storageSecretAccessKey || undefined,
          forcePathStyle: storageForcePathStyle,
          publicBaseUrl: storagePublicBaseUrl || undefined,
        },
      },
      {
        onSuccess: (data) => setStorageTestResult(data ?? null),
        onError: (error) =>
          setStorageTestResult({
            status: "down",
            detail:
              error instanceof Error
                ? error.message
                : typeof error === "string"
                  ? error
                  : "Unknown error",
          }),
      },
    );
  }

  function deleteStorage() {
    if (window.confirm(t("deleteStorageConfirm"))) {
      deleteStorageMutation.mutate({
        params: { path: { appId: context.appId ?? "" } },
      });
    }
  }
  return (
    <>
      <PageHeader title={t("settings")} description={t("settingsDescription")} />
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
          <Select
            label={t("theme")}
            value={theme ?? "system"}
            items={{
              system: t("themeSystem"),
              light: t("themeLight"),
              dark: t("themeDark"),
            }}
            onValueChange={(value) => {
              if (value === "system" || value === "light" || value === "dark") setTheme(value);
            }}
          />
        </LayerCard.Primary>
      </LayerCard>
      {!hasAppSelected || (appsQuery.data && !selectedAppExists) ? (
        <LayerCard className="max-w-2xl">
          <LayerCard.Secondary>{t("appSettings")}</LayerCard.Secondary>
          <LayerCard.Primary className="py-6">
            <Empty
              icon={<ClipboardTextIcon size={32} />}
              title={t("chooseApp")}
              description={t("appSettingsChooseAppDescription")}
              contents={
                <Button onClick={() => context.router.push(context.href("/apps"))}>
                  {t("selectApp")}
                </Button>
              }
            />
          </LayerCard.Primary>
        </LayerCard>
      ) : (
        <>
          {query.error ? <ErrorState error={query.error} /> : null}
          <LayerCard className="max-w-2xl">
            <LayerCard.Secondary>{t("appSettings")}</LayerCard.Secondary>
            <LayerCard.Primary className="grid gap-4">
              <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
              <Textarea
                label="Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
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
                    body: { name, description },
                  })
                }
              >
                {t("save")}
              </Button>
            </LayerCard.Primary>
          </LayerCard>
          <LayerCard className="mt-4 max-w-2xl">
            <LayerCard.Secondary>{t("storageSettings")}</LayerCard.Secondary>
            <LayerCard.Primary className="grid gap-4">
              <Text variant="secondary">{t("storageSettingsDescription")}</Text>
              {storageQuery.error ? <ErrorState error={storageQuery.error} /> : null}
              {/* Page Release Storage Target */}
              <div className="grid gap-2 border-b border-kumo-line pb-4">
                <label className="text-xs font-semibold text-kumo-foreground block">
                  {t("pageStorageTarget")}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Database Option Card */}
                  <button
                    type="button"
                    onClick={() => setPageDriver("database")}
                    className={cn(
                      "flex flex-col gap-1 p-3 rounded-lg border text-left transition-all cursor-pointer",
                      pageDriver === "database"
                        ? "border-kumo-primary bg-kumo-base ring-2 ring-kumo-primary/20"
                        : "border-kumo-line bg-kumo-base/50 hover:border-kumo-line-strong",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-medium text-xs text-kumo-foreground">
                        <Database size={15} className="text-kumo-subtle" />
                        <span>{t("pageStorageTargetDatabase")}</span>
                      </div>
                      {pageDriver === "database" && (
                        <Check size={14} weight="bold" className="text-kumo-primary" />
                      )}
                    </div>
                    <Text variant="secondary">{t("storageModeDatabaseDescription")}</Text>
                  </button>

                  {/* S3 Option Card - Directly Disabled when S3 is not enabled */}
                  <button
                    type="button"
                    disabled={!s3Enabled}
                    onClick={() => s3Enabled && setPageDriver("s3")}
                    className={cn(
                      "flex flex-col gap-1 p-3 rounded-lg border text-left transition-all",
                      !s3Enabled
                        ? "opacity-50 cursor-not-allowed bg-kumo-base/20 border-kumo-line"
                        : pageDriver === "s3"
                          ? "border-kumo-primary bg-kumo-base ring-2 ring-kumo-primary/20 cursor-pointer"
                          : "border-kumo-line bg-kumo-base/50 hover:border-kumo-line-strong cursor-pointer",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-medium text-xs text-kumo-foreground">
                        <Cloud size={15} className="text-kumo-subtle" />
                        <span>{t("pageStorageTargetS3")}</span>
                      </div>
                      {pageDriver === "s3" && (
                        <Check size={14} weight="bold" className="text-kumo-primary" />
                      )}
                    </div>
                    <Text variant="secondary">
                      {s3Enabled ? t("storageModeS3Description") : t("s3NotConfiguredHint")}
                    </Text>
                  </button>
                </div>
              </div>
              {/* S3 Object Storage Configuration Card */}
              <div className="grid gap-3 pt-1">
                <div className="flex items-center justify-between">
                  <div>
                    <Text bold>{t("s3StorageConfig")}</Text>
                    <Text variant="secondary">{t("s3AssetNotice")}</Text>
                  </div>
                  <Switch
                    checked={s3Enabled}
                    onCheckedChange={(checked) => {
                      setS3Enabled(checked);
                      if (!checked && pageDriver === "s3") {
                        setPageDriver("database");
                      }
                    }}
                  />
                </div>
                {s3Enabled ? (
                  <div className="grid gap-3 pt-2">
                    <Input
                      label={t("storageBucket")}
                      value={storageBucket}
                      onChange={(e) => setStorageBucket(e.target.value)}
                      placeholder={t("storageBucketPlaceholder")}
                    />
                    <Input
                      label={t("storageEndpoint")}
                      value={storageEndpoint}
                      onChange={(e) => setStorageEndpoint(e.target.value)}
                      placeholder={t("storageEndpointPlaceholder")}
                    />
                    <Input
                      label={t("storageRegion")}
                      value={storageRegion}
                      onChange={(e) => setStorageRegion(e.target.value)}
                      placeholder="auto"
                    />
                    <Input
                      label={t("storageAccessKeyId")}
                      value={storageAccessKeyId}
                      onChange={(e) => setStorageAccessKeyId(e.target.value)}
                    />
                    <div>
                      <Input
                        label={t("storageSecretAccessKey")}
                        type="password"
                        value={storageSecretAccessKey}
                        onChange={(e) => setStorageSecretAccessKey(e.target.value)}
                        placeholder={
                          storageConfig?.hasSecretAccessKey
                            ? t("storageSecretAccessKeySet")
                            : t("storageSecretAccessKeyPlaceholder")
                        }
                      />
                      <Text variant="secondary">{t("storageSecretAccessKeyHint")}</Text>
                    </div>
                    <Switch
                      checked={storageForcePathStyle}
                      label={t("storageForcePathStyle")}
                      onCheckedChange={(checked) => setStorageForcePathStyle(checked)}
                    />
                    <Input
                      label={t("storagePublicBaseUrl")}
                      value={storagePublicBaseUrl}
                      onChange={(e) => setStoragePublicBaseUrl(e.target.value)}
                      placeholder={t("storagePublicBaseUrlPlaceholder")}
                    />
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="primary" loading={updateStorage.isPending} onClick={saveStorage}>
                  {t("save")}
                </Button>
                {s3Enabled ? (
                  <Button loading={testStorageMutation.isPending} onClick={runStorageTest}>
                    {t("storageTest")}
                  </Button>
                ) : null}
                {storageConfig ? (
                  <Button
                    variant="destructive"
                    loading={deleteStorageMutation.isPending}
                    onClick={deleteStorage}
                  >
                    {t("delete")}
                  </Button>
                ) : null}
              </div>
              {updateStorage.error ? <ErrorState error={updateStorage.error} /> : null}
              {testStorageMutation.error ? <ErrorState error={testStorageMutation.error} /> : null}
              {storageTestResult ? (
                <div className="mt-2">
                  {storageTestResult.status === "up" ? (
                    <Badge variant="green">{t("storageConnectionSuccess")}</Badge>
                  ) : (
                    <div className="flex flex-col gap-1">
                      <Badge variant="red">{t("storageConnectionFailed")}</Badge>
                      {storageTestResult.detail ? (
                        <Text variant="secondary">{storageTestResult.detail}</Text>
                      ) : null}
                    </div>
                  )}
                </div>
              ) : null}
            </LayerCard.Primary>
          </LayerCard>
        </>
      )}
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

  if (query.isLoading) return <LoadingState variant="cards" />;
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
  const context = useAdminContext();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const toast = useKumoToastManager();
  const appId = context.appId ?? "";

  const rawId = decodeURIComponent(
    context.viewPath.startsWith("/prompts/")
      ? context.viewPath.slice("/prompts/".length)
      : context.viewPath.slice("/prompt/".length),
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

  if (!isNew && promptQuery.isLoading) return <LoadingState variant="detail" />;
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

function OrganizationView() {
  const context = useAdminContext();
  const { t } = useI18n();
  const toast = useKumoToastManager();
  const queryClient = useQueryClient();
  const { data: activeOrg } = useActiveOrganization();
  const { data: activeMember } = useActiveMember();

  const [activeTab, setActiveTab] = useState<"members" | "invitations" | "roles" | "settings">(
    "members",
  );

  const [userInvitations, setUserInvitations] = useState<
    Array<{
      id: string;
      organizationName?: string;
      organizationId: string;
      role: string;
      status: string;
    }>
  >([]);
  const [members, setMembers] = useState<
    Array<{
      id: string;
      userId: string;
      name: string;
      email: string;
      role: string;
      createdAt: number;
    }>
  >([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  const [invitations, setInvitations] = useState<
    Array<{ id: string; email: string; role: string; status: string; expiresAt?: string }>
  >([]);
  const [loadingInvitations, setLoadingInvitations] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviting, setInviting] = useState(false);

  const [customRoles, setCustomRoles] = useState<
    Array<{ id?: string; role: string; permission: Record<string, string[]> }>
  >([]);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [createRoleDialog, setCreateRoleDialog] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRolePerms, setNewRolePerms] = useState<Record<string, string[]>>({});
  const [savingRole, setSavingRole] = useState(false);

  const [orgName, setOrgName] = useState(activeOrg?.name ?? "");
  const [savingOrgName, setSavingOrgName] = useState(false);
  const [createOrgDialog, setCreateOrgDialog] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgSlug, setNewOrgSlug] = useState("");
  const [creatingOrg, setCreatingOrg] = useState(false);
  const [deletingOrg, setDeletingOrg] = useState(false);

  const appsQuery = api.useQuery("get", "/api/v1/apps", { params: { query: { limit: "100" } } });
  const hasApps = (appsQuery.data?.items?.length ?? 0) > 0;

  useEffect(() => {
    if (activeOrg?.name) setOrgName(activeOrg.name);
  }, [activeOrg?.name]);

  const loadUserInvitations = useCallback(async () => {
    try {
      const res = await authClient.organization.listUserInvitations();
      if (res?.data) {
        setUserInvitations(
          res.data as unknown as Array<{
            id: string;
            organizationName?: string;
            organizationId: string;
            role: string;
            status: string;
          }>,
        );
      }
    } catch {
      // ignore
    }
  }, []);

  const loadMembers = useCallback(async () => {
    setLoadingMembers(true);
    try {
      const res = await fetch("/api/v1/organization/members");
      if (res.ok) {
        const data = (await res.json()) as { items?: typeof members };
        setMembers(data.items ?? []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingMembers(false);
    }
  }, []);

  const loadInvitations = useCallback(async () => {
    setLoadingInvitations(true);
    try {
      const res = await authClient.organization.listInvitations();
      if (res?.data) {
        setInvitations(
          res.data as unknown as Array<{
            id: string;
            email: string;
            role: string;
            status: string;
            expiresAt?: string;
          }>,
        );
      }
    } catch {
      // ignore
    } finally {
      setLoadingInvitations(false);
    }
  }, []);

  const loadRoles = useCallback(async () => {
    setLoadingRoles(true);
    try {
      const res = await authClient.organization.listRoles();
      if (res?.data) {
        setCustomRoles(
          (res.data as unknown as Array<{ id?: string; role: string; permission: unknown }>).map(
            (r) => ({
              ...r,
              permission:
                typeof r.permission === "string"
                  ? (JSON.parse(r.permission) as Record<string, string[]>)
                  : (r.permission as Record<string, string[]>),
            }),
          ),
        );
      }
    } catch {
      // ignore
    } finally {
      setLoadingRoles(false);
    }
  }, []);

  useEffect(() => {
    void loadUserInvitations();
  }, [loadUserInvitations]);

  useEffect(() => {
    if (activeOrg?.id) {
      void loadMembers();
      void loadInvitations();
      void loadRoles();
    }
  }, [activeOrg?.id, loadMembers, loadInvitations, loadRoles]);

  const memberRole = activeMember?.role;
  let activeStatements: Record<string, readonly string[]> = defaultRoleStatements.owner;
  if (memberRole && memberRole in defaultRoleStatements) {
    activeStatements = defaultRoleStatements[memberRole];
  } else if (memberRole) {
    const custom = customRoles.find((r) => r.role === memberRole);
    activeStatements = custom?.permission ?? defaultRoleStatements.admin;
  }

  const canReadMembers = hasStatement(activeStatements, "member", "read");
  const canUpdateMembers = hasStatement(activeStatements, "member", "update");
  const canDeleteMembers = hasStatement(activeStatements, "member", "delete");
  const canCreateInvite = hasStatement(activeStatements, "invitation", "create");
  const canCancelInvite = hasStatement(activeStatements, "invitation", "cancel");
  const canManageRoles =
    hasStatement(activeStatements, "ac", "create") ||
    hasStatement(activeStatements, "ac", "update");
  const canUpdateOrg = hasStatement(activeStatements, "organization", "update");
  const canDeleteOrg = hasStatement(activeStatements, "organization", "delete");

  const allAvailableRoles = useMemo(() => {
    const defaultRoleKeys = Object.keys(defaultRoleStatements);
    const customRoleKeys = customRoles.map((r) => r.role);
    return Array.from(new Set([...defaultRoleKeys, ...customRoleKeys]));
  }, [customRoles]);

  async function handleAcceptInvite(invitationId: string) {
    try {
      await authClient.organization.acceptInvitation({ invitationId });
      toast.add({ title: t("invitationAccepted"), type: "success" });
      await loadUserInvitations();
      void queryClient.invalidateQueries();
    } catch (err) {
      toast.add({ title: err instanceof Error ? err.message : t("requestFailed"), type: "error" });
    }
  }

  async function handleRejectInvite(invitationId: string) {
    try {
      await authClient.organization.rejectInvitation({ invitationId });
      await loadUserInvitations();
    } catch (err) {
      toast.add({ title: err instanceof Error ? err.message : t("requestFailed"), type: "error" });
    }
  }

  async function handleInviteMember(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      const res = await authClient.organization.inviteMember({
        email: inviteEmail.trim(),
        role: inviteRole as "member",
      });
      if (res?.error) {
        toast.add({ title: res.error.message || t("requestFailed"), type: "error" });
      } else {
        toast.add({ title: t("invitationSent"), type: "success" });
        setInviteEmail("");
        await loadInvitations();
      }
    } catch (err) {
      toast.add({ title: err instanceof Error ? err.message : t("requestFailed"), type: "error" });
    } finally {
      setInviting(false);
    }
  }

  async function handleUpdateMemberRole(memberId: string, role: string) {
    try {
      const res = await authClient.organization.updateMemberRole({
        memberId,
        role: role as "member",
      });
      if (res?.error) {
        toast.add({ title: res.error.message || t("requestFailed"), type: "error" });
      } else {
        toast.add({ title: t("memberRoleUpdated"), type: "success" });
        await loadMembers();
      }
    } catch (err) {
      toast.add({ title: err instanceof Error ? err.message : t("requestFailed"), type: "error" });
    }
  }

  async function handleRemoveMember(memberId: string) {
    try {
      const res = await authClient.organization.removeMember({
        memberIdOrEmail: memberId,
      });
      if (res?.error) {
        toast.add({ title: res.error.message || t("requestFailed"), type: "error" });
      } else {
        toast.add({ title: t("memberRemoved"), type: "success" });
        await loadMembers();
      }
    } catch (err) {
      toast.add({ title: err instanceof Error ? err.message : t("requestFailed"), type: "error" });
    }
  }

  async function handleCancelInvitation(invitationId: string) {
    try {
      const res = await authClient.organization.cancelInvitation({ invitationId });
      if (res?.error) {
        toast.add({ title: res.error.message || t("requestFailed"), type: "error" });
      } else {
        toast.add({ title: t("invitationCancelled"), type: "success" });
        await loadInvitations();
      }
    } catch (err) {
      toast.add({ title: err instanceof Error ? err.message : t("requestFailed"), type: "error" });
    }
  }

  async function handleSaveOrgName(e: React.FormEvent) {
    e.preventDefault();
    if (!activeOrg?.id || !orgName.trim()) return;
    setSavingOrgName(true);
    try {
      const res = await authClient.organization.update({
        organizationId: activeOrg.id,
        data: { name: orgName.trim() },
      });
      if (res?.error) {
        toast.add({ title: res.error.message || t("requestFailed"), type: "error" });
      } else {
        toast.add({ title: t("orgUpdated"), type: "success" });
        void queryClient.invalidateQueries();
      }
    } catch (err) {
      toast.add({ title: err instanceof Error ? err.message : t("requestFailed"), type: "error" });
    } finally {
      setSavingOrgName(false);
    }
  }

  async function handleCreateOrg(e: React.FormEvent) {
    e.preventDefault();
    if (!newOrgName.trim() || !newOrgSlug.trim()) return;
    setCreatingOrg(true);
    try {
      const res = await authClient.organization.create({
        name: newOrgName.trim(),
        slug: newOrgSlug.trim(),
      });
      if (res?.error) {
        toast.add({ title: res.error.message || t("requestFailed"), type: "error" });
      } else {
        toast.add({ title: t("orgCreated"), type: "success" });
        setCreateOrgDialog(false);
        const createdSlug = newOrgSlug.trim();
        setNewOrgName("");
        setNewOrgSlug("");
        void queryClient.invalidateQueries();
        context.router.push(
          buildHref("/apps", { mode: context.mode, lang: context.language, orgSlug: createdSlug }),
        );
      }
    } catch (err) {
      toast.add({ title: err instanceof Error ? err.message : t("requestFailed"), type: "error" });
    } finally {
      setCreatingOrg(false);
    }
  }

  async function handleDeleteOrg() {
    if (!activeOrg?.id) return;
    setDeletingOrg(true);
    try {
      const res = await authClient.organization.delete({
        organizationId: activeOrg.id,
      });
      if (res?.error) {
        toast.add({ title: res.error.message || t("requestFailed"), type: "error" });
      } else {
        toast.add({ title: t("orgDeleted"), type: "success" });
        void queryClient.invalidateQueries();
        window.location.reload();
      }
    } catch (err) {
      toast.add({ title: err instanceof Error ? err.message : t("requestFailed"), type: "error" });
    } finally {
      setDeletingOrg(false);
    }
  }

  async function handleCreateCustomRole(e: React.FormEvent) {
    e.preventDefault();
    if (!newRoleName.trim()) return;
    setSavingRole(true);
    try {
      const res = await authClient.organization.createRole({
        role: newRoleName.trim(),
        permission: newRolePerms as unknown as Record<string, string[]>,
      });
      if (res?.error) {
        toast.add({ title: res.error.message || t("requestFailed"), type: "error" });
      } else {
        toast.add({ title: t("roleCreated"), type: "success" });
        setCreateRoleDialog(false);
        setNewRoleName("");
        setNewRolePerms({});
        await loadRoles();
      }
    } catch (err) {
      toast.add({ title: err instanceof Error ? err.message : t("requestFailed"), type: "error" });
    } finally {
      setSavingRole(false);
    }
  }

  async function handleDeleteCustomRole(role: string) {
    try {
      const res = await authClient.organization.deleteRole({ roleName: role });
      if (res?.error) {
        toast.add({ title: res.error.message || t("requestFailed"), type: "error" });
      } else {
        toast.add({ title: t("roleDeleted"), type: "success" });
        await loadRoles();
      }
    } catch (err) {
      toast.add({ title: err instanceof Error ? err.message : t("requestFailed"), type: "error" });
    }
  }

  async function handleToggleCustomRolePermission(
    roleObj: { role: string; permission: Record<string, string[]> },
    res: string,
    act: string,
  ) {
    const currentList = roleObj.permission[res] ?? [];
    const nextList = currentList.includes(act)
      ? currentList.filter((a) => a !== act)
      : [...currentList, act];
    const nextPermission = { ...roleObj.permission, [res]: nextList };
    try {
      const updateRes = await authClient.organization.updateRole({
        roleName: roleObj.role,
        data: { permission: nextPermission as unknown as Record<string, string[]> },
      });
      if (updateRes?.error) {
        toast.add({ title: updateRes.error.message || t("requestFailed"), type: "error" });
      } else {
        toast.add({ title: t("permissionsSaved"), type: "success" });
        await loadRoles();
      }
    } catch (err) {
      toast.add({ title: err instanceof Error ? err.message : t("requestFailed"), type: "error" });
    }
  }

  return (
    <>
      <PageHeader title={t("organization")} description={t("organizationDescription")}>
        <Button onClick={() => setCreateOrgDialog(true)}>
          <Plus size={16} />
          {t("createOrganization")}
        </Button>
      </PageHeader>

      {/* User pending invitations banner */}
      {userInvitations.length > 0 && (
        <div className="mb-6 rounded-lg border border-kumo-line bg-kumo-base p-4">
          <div className="font-semibold text-sm mb-2">{t("userInvitations")}</div>
          <div className="grid gap-2">
            {userInvitations.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between gap-4 rounded-md border border-kumo-line bg-kumo-canvas p-3 text-sm"
              >
                <div>
                  <span className="font-medium">{inv.organizationName || inv.organizationId}</span>
                  <span className="ml-2 text-kumo-subtle">({inv.role})</span>
                </div>
                <div className="flex gap-2">
                  <Button size="xs" variant="primary" onClick={() => handleAcceptInvite(inv.id)}>
                    {t("acceptInvitation")}
                  </Button>
                  <Button size="xs" variant="secondary" onClick={() => handleRejectInvite(inv.id)}>
                    {t("cancelInvitation")}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 flex gap-2 border-b border-kumo-line pb-3">
        <Button
          size="sm"
          variant={activeTab === "members" ? "primary" : "secondary"}
          onClick={() => setActiveTab("members")}
        >
          {t("members")}
        </Button>
        <Button
          size="sm"
          variant={activeTab === "invitations" ? "primary" : "secondary"}
          onClick={() => setActiveTab("invitations")}
        >
          {t("invitations")}
        </Button>
        <Button
          size="sm"
          variant={activeTab === "roles" ? "primary" : "secondary"}
          onClick={() => setActiveTab("roles")}
        >
          {t("roles")}
        </Button>
        <Button
          size="sm"
          variant={activeTab === "settings" ? "primary" : "secondary"}
          onClick={() => setActiveTab("settings")}
        >
          {t("settings")}
        </Button>
      </div>

      {/* Tab 1: Members */}
      {activeTab === "members" && (
        <div className="grid gap-4">
          {!canReadMembers ? (
            <Empty
              title="Access restricted"
              description="You do not have permission to view members."
            />
          ) : loadingMembers ? (
            <LoadingState variant="table" hasHeader={false} rows={3} />
          ) : members.length === 0 ? (
            <Empty title={t("noMembers")} />
          ) : (
            <LayerCard className="w-full overflow-x-auto p-0">
              <Table layout="fixed">
                <colgroup>
                  <col />
                  <col />
                  <col style={{ width: "160px" }} />
                  <col style={{ width: "180px" }} />
                  {canDeleteMembers && <col style={{ width: "100px" }} />}
                </colgroup>
                <Table.Header>
                  <Table.Row>
                    <Table.Head>{t("name")}</Table.Head>
                    <Table.Head>{t("email")}</Table.Head>
                    <Table.Head>{t("role")}</Table.Head>
                    <Table.Head>{t("joinedAt")}</Table.Head>
                    {canDeleteMembers && (
                      <Table.Head sticky="right">
                        <span className="sr-only">{t("actions")}</span>
                      </Table.Head>
                    )}
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {members.map((m) => (
                    <Table.Row key={m.id}>
                      <Table.Cell className="font-medium">{m.name || "—"}</Table.Cell>
                      <Table.Cell className="text-kumo-subtle">{m.email}</Table.Cell>
                      <Table.Cell>
                        {canUpdateMembers ? (
                          <Select
                            value={m.role}
                            items={Object.fromEntries(allAvailableRoles.map((r) => [r, r]))}
                            onValueChange={(val) => {
                              if (typeof val === "string" && val !== m.role) {
                                void handleUpdateMemberRole(m.id, val);
                              }
                            }}
                          />
                        ) : (
                          <Badge variant="neutral">{m.role}</Badge>
                        )}
                      </Table.Cell>
                      <Table.Cell className="text-kumo-subtle">
                        {m.createdAt ? new Date(m.createdAt).toLocaleDateString() : "—"}
                      </Table.Cell>
                      {canDeleteMembers && (
                        <Table.Cell sticky="right" className="text-right">
                          <Button
                            size="xs"
                            variant="destructive"
                            onClick={() => handleRemoveMember(m.id)}
                          >
                            <Trash size={14} />
                          </Button>
                        </Table.Cell>
                      )}
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            </LayerCard>
          )}
        </div>
      )}

      {/* Tab 2: Invitations */}
      {activeTab === "invitations" && (
        <div className="grid gap-6">
          {canCreateInvite && (
            <LayerCard className="max-w-2xl">
              <LayerCard.Secondary>{t("inviteMember")}</LayerCard.Secondary>
              <LayerCard.Primary>
                <form onSubmit={handleInviteMember} className="grid gap-4">
                  <Input
                    label={t("inviteEmail")}
                    type="email"
                    placeholder="colleague@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                  />
                  <div>
                    <label className="mb-1 block text-sm font-medium text-kumo-secondary">
                      {t("inviteRole")}
                    </label>
                    <Select
                      value={inviteRole}
                      items={Object.fromEntries(allAvailableRoles.map((r) => [r, r]))}
                      onValueChange={(val) => {
                        if (typeof val === "string") setInviteRole(val);
                      }}
                    />
                  </div>
                  <div>
                    <Button
                      type="submit"
                      variant="primary"
                      loading={inviting}
                      disabled={!inviteEmail}
                    >
                      {t("inviteMember")}
                    </Button>
                  </div>
                </form>
              </LayerCard.Primary>
            </LayerCard>
          )}

          <div>
            <div className="font-semibold text-sm mb-3">{t("pendingInvitations")}</div>
            {loadingInvitations ? (
              <LoadingState variant="table" hasHeader={false} rows={3} />
            ) : invitations.length === 0 ? (
              <Empty title={t("noPendingInvitations")} />
            ) : (
              <LayerCard className="w-full overflow-x-auto p-0">
                <Table layout="fixed">
                  <colgroup>
                    <col />
                    <col style={{ width: "160px" }} />
                    <col style={{ width: "120px" }} />
                    {canCancelInvite && <col style={{ width: "100px" }} />}
                  </colgroup>
                  <Table.Header>
                    <Table.Row>
                      <Table.Head>{t("email")}</Table.Head>
                      <Table.Head>{t("role")}</Table.Head>
                      <Table.Head>{t("status")}</Table.Head>
                      {canCancelInvite && (
                        <Table.Head sticky="right">
                          <span className="sr-only">{t("actions")}</span>
                        </Table.Head>
                      )}
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {invitations.map((inv) => (
                      <Table.Row key={inv.id}>
                        <Table.Cell className="font-medium">{inv.email}</Table.Cell>
                        <Table.Cell>
                          <Badge variant="neutral">{inv.role}</Badge>
                        </Table.Cell>
                        <Table.Cell>
                          <Badge variant={inv.status === "pending" ? "outline" : "green"}>
                            {inv.status}
                          </Badge>
                        </Table.Cell>
                        {canCancelInvite && (
                          <Table.Cell sticky="right" className="text-right">
                            <Button
                              size="xs"
                              variant="secondary"
                              onClick={() => handleCancelInvitation(inv.id)}
                            >
                              {t("cancelInvitation")}
                            </Button>
                          </Table.Cell>
                        )}
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table>
              </LayerCard>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Roles & Permissions */}
      {activeTab === "roles" && (
        <div className="grid gap-8">
          {/* Default Roles Permission Matrix */}
          <div>
            <div className="font-semibold text-sm mb-2">
              {t("defaultRoles")} ({t("permissionMatrix")})
            </div>
            <p className="text-sm text-kumo-subtle mb-4">
              Built-in roles (owner, admin, member) provide standard permission presets and are
              read-only.
            </p>
            <LayerCard className="w-full overflow-x-auto p-0">
              <Table layout="fixed">
                <colgroup>
                  <col style={{ width: "180px" }} />
                  <col style={{ width: "180px" }} />
                  <col style={{ width: "120px" }} />
                  <col style={{ width: "120px" }} />
                  <col style={{ width: "120px" }} />
                </colgroup>
                <Table.Header>
                  <Table.Row>
                    <Table.Head>Resource</Table.Head>
                    <Table.Head>Action</Table.Head>
                    <Table.Head>Owner</Table.Head>
                    <Table.Head>Admin</Table.Head>
                    <Table.Head>Member</Table.Head>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {Object.entries(statements).flatMap(([res, actions]) =>
                    (actions as readonly string[]).map((action, idx) => (
                      <Table.Row key={`${res}-${action}`}>
                        <Table.Cell className={idx === 0 ? "font-medium" : "text-kumo-subtle"}>
                          {idx === 0 ? res : ""}
                        </Table.Cell>
                        <Table.Cell>
                          <Code code={action} lang="ts" />
                        </Table.Cell>
                        <Table.Cell>
                          <Check className="text-kumo-success" size={18} />
                        </Table.Cell>
                        <Table.Cell>
                          {defaultRoleStatements.admin[res]?.includes(action) ? (
                            <Check className="text-kumo-success" size={18} />
                          ) : (
                            "—"
                          )}
                        </Table.Cell>
                        <Table.Cell>
                          {defaultRoleStatements.member[res]?.includes(action) ? (
                            <Check className="text-kumo-success" size={18} />
                          ) : (
                            "—"
                          )}
                        </Table.Cell>
                      </Table.Row>
                    )),
                  )}
                </Table.Body>
              </Table>
            </LayerCard>
          </div>

          {/* Custom Roles Section */}
          <div>
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <div className="font-semibold text-sm">{t("customRoles")}</div>
                <p className="text-sm text-kumo-subtle">
                  Create tailored roles for your organization with granular statements.
                </p>
              </div>
              {canManageRoles && (
                <Button size="sm" onClick={() => setCreateRoleDialog(true)}>
                  <Plus size={14} />
                  {t("createRole")}
                </Button>
              )}
            </div>

            {loadingRoles ? (
              <LoadingState variant="table" hasHeader={false} rows={3} />
            ) : customRoles.length === 0 ? (
              <Empty title={t("noRoles")} />
            ) : (
              <div className="grid gap-6">
                {customRoles.map((cr) => (
                  <LayerCard key={cr.role} className="w-full">
                    <LayerCard.Secondary className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="blue">{cr.role}</Badge>
                      </div>
                      {canManageRoles && (
                        <Button
                          size="xs"
                          variant="destructive"
                          onClick={() => void handleDeleteCustomRole(cr.role)}
                        >
                          <Trash size={14} />
                          {t("deleteRole")}
                        </Button>
                      )}
                    </LayerCard.Secondary>
                    <LayerCard.Primary className="p-0 overflow-x-auto">
                      <Table layout="fixed">
                        <colgroup>
                          <col style={{ width: "180px" }} />
                          <col style={{ width: "180px" }} />
                          <col style={{ width: "120px" }} />
                        </colgroup>
                        <Table.Header>
                          <Table.Row>
                            <Table.Head>Resource</Table.Head>
                            <Table.Head>Action</Table.Head>
                            <Table.Head>Allowed</Table.Head>
                          </Table.Row>
                        </Table.Header>
                        <Table.Body>
                          {Object.entries(statements).flatMap(([res, actions]) =>
                            (actions as readonly string[]).map((action, idx) => {
                              const isChecked = (cr.permission[res] ?? []).includes(action);
                              return (
                                <Table.Row key={`${cr.role}-${res}-${action}`}>
                                  <Table.Cell
                                    className={idx === 0 ? "font-medium" : "text-kumo-subtle"}
                                  >
                                    {idx === 0 ? res : ""}
                                  </Table.Cell>
                                  <Table.Cell>
                                    <Code code={action} lang="ts" />
                                  </Table.Cell>
                                  <Table.Cell>
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      disabled={!canManageRoles}
                                      onChange={() =>
                                        void handleToggleCustomRolePermission(cr, res, action)
                                      }
                                      className="size-4 rounded border-kumo-line text-kumo-brand focus:ring-kumo-ring cursor-pointer"
                                    />
                                  </Table.Cell>
                                </Table.Row>
                              );
                            }),
                          )}
                        </Table.Body>
                      </Table>
                    </LayerCard.Primary>
                  </LayerCard>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Settings */}
      {activeTab === "settings" && (
        <div className="grid gap-6 max-w-2xl">
          <LayerCard>
            <LayerCard.Secondary>{t("orgSettings")}</LayerCard.Secondary>
            <LayerCard.Primary>
              <form onSubmit={handleSaveOrgName} className="grid gap-4">
                <Input
                  label={t("orgName")}
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  disabled={!canUpdateOrg}
                  required
                />
                <div className="grid gap-1">
                  <p className="text-sm text-kumo-subtle">{t("orgSlug")}</p>
                  <Code code={activeOrg?.slug || "default"} lang="ts" />
                </div>
                {canUpdateOrg && (
                  <div>
                    <Button type="submit" variant="primary" loading={savingOrgName}>
                      {t("save")}
                    </Button>
                  </div>
                )}
              </form>
            </LayerCard.Primary>
          </LayerCard>

          {canDeleteOrg && (
            <LayerCard className="border-kumo-danger/30">
              <LayerCard.Secondary className="text-kumo-danger">
                {t("deleteOrganization")}
              </LayerCard.Secondary>
              <LayerCard.Primary className="grid gap-4">
                <p className="text-sm text-kumo-subtle">
                  {hasApps ? t("deleteOrganizationHint") : "Permanently delete this organization."}
                </p>
                <div>
                  <Button
                    variant="destructive"
                    loading={deletingOrg}
                    disabled={hasApps}
                    onClick={() => void handleDeleteOrg()}
                  >
                    {t("deleteOrganization")}
                  </Button>
                </div>
              </LayerCard.Primary>
            </LayerCard>
          )}
        </div>
      )}

      {/* Dialog: Create Custom Role */}
      <Dialog.Root open={createRoleDialog} onOpenChange={setCreateRoleDialog}>
        <Dialog size="lg" className="px-8 py-6">
          <Dialog.Title>{t("createRole")}</Dialog.Title>
          <Dialog.Description>
            Define a new role and configure its initial permissions.
          </Dialog.Description>
          <form onSubmit={handleCreateCustomRole} className="grid gap-4 mt-4">
            <Input
              label={t("roleName")}
              placeholder="e.g. editor, viewer"
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              required
            />
            <div className="grid gap-2 max-h-60 overflow-y-auto border border-kumo-line rounded-md p-3">
              <div className="text-sm font-medium">{t("rolePermissions")}</div>
              {Object.entries(statements).map(([res, actions]) => (
                <div key={res} className="grid gap-1 mb-2">
                  <span className="text-xs font-semibold uppercase text-kumo-subtle">{res}</span>
                  <div className="flex flex-wrap gap-3">
                    {(actions as readonly string[]).map((action) => {
                      const checked = (newRolePerms[res] ?? []).includes(action);
                      return (
                        <label
                          key={action}
                          className="flex items-center gap-1.5 text-xs text-kumo-secondary cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              const cur = newRolePerms[res] ?? [];
                              const next = checked
                                ? cur.filter((a) => a !== action)
                                : [...cur, action];
                              setNewRolePerms({ ...newRolePerms, [res]: next });
                            }}
                          />
                          {action}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <Button type="button" variant="secondary" onClick={() => setCreateRoleDialog(false)}>
                {t("cancel")}
              </Button>
              <Button type="submit" variant="primary" loading={savingRole} disabled={!newRoleName}>
                {t("create")}
              </Button>
            </div>
          </form>
        </Dialog>
      </Dialog.Root>

      {/* Dialog: Create Organization */}
      <Dialog.Root open={createOrgDialog} onOpenChange={setCreateOrgDialog}>
        <Dialog size="lg" className="px-8 py-6">
          <Dialog.Title>{t("createOrganization")}</Dialog.Title>
          <Dialog.Description>Create a new organization workspace.</Dialog.Description>
          <form onSubmit={handleCreateOrg} className="grid gap-4 mt-4">
            <Input
              label={t("orgName")}
              placeholder="e.g. Acme Corp"
              value={newOrgName}
              onChange={(e) => {
                setNewOrgName(e.target.value);
                if (!newOrgSlug) {
                  setNewOrgSlug(
                    e.target.value
                      .toLowerCase()
                      .trim()
                      .replace(/[^a-z0-9]+/g, "-"),
                  );
                }
              }}
              required
            />
            <Input
              label={t("orgSlug")}
              placeholder="e.g. acme-corp"
              value={newOrgSlug}
              onChange={(e) => setNewOrgSlug(e.target.value)}
              required
            />
            <div className="flex justify-end gap-2 mt-2">
              <Button type="button" variant="secondary" onClick={() => setCreateOrgDialog(false)}>
                {t("cancel")}
              </Button>
              <Button
                type="submit"
                variant="primary"
                loading={creatingOrg}
                disabled={!newOrgName || !newOrgSlug}
              >
                {t("create")}
              </Button>
            </div>
          </form>
        </Dialog>
      </Dialog.Root>
    </>
  );
}

function AccountView() {
  const context = useAdminContext();
  const { t } = useI18n();
  const toast = useKumoToastManager();
  const queryClient = useQueryClient();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const sessionQuery = api.useQuery("get", "/api/v1/auth/session");
  const session = sessionQuery.data;
  const { data: betterAuthSession } = useSession();
  const { data: orgs } = useListOrganizations();
  const { data: activeOrg } = useActiveOrganization();

  const [userInvitations, setUserInvitations] = useState<
    Array<{
      id: string;
      organizationName?: string;
      organizationId: string;
      role: string;
      status: string;
    }>
  >([]);

  const loadUserInvitations = useCallback(async () => {
    try {
      const res = await authClient.organization.listUserInvitations();
      if (res?.data) {
        setUserInvitations(
          res.data as unknown as Array<{
            id: string;
            organizationName?: string;
            organizationId: string;
            role: string;
            status: string;
          }>,
        );
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void loadUserInvitations();
  }, [loadUserInvitations]);

  async function handleAcceptInvite(invitationId: string) {
    try {
      await authClient.organization.acceptInvitation({ invitationId });
      toast.add({ title: t("invitationAccepted"), type: "success" });
      await loadUserInvitations();
      void queryClient.invalidateQueries();
    } catch (err) {
      toast.add({ title: err instanceof Error ? err.message : t("requestFailed"), type: "error" });
    }
  }

  async function handleRejectInvite(invitationId: string) {
    try {
      await authClient.organization.rejectInvitation({ invitationId });
      await loadUserInvitations();
    } catch (err) {
      toast.add({ title: err instanceof Error ? err.message : t("requestFailed"), type: "error" });
    }
  }

  async function handleSwitchOrg(orgId: string, orgSlug: string) {
    try {
      await authClient.organization.setActive({ organizationId: orgId });
      void queryClient.invalidateQueries();
      context.router.push(
        buildHref("/apps", { mode: context.mode, lang: context.language, orgSlug }),
      );
    } catch (err) {
      toast.add({ title: err instanceof Error ? err.message : t("requestFailed"), type: "error" });
    }
  }

  async function handleSignOut() {
    setIsSigningOut(true);
    try {
      await signOut();
      await fetchClient.DELETE("/api/v1/auth/session");
    } catch (error) {
      console.error("Sign out error:", error);
    } finally {
      setIsSigningOut(false);
      window.location.href = "/login";
    }
  }

  return (
    <>
      <PageHeader title={t("account")} description={t("accountDescription")} />
      {sessionQuery.error ? <ErrorState error={sessionQuery.error} /> : null}
      <div className="grid gap-6 max-w-2xl">
        <LayerCard>
          <LayerCard.Secondary>{t("account")}</LayerCard.Secondary>
          <LayerCard.Primary className="grid gap-4">
            <div className="grid gap-2">
              <Text variant="secondary">{t("status")}</Text>
              <div>
                <StatusBadge
                  status={betterAuthSession?.user || session?.authenticated ? "active" : "disabled"}
                />
              </div>
            </div>
            {betterAuthSession?.user && (
              <>
                <div className="grid gap-1">
                  <Text variant="secondary">User</Text>
                  <Text>{betterAuthSession.user.name || "Administrator"}</Text>
                </div>
                <div className="grid gap-1">
                  <Text variant="secondary">Email</Text>
                  <Text>{betterAuthSession.user.email}</Text>
                </div>
              </>
            )}
            {session?.mode ? (
              <div className="grid gap-1">
                <Text variant="secondary">{t("authMode")}</Text>
                <Text>{session.mode}</Text>
              </div>
            ) : null}
            {betterAuthSession?.session?.expiresAt ? (
              <div className="grid gap-1">
                <Text variant="secondary">Expires</Text>
                <Text>{new Date(betterAuthSession.session.expiresAt).toLocaleString()}</Text>
              </div>
            ) : session?.expiresAt ? (
              <div className="grid gap-1">
                <Text variant="secondary">Expires</Text>
                <Text>{new Date(session.expiresAt).toLocaleString()}</Text>
              </div>
            ) : null}
            <div>
              <Button variant="destructive" loading={isSigningOut} onClick={handleSignOut}>
                {t("signOut")}
              </Button>
            </div>
          </LayerCard.Primary>
        </LayerCard>

        {/* My Organizations */}
        {orgs && orgs.length > 0 && (
          <LayerCard>
            <LayerCard.Secondary>{t("myOrganizations")}</LayerCard.Secondary>
            <LayerCard.Primary className="grid gap-3">
              {(orgs as Array<{ id: string; name: string; slug: string }>).map((org) => {
                const isActive = org.id === activeOrg?.id;
                return (
                  <div
                    key={org.id}
                    className="flex items-center justify-between gap-4 rounded-md border border-kumo-line bg-kumo-base p-3 text-sm"
                  >
                    <div>
                      <span className="font-medium">{org.name}</span>
                      <span className="ml-2 text-xs text-kumo-subtle">({org.slug})</span>
                      {isActive && (
                        <Badge variant="green" className="ml-2">
                          {t("activeOrg")}
                        </Badge>
                      )}
                    </div>
                    {!isActive && (
                      <Button
                        size="xs"
                        variant="secondary"
                        onClick={() => void handleSwitchOrg(org.id, org.slug)}
                      >
                        {t("switchOrg")}
                      </Button>
                    )}
                  </div>
                );
              })}
            </LayerCard.Primary>
          </LayerCard>
        )}

        {/* User Pending Invitations */}
        {userInvitations.length > 0 && (
          <LayerCard>
            <LayerCard.Secondary>{t("userInvitations")}</LayerCard.Secondary>
            <LayerCard.Primary className="grid gap-3">
              {userInvitations.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between gap-4 rounded-md border border-kumo-line bg-kumo-base p-3 text-sm"
                >
                  <div>
                    <span className="font-medium">
                      {inv.organizationName || inv.organizationId}
                    </span>
                    <span className="ml-2 text-kumo-subtle">({inv.role})</span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="xs"
                      variant="primary"
                      onClick={() => void handleAcceptInvite(inv.id)}
                    >
                      {t("acceptInvitation")}
                    </Button>
                    <Button
                      size="xs"
                      variant="secondary"
                      onClick={() => void handleRejectInvite(inv.id)}
                    >
                      {t("cancelInvitation")}
                    </Button>
                  </div>
                </div>
              ))}
            </LayerCard.Primary>
          </LayerCard>
        )}
      </div>
    </>
  );
}
function NotFoundView() {
  const { t } = useI18n();
  return <Empty title={t("notFound")} description={t("noResultsDescription")} />;
}
