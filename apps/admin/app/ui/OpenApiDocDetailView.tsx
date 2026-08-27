"use client";

import {
  ArrowLeft,
  ArrowsClockwise,
  BracketsCurly,
  CaretDown,
  CaretRight,
  Check,
  Code as CodeIcon,
  Copy,
  DownloadSimple,
  Globe,
  PencilSimple,
  Star,
  Trash,
  UploadSimple,
} from "@phosphor-icons/react";
import { useKumoToastManager } from "@cloudflare/kumo";
import { Badge } from "@cloudflare/kumo/components/badge";
import { Button, LinkButton } from "@cloudflare/kumo/components/button";
import { Code } from "@cloudflare/kumo/components/code";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { Empty } from "@cloudflare/kumo/components/empty";
import { Input, Textarea } from "@cloudflare/kumo/components/input";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Surface } from "@cloudflare/kumo/components/surface";
import { Switch } from "@cloudflare/kumo/components/switch";
import { Table } from "@cloudflare/kumo/components/table";
import { Text } from "@cloudflare/kumo/components/text";
import { PageSkeleton } from "./PageSkeleton";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { api } from "./api";
import { useAdminContext, useI18n } from "./i18n";
import { OpenApiUploadModal, type ParsedOpenApiFile } from "./OpenApiUploadModal";

const HTTP_METHODS = ["get", "post", "put", "delete", "patch", "options", "head", "trace"] as const;

function getMethodBadgeVariant(
  method: string,
): "blue" | "green" | "orange" | "red" | "purple" | "neutral" {
  switch (method.toLowerCase()) {
    case "get":
      return "blue";
    case "post":
      return "green";
    case "put":
      return "orange";
    case "delete":
      return "red";
    case "patch":
      return "purple";
    default:
      return "neutral";
  }
}

function safeString(val: unknown, fallback = ""): string {
  if (typeof val === "string") return val;
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  if (val === null || val === undefined) return fallback;
  return JSON.stringify(val);
}

function resolveSchemaLabel(s: unknown): string {
  if (!s || typeof s !== "object") return "—";
  const obj = s as Record<string, unknown>;
  if (typeof obj.$ref === "string") {
    return obj.$ref.split("/").pop() || obj.$ref;
  }
  if (obj.type === "array") {
    const itemsLabel = obj.items ? resolveSchemaLabel(obj.items) : "any";
    return `Array<${itemsLabel}>`;
  }
  if (obj.type === "object" || obj.properties) {
    if (typeof obj.title === "string") return obj.title;
    const props =
      obj.properties && typeof obj.properties === "object" ? Object.keys(obj.properties) : [];
    return props.length > 0
      ? `object { ${props.slice(0, 3).join(", ")}${props.length > 3 ? "..." : ""} }`
      : "object";
  }
  if (obj.type) return typeof obj.type === "string" ? obj.type : safeString(obj.type);
  if (Array.isArray(obj.oneOf)) return `oneOf<${obj.oneOf.map(resolveSchemaLabel).join(" | ")}>`;
  if (Array.isArray(obj.anyOf)) return `anyOf<${obj.anyOf.map(resolveSchemaLabel).join(" | ")}>`;
  if (Array.isArray(obj.allOf)) return `allOf<${obj.allOf.map(resolveSchemaLabel).join(" & ")}>`;
  return "any";
}

interface ParsedResponse {
  statusCode: string;
  description: string;
  mediaType: string;
  schemaType: string;
  schema?: Record<string, unknown>;
}

function extractResponseDetails(statusCode: string, resp: unknown): ParsedResponse {
  if (!resp || typeof resp !== "object") {
    return { statusCode, description: "—", mediaType: "—", schemaType: "—" };
  }

  const respObj = resp as Record<string, unknown>;
  const description = typeof respObj.description === "string" ? respObj.description : "—";
  const content = respObj.content;

  let schema: Record<string, unknown> | undefined =
    respObj.schema && typeof respObj.schema === "object"
      ? (respObj.schema as Record<string, unknown>)
      : undefined;
  let mediaType = "—";

  if (content && typeof content === "object") {
    const contentRecord = content as Record<string, unknown>;
    const contentKeys = Object.keys(contentRecord);
    if (contentKeys.length > 0) {
      mediaType = contentKeys[0];
      const jsonContent =
        contentRecord["application/json"] ?? contentRecord["*/*"] ?? contentRecord[contentKeys[0]];
      if (jsonContent && typeof jsonContent === "object") {
        const jObj = jsonContent as Record<string, unknown>;
        if (jObj.schema && typeof jObj.schema === "object") {
          schema = jObj.schema as Record<string, unknown>;
        }
      }
    }
  }

  const schemaType = resolveSchemaLabel(schema);
  return {
    statusCode,
    description,
    mediaType,
    schemaType,
    schema,
  };
}

interface EndpointOperation {
  id: string;
  path: string;
  method: string;
  summary: string;
  description: string;
  operationId: string;
  tags: string[];
  parameters: Array<Record<string, unknown>>;
  requestBody?: Record<string, unknown>;
  requestBodySchemaType?: string;
  responses: Record<string, Record<string, unknown>>;
  parsedResponses: ParsedResponse[];
  raw: Record<string, unknown>;
}

export function OpenApiDocDetailView() {
  const context = useAdminContext();
  const { t } = useI18n();
  const toast = useKumoToastManager();
  const queryClient = useQueryClient();

  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"endpoints" | "schemas" | "source">("endpoints");
  const [expandedEndpoints, setExpandedEndpoints] = useState<Record<string, boolean>>({});

  // Edit form state
  const [editForm, setEditForm] = useState({
    name: "",
    json: "",
    isDefault: false,
  });
  const [jsonValidationError, setJsonValidationError] = useState<string | null>(null);

  // Extract openApiDocId from viewPath, e.g. /openapi-docs/123
  const openApiDocId = context.viewPath.slice("/openapi-docs/".length);

  const query = api.useQuery("get", "/api/v1/apps/{appId}/openapi-docs/{openApiDocId}", {
    params: {
      path: {
        appId: context.appId ?? "",
        openApiDocId,
      },
    },
    enabled: Boolean(context.appId && openApiDocId),
  });

  const updateMutation = api.useMutation(
    "patch",
    "/api/v1/apps/{appId}/openapi-docs/{openApiDocId}",
    {
      onSuccess: () => {
        setEditDialogOpen(false);
        toast.add({ title: t("updated") });
        void queryClient.invalidateQueries();
      },
      onError: (err) => {
        toast.add({
          title: t("requestFailed"),
          description: err instanceof Error ? err.message : JSON.stringify(err),
        });
      },
    },
  );

  const deleteMutation = api.useMutation(
    "delete",
    "/api/v1/apps/{appId}/openapi-docs/{openApiDocId}",
    {
      onSuccess: () => {
        toast.add({ title: t("deleted") });
        void queryClient.invalidateQueries();
        context.router.push(context.href("/openapi-docs"));
      },
      onError: (err) => {
        toast.add({
          title: t("requestFailed"),
          description: err instanceof Error ? err.message : JSON.stringify(err),
        });
      },
    },
  );

  const doc = query.data;

  // Parsed OpenAPI details
  const docJson = useMemo(() => (doc?.json ?? {}) as Record<string, unknown>, [doc?.json]);
  const docInfo = (docJson.info ?? {}) as Record<string, unknown>;
  const serversList = Array.isArray(docJson.servers) ? docJson.servers : [];
  const componentsObj = (docJson.components ?? docJson.definitions ?? {}) as Record<
    string,
    unknown
  >;
  const schemasObj = (componentsObj.schemas ??
    (docJson.definitions ? docJson.definitions : {})) as Record<string, Record<string, unknown>>;
  const schemasList = Object.entries(schemasObj);

  // Extract all operations
  const allOperations = useMemo<EndpointOperation[]>(() => {
    const paths = (docJson.paths ?? {}) as Record<string, Record<string, unknown>>;
    const ops: EndpointOperation[] = [];

    for (const [pathKey, pathObj] of Object.entries(paths)) {
      if (!pathObj || typeof pathObj !== "object") continue;
      for (const method of HTTP_METHODS) {
        if (method in pathObj && typeof pathObj[method] === "object" && pathObj[method]) {
          const op = pathObj[method] as Record<string, unknown>;
          const responsesObj = (op.responses ?? {}) as Record<string, Record<string, unknown>>;
          const parsedResponses = Object.entries(responsesObj).map(([statusCode, respVal]) =>
            extractResponseDetails(statusCode, respVal),
          );

          let reqSchemaType = "";
          if (op.requestBody && typeof op.requestBody === "object") {
            const rb = op.requestBody as Record<string, unknown>;
            const content = rb.content as Record<string, Record<string, unknown>> | undefined;
            if (content && typeof content === "object") {
              const firstContent = Object.values(content)[0];
              if (firstContent?.schema) {
                reqSchemaType = resolveSchemaLabel(firstContent.schema);
              }
            }
          }

          ops.push({
            id: `${method.toUpperCase()} ${pathKey}`,
            path: pathKey,
            method: method.toUpperCase(),
            summary: typeof op.summary === "string" ? op.summary : "",
            description: typeof op.description === "string" ? op.description : "",
            operationId: typeof op.operationId === "string" ? op.operationId : "",
            tags: Array.isArray(op.tags) ? op.tags.map(String) : [],
            parameters: Array.isArray(op.parameters)
              ? (op.parameters as Array<Record<string, unknown>>)
              : [],
            requestBody: op.requestBody as Record<string, unknown> | undefined,
            requestBodySchemaType: reqSchemaType,
            responses: responsesObj,
            parsedResponses,
            raw: op,
          });
        }
      }
    }
    return ops;
  }, [docJson]);

  // Filter operations based on search
  const filteredOperations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allOperations;
    return allOperations.filter(
      (op) =>
        op.path.toLowerCase().includes(q) ||
        op.method.toLowerCase().includes(q) ||
        op.summary.toLowerCase().includes(q) ||
        op.operationId.toLowerCase().includes(q) ||
        op.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [allOperations, searchQuery]);

  const toggleEndpointExpand = (id: string) => {
    setExpandedEndpoints((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Initialize edit form
  const openEditModal = () => {
    if (doc) {
      setEditForm({
        name: doc.name,
        json: JSON.stringify(doc.json, null, 2),
        isDefault: doc.isDefault,
      });
      setJsonValidationError(null);
      setEditDialogOpen(true);
    }
  };

  const handleJsonChange = (value: string) => {
    setEditForm((prev) => ({ ...prev, json: value }));
    try {
      const parsed = JSON.parse(value) as unknown;
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        setJsonValidationError(t("openApiJsonInvalid"));
        return;
      }
      const p = (parsed as { paths?: unknown }).paths;
      if (typeof p !== "object" || p === null || Array.isArray(p)) {
        setJsonValidationError(t("openApiJsonInvalid"));
        return;
      }
      setJsonValidationError(null);
    } catch {
      setJsonValidationError(t("openApiJsonInvalid"));
    }
  };

  const formatJson = () => {
    try {
      const parsed = JSON.parse(editForm.json) as unknown;
      setEditForm((prev) => ({
        ...prev,
        json: JSON.stringify(parsed, null, 2),
      }));
      setJsonValidationError(null);
    } catch {
      // Keep existing invalid text
    }
  };

  const handleSaveEdit = () => {
    if (!context.appId || !doc) return;
    try {
      const parsedJson = JSON.parse(editForm.json) as Record<string, unknown>;
      updateMutation.mutate({
        params: {
          path: {
            appId: context.appId,
            openApiDocId: doc.id,
          },
        },
        body: {
          name: editForm.name.trim() || doc.name,
          json: parsedJson,
          isDefault: editForm.isDefault,
        },
      });
    } catch {
      setJsonValidationError(t("openApiJsonInvalid"));
    }
  };

  const handleUploadApply = (parsed: ParsedOpenApiFile) => {
    if (!context.appId || !doc) return;
    updateMutation.mutate({
      params: {
        path: {
          appId: context.appId,
          openApiDocId: doc.id,
        },
      },
      body: {
        json: parsed.json,
      },
    });
  };

  const copyToClipboard = () => {
    if (doc?.json) {
      void navigator.clipboard.writeText(JSON.stringify(doc.json, null, 2));
      setCopied(true);
      toast.add({ title: t("copied") });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const downloadJsonFile = () => {
    if (doc?.json) {
      const blob = new Blob([JSON.stringify(doc.json, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${doc.name || "openapi"}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  if (query.isLoading) {
    return <PageSkeleton variant="detail" />;
  }

  if (query.error || !doc) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <LinkButton href={context.href("/openapi-docs")} variant="ghost" size="sm">
            <ArrowLeft size={16} />
            <span>{t("openapiDocs")}</span>
          </LinkButton>
        </div>
        <Empty
          title={t("notFound")}
          description="The requested OpenAPI document could not be found."
        />
      </div>
    );
  }

  const openApiVersion = safeString(docJson.openapi ?? docJson.swagger, "3.0.3");

  return (
    <div className="flex flex-col gap-6">
      {/* Top Breadcrumbs & Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-kumo-secondary">
          <LinkButton
            href={context.href("/openapi-docs")}
            variant="ghost"
            size="sm"
            className="text-kumo-secondary hover:text-kumo-default"
          >
            <ArrowLeft size={16} />
            <span>{t("openapiDocs")}</span>
          </LinkButton>
          <span>/</span>
          <span className="font-medium text-kumo-default truncate max-w-xs">{doc.name}</span>
        </div>

        {/* Top Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Upload Button */}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setUploadModalOpen(true)}
            className="gap-1.5"
          >
            <UploadSimple size={16} />
            <span>{t("upload") || "Upload"}</span>
          </Button>

          {/* Edit OpenAPI Button */}
          <Button variant="primary" size="sm" onClick={openEditModal} className="gap-1.5">
            <PencilSimple size={16} />
            <span>{t("editOpenApi") || "Edit OpenAPI"}</span>
          </Button>

          {/* Copy JSON */}
          <Button variant="secondary" size="sm" onClick={copyToClipboard} title="Copy JSON">
            {copied ? <Check size={16} className="text-kumo-green" /> : <Copy size={16} />}
          </Button>

          {/* Download JSON */}
          <Button
            variant="secondary"
            size="sm"
            onClick={downloadJsonFile}
            title="Download JSON file"
          >
            <DownloadSimple size={16} />
          </Button>

          {/* Toggle Default */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              updateMutation.mutate({
                params: {
                  path: { appId: context.appId ?? "", openApiDocId: doc.id },
                },
                body: { isDefault: !doc.isDefault },
              })
            }
            title={doc.isDefault ? t("removeDefault") : t("setDefault")}
          >
            <Star
              size={16}
              weight={doc.isDefault ? "fill" : "regular"}
              className={doc.isDefault ? "text-amber-500" : ""}
            />
          </Button>

          {/* Delete */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (window.confirm("Are you sure you want to delete this OpenAPI document?")) {
                deleteMutation.mutate({
                  params: {
                    path: { appId: context.appId ?? "", openApiDocId: doc.id },
                  },
                });
              }
            }}
            title={t("delete")}
          >
            <Trash size={16} className="text-kumo-danger" />
          </Button>
        </div>
      </div>

      {/* Header Summary Card */}
      <LayerCard className="flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="grid gap-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <Text variant="heading" as="h1" size="lg">
                {doc.name}
              </Text>
              {doc.isDefault ? <Badge variant="green">{t("default")}</Badge> : null}
              <Badge variant="blue">{`OpenAPI ${openApiVersion}`}</Badge>
              <Badge variant="neutral">{`${allOperations.length} endpoints`}</Badge>
              {typeof docInfo.version === "string" ? (
                <Badge variant="purple">{`v${docInfo.version}`}</Badge>
              ) : null}
            </div>

            {typeof docInfo.description === "string" ? (
              <div className="mt-1 max-w-3xl">
                <Text variant="secondary">{docInfo.description}</Text>
              </div>
            ) : null}
          </div>
        </div>

        {/* Server URLs if available */}
        {serversList.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-kumo-line text-xs">
            <div className="flex items-center gap-1.5 text-kumo-secondary font-medium">
              <Globe size={14} />
              <span>Servers:</span>
            </div>
            {serversList.map((srv, idx) => {
              const sObj = (srv && typeof srv === "object" ? srv : {}) as Record<string, unknown>;
              return (
                <code
                  key={idx}
                  className="font-mono text-xs bg-kumo-subtle px-2 py-0.5 rounded text-kumo-default"
                >
                  {safeString(sObj.url, "default")}
                </code>
              );
            })}
          </div>
        ) : null}
      </LayerCard>

      {/* Section Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-kumo-line pb-2">
        <Button
          variant={activeTab === "endpoints" ? "primary" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("endpoints")}
          className="gap-1.5"
        >
          <span>Endpoints ({allOperations.length})</span>
        </Button>
        <Button
          variant={activeTab === "schemas" ? "primary" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("schemas")}
          className="gap-1.5"
        >
          <BracketsCurly size={15} />
          <span>Schemas ({schemasList.length})</span>
        </Button>
        <Button
          variant={activeTab === "source" ? "primary" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("source")}
          className="gap-1.5"
        >
          <CodeIcon size={15} />
          <span>JSON Source</span>
        </Button>
      </div>

      {/* Tab 1: Endpoints List */}
      {activeTab === "endpoints" && (
        <div className="flex flex-col gap-4">
          {/* Search bar */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Input
                aria-label={t("search")}
                placeholder="Search endpoints by path, method, tag or summary..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {filteredOperations.length === 0 ? (
            <Empty
              icon={<CodeIcon size={36} />}
              title={allOperations.length === 0 ? t("noResults") : t("noResults")}
              description={
                allOperations.length === 0
                  ? "No API endpoints or operations found in this OpenAPI specification document."
                  : t("noResultsDescription")
              }
              contents={
                allOperations.length === 0 ? (
                  <Button
                    variant="secondary"
                    icon={UploadSimple}
                    onClick={() => setUploadModalOpen(true)}
                  >
                    {t("upload") || "Upload"}
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="flex flex-col gap-3">
              {filteredOperations.map((op) => {
                const isExpanded = Boolean(expandedEndpoints[op.id]);

                return (
                  <LayerCard key={op.id} className="flex flex-col gap-0 p-0 overflow-hidden">
                    {/* Header line for each endpoint */}
                    <button
                      type="button"
                      onClick={() => toggleEndpointExpand(op.id)}
                      className="flex items-center justify-between gap-3 p-4 text-left w-full hover:bg-kumo-hover/40 transition-none cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <Badge variant={getMethodBadgeVariant(op.method)}>{op.method}</Badge>
                        <span className="font-mono text-sm font-medium text-kumo-default">
                          {op.path}
                        </span>
                        {op.summary ? (
                          <span className="text-sm text-kumo-secondary truncate hidden sm:inline">
                            {op.summary}
                          </span>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {op.tags.map((tag) => (
                          <Badge key={tag} variant="neutral">
                            {tag}
                          </Badge>
                        ))}
                        {isExpanded ? (
                          <CaretDown size={16} className="text-kumo-secondary" />
                        ) : (
                          <CaretRight size={16} className="text-kumo-secondary" />
                        )}
                      </div>
                    </button>

                    {/* Expandable endpoint details */}
                    {isExpanded && (
                      <div className="flex flex-col gap-4 p-4 pt-2 border-t border-kumo-line bg-kumo-subtle/20">
                        {op.description ? (
                          <div className="text-sm text-kumo-default">
                            <Text>{op.description}</Text>
                          </div>
                        ) : null}

                        {op.operationId ? (
                          <div className="flex items-center gap-2 text-xs text-kumo-secondary">
                            <span>operationId:</span>
                            <code className="font-mono bg-kumo-subtle px-1.5 py-0.5 rounded">
                              {op.operationId}
                            </code>
                          </div>
                        ) : null}

                        {/* Parameters Table */}
                        {op.parameters.length > 0 && (
                          <div className="flex flex-col gap-2">
                            <Text variant="heading" as="h3">
                              Parameters ({op.parameters.length})
                            </Text>
                            <div className="w-full overflow-x-auto rounded border border-kumo-line bg-kumo-canvas">
                              <Table>
                                <Table.Header>
                                  <Table.Row>
                                    <Table.Head className="w-44 min-w-[140px]">Name</Table.Head>
                                    <Table.Head className="w-24 min-w-[80px]">In</Table.Head>
                                    <Table.Head className="min-w-[180px]">Type</Table.Head>
                                    <Table.Head className="min-w-[200px]">Description</Table.Head>
                                  </Table.Row>
                                </Table.Header>
                                <Table.Body>
                                  {op.parameters.map((p, pIdx) => {
                                    const schema = (p.schema ?? {}) as Record<string, unknown>;
                                    return (
                                      <Table.Row key={pIdx}>
                                        <Table.Cell>
                                          <div className="flex items-center gap-1.5">
                                            <span className="font-mono text-xs font-medium text-kumo-default break-words">
                                              {safeString(p.name)}
                                            </span>
                                            {p.required ? (
                                              <Badge variant="red">required</Badge>
                                            ) : null}
                                          </div>
                                        </Table.Cell>
                                        <Table.Cell>
                                          <Badge variant="neutral">
                                            {safeString(p.in, "query")}
                                          </Badge>
                                        </Table.Cell>
                                        <Table.Cell>
                                          <span className="font-mono text-xs text-kumo-secondary break-words">
                                            {resolveSchemaLabel(schema) ||
                                              safeString(p.type, "string")}
                                          </span>
                                        </Table.Cell>
                                        <Table.Cell>
                                          <div className="text-xs text-kumo-secondary break-words">
                                            {safeString(p.description, "—")}
                                          </div>
                                        </Table.Cell>
                                      </Table.Row>
                                    );
                                  })}
                                </Table.Body>
                              </Table>
                            </div>
                          </div>
                        )}

                        {/* Request Body */}
                        {op.requestBody ? (
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                              <Text variant="heading" as="h3">
                                Request Body
                              </Text>
                              {op.requestBodySchemaType ? (
                                <Badge variant="blue">{op.requestBodySchemaType}</Badge>
                              ) : null}
                            </div>
                            <Surface className="p-3">
                              <Code code={JSON.stringify(op.requestBody, null, 2)} lang="jsonc" />
                            </Surface>
                          </div>
                        ) : null}

                        {/* Responses Table with Type/Schema Breakdown */}
                        {op.parsedResponses.length > 0 && (
                          <div className="flex flex-col gap-2">
                            <Text variant="heading" as="h3">
                              Responses ({op.parsedResponses.length})
                            </Text>
                            <div className="w-full overflow-x-auto rounded border border-kumo-line bg-kumo-canvas">
                              <Table>
                                <Table.Header>
                                  <Table.Row>
                                    <Table.Head className="w-24 min-w-[80px]">Status</Table.Head>
                                    <Table.Head className="min-w-[260px]">Schema Type</Table.Head>
                                    <Table.Head className="w-40 min-w-[140px]">
                                      Media Type
                                    </Table.Head>
                                    <Table.Head className="min-w-[200px]">Description</Table.Head>
                                  </Table.Row>
                                </Table.Header>
                                <Table.Body>
                                  {op.parsedResponses.map((r) => {
                                    const isSuccess = r.statusCode.startsWith("2");
                                    const isError =
                                      r.statusCode.startsWith("4") || r.statusCode.startsWith("5");
                                    return (
                                      <Table.Row key={r.statusCode}>
                                        <Table.Cell>
                                          <Badge
                                            variant={
                                              isSuccess ? "green" : isError ? "red" : "neutral"
                                            }
                                          >
                                            {r.statusCode}
                                          </Badge>
                                        </Table.Cell>
                                        <Table.Cell>
                                          <span className="font-mono text-xs font-medium text-kumo-default break-words inline-block">
                                            {r.schemaType}
                                          </span>
                                        </Table.Cell>
                                        <Table.Cell>
                                          <span className="font-mono text-xs text-kumo-secondary break-words">
                                            {r.mediaType}
                                          </span>
                                        </Table.Cell>
                                        <Table.Cell>
                                          <div className="text-xs text-kumo-default break-words">
                                            {r.description}
                                          </div>
                                        </Table.Cell>
                                      </Table.Row>
                                    );
                                  })}
                                </Table.Body>
                              </Table>
                            </div>

                            {/* Detailed Schema Inspector for non-empty schemas */}
                            <div className="grid gap-3 pt-2">
                              {op.parsedResponses
                                .filter((r) => r.schema)
                                .map((r) => (
                                  <Surface
                                    key={r.statusCode}
                                    className="flex flex-col gap-2 p-3 text-xs"
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <Badge
                                          variant={
                                            r.statusCode.startsWith("2")
                                              ? "green"
                                              : r.statusCode.startsWith("4") ||
                                                  r.statusCode.startsWith("5")
                                                ? "red"
                                                : "neutral"
                                          }
                                        >
                                          {r.statusCode} Response Schema
                                        </Badge>
                                        <span className="font-mono font-medium text-kumo-default break-words">
                                          {r.schemaType}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="max-h-56 overflow-y-auto">
                                      <Code code={JSON.stringify(r.schema, null, 2)} lang="jsonc" />
                                    </div>
                                  </Surface>
                                ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </LayerCard>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Schemas Overview */}
      {activeTab === "schemas" && (
        <div className="flex flex-col gap-4">
          {schemasList.length === 0 ? (
            <LayerCard className="p-8 text-center text-kumo-secondary">
              <Text>No schema definitions found in this OpenAPI document.</Text>
            </LayerCard>
          ) : (
            <div className="flex flex-col gap-4">
              {schemasList.map(([schemaName, schemaVal]) => {
                const schema = (
                  schemaVal && typeof schemaVal === "object" ? schemaVal : {}
                ) as Record<string, unknown>;
                const properties = (schema.properties ?? {}) as Record<
                  string,
                  Record<string, unknown>
                >;
                const requiredFields = Array.isArray(schema.required)
                  ? schema.required.map(String)
                  : [];

                return (
                  <LayerCard key={schemaName} className="flex flex-col gap-3 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <BracketsCurly size={18} className="text-kumo-secondary" />
                        <span className="font-mono text-sm font-semibold text-kumo-default break-words">
                          {schemaName}
                        </span>
                      </div>
                      <Badge variant="neutral">{safeString(schema.type, "object")}</Badge>
                    </div>

                    {typeof schema.description === "string" ? (
                      <Text variant="secondary">{schema.description}</Text>
                    ) : null}

                    {Object.keys(properties).length > 0 ? (
                      <div className="w-full overflow-x-auto mt-2 rounded border border-kumo-line bg-kumo-canvas">
                        <Table>
                          <Table.Header>
                            <Table.Row>
                              <Table.Head className="min-w-[140px]">Property</Table.Head>
                              <Table.Head className="min-w-[140px]">Type</Table.Head>
                              <Table.Head className="min-w-[180px]">Description</Table.Head>
                            </Table.Row>
                          </Table.Header>
                          <Table.Body>
                            {Object.entries(properties).map(([propName, propVal]) => (
                              <Table.Row key={propName}>
                                <Table.Cell>
                                  <div className="flex items-center gap-1">
                                    <span className="font-mono text-xs font-medium text-kumo-default break-words">
                                      {propName}
                                    </span>
                                    {requiredFields.includes(propName) ? (
                                      <Badge variant="red">req</Badge>
                                    ) : null}
                                  </div>
                                </Table.Cell>
                                <Table.Cell>
                                  <span className="font-mono text-xs text-kumo-secondary break-words">
                                    {resolveSchemaLabel(propVal) ||
                                      safeString(propVal?.type, "any")}
                                  </span>
                                </Table.Cell>
                                <Table.Cell>
                                  <div className="text-xs text-kumo-secondary break-words">
                                    {safeString(propVal?.description, "—")}
                                  </div>
                                </Table.Cell>
                              </Table.Row>
                            ))}
                          </Table.Body>
                        </Table>
                      </div>
                    ) : null}
                  </LayerCard>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: JSON Source Viewer */}
      {activeTab === "source" && (
        <LayerCard className="flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between border-b border-kumo-line pb-3">
            <div className="flex items-center gap-2">
              <CodeIcon size={18} className="text-kumo-secondary" />
              <Text variant="heading" as="h3">
                OpenAPI Specification JSON
              </Text>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={openEditModal} className="gap-1.5">
                <PencilSimple size={14} />
                <span>{t("edit")}</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={copyToClipboard} className="gap-1.5">
                <Copy size={14} />
                <span>{t("copy") || "Copy"}</span>
              </Button>
            </div>
          </div>
          <Surface className="p-4 max-h-[750px] overflow-y-auto font-mono text-xs">
            <Code code={JSON.stringify(docJson, null, 2)} lang="jsonc" />
          </Surface>
        </LayerCard>
      )}

      {/* Drag & Drop Upload Modal */}
      <OpenApiUploadModal
        open={uploadModalOpen}
        onOpenChange={setUploadModalOpen}
        onUpload={handleUploadApply}
        isLoading={updateMutation.isPending}
      />

      {/* Direct Edit OpenAPI Dialog */}
      <Dialog.Root open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <Dialog size="lg" className="px-8 py-6 max-w-4xl">
          <Dialog.Title>{t("editOpenApi") || "Edit OpenAPI document"}</Dialog.Title>
          <Dialog.Description>
            {t("editOpenApiDescription") ||
              "Directly edit the OpenAPI specification JSON or metadata."}
          </Dialog.Description>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label={t("openApiName")}
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />

              <div className="flex items-center gap-2 pt-6">
                <Switch
                  checked={editForm.isDefault}
                  onCheckedChange={(checked) =>
                    setEditForm({ ...editForm, isDefault: Boolean(checked) })
                  }
                />
                <Text>{t("default")}</Text>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-kumo-secondary">
                  {t("openApiJson")}
                </label>
                <Button variant="ghost" size="sm" onClick={formatJson} className="text-xs h-7 px-2">
                  <ArrowsClockwise size={14} className="mr-1" />
                  {t("formatJson") || "Format JSON"}
                </Button>
              </div>
              <Textarea
                className="font-mono text-xs leading-relaxed"
                rows={16}
                value={editForm.json}
                error={jsonValidationError ?? undefined}
                onChange={(e) => handleJsonChange(e.target.value)}
              />
              {jsonValidationError ? (
                <div className="mt-1">
                  <Text variant="error">{jsonValidationError}</Text>
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-kumo-line">
            <Button
              variant="secondary"
              onClick={() => setEditDialogOpen(false)}
              disabled={updateMutation.isPending}
            >
              {t("cancel")}
            </Button>
            <Button
              variant="primary"
              onClick={handleSaveEdit}
              disabled={Boolean(jsonValidationError) || updateMutation.isPending}
              loading={updateMutation.isPending}
            >
              {t("save")}
            </Button>
          </div>
        </Dialog>
      </Dialog.Root>
    </div>
  );
}
