import { OpenAPIRegistry, extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import {
  AppCreateSchema,
  AppPatchSchema,
  AppKeyRotationSchema,
  AppSchema,
  AppManifestSchema,
  AssetCompleteSchema,
  AssetSchema,
  BootstrapSchema,
  CategoryCreateSchema,
  CategoryPatchSchema,
  CategorySchema,
  DocumentSchema,
  DraftPatchSchema,
  HealthSchema,
  ListResponseSchema,
  LocaleCreateSchema,
  LocalePatchSchema,
  LocaleSchema,
  PreviewProfileCreateSchema,
  PreviewProfilePatchSchema,
  PreviewProfileSchema,
  ProblemSchema,
  ReleaseCreateSchema,
  ReleaseSchema,
  ResourceCreateSchema,
  ResourcePatchSchema,
  ResourceSchema,
  StudioSessionCreateSchema,
  StudioSessionSchema,
  UiSessionCreateSchema,
  UiSessionSchema,
  UploadIntentResponseSchema,
  UploadIntentSchema,
  VersionCreateSchema,
  VersionSchema,
} from "../validation/schemas";

extendZodWithOpenApi(z);

export const registry = new OpenAPIRegistry();
const OpenApiJsonObjectSchema = z.object({}).catchall(z.unknown());

const schemas = [
  ["App", AppSchema],
  ["PreviewProfile", PreviewProfileSchema],
  ["Category", CategorySchema],
  ["Locale", LocaleSchema],
  ["Resource", ResourceSchema],
  ["Document", DocumentSchema],
  ["Version", VersionSchema],
  ["Release", ReleaseSchema],
  ["Manifest", OpenApiJsonObjectSchema],
  ["ManifestRevision", OpenApiJsonObjectSchema],
  ["Bootstrap", OpenApiJsonObjectSchema],
  ["StudioSession", StudioSessionSchema],
  ["RuntimeDelivery", OpenApiJsonObjectSchema],
  ["AppKeyRotation", AppKeyRotationSchema],
  ["Problem", ProblemSchema],
] as const;
for (const [name, schema] of [...schemas].sort(([a], [b]) => a.localeCompare(b)))
  registry.register(name, schema);

const AppQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.string().optional(),
});
const ResourceQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.string().optional(),
  q: z.string().optional(),
  status: z.string().optional(),
  categoryId: z.string().optional(),
});
const AppKeyHeaderSchema = z.object({ "x-openscene-app-key": z.string().min(1) });
const JsonObjectSchema = z.object({}).catchall(z.unknown());
const ListAppSchema = ListResponseSchema(AppSchema);
const ListPreviewSchema = z.array(PreviewProfileSchema);
const ListResourceSchema = ListResponseSchema(ResourceSchema);
const ListCategorySchema = z.array(CategorySchema);
const ListLocaleSchema = z.array(LocaleSchema);
const ListAssetSchema = z.array(AssetSchema);

type Operation = {
  method: "get" | "post" | "patch" | "delete";
  path: string;
  operationId: string;
  tag: string;
  response: z.ZodType;
  status?: 200 | 201 | 204;
  body?: z.ZodType;
  params?: boolean;
  query?: typeof AppQuerySchema | typeof ResourceQuerySchema;
  headers?: typeof AppKeyHeaderSchema;
};

const operations: Operation[] = [
  {
    method: "get",
    path: "/api/v1/auth/session",
    operationId: "getUiSession",
    tag: "Authentication",
    response: UiSessionSchema,
  },
  {
    method: "post",
    path: "/api/v1/auth/session",
    operationId: "createUiSession",
    tag: "Authentication",
    response: UiSessionSchema,
    body: UiSessionCreateSchema,
  },
  {
    method: "delete",
    path: "/api/v1/auth/session",
    operationId: "deleteUiSession",
    tag: "Authentication",
    response: z.void(),
    status: 204,
  },
  {
    method: "get",
    path: "/api/v1/health",
    operationId: "getHealth",
    tag: "System",
    response: HealthSchema,
  },
  {
    method: "get",
    path: "/api/v1/storage/health",
    operationId: "getStorageHealth",
    tag: "System",
    response: JsonObjectSchema,
  },
  {
    method: "get",
    path: "/api/v1/apps",
    operationId: "listApps",
    tag: "Apps",
    response: ListAppSchema,
    query: AppQuerySchema,
  },
  {
    method: "post",
    path: "/api/v1/apps",
    operationId: "createApp",
    tag: "Apps",
    response: AppSchema,
    body: AppCreateSchema,
    status: 201,
  },
  {
    method: "get",
    path: "/api/v1/apps/{appId}",
    operationId: "getApp",
    tag: "Apps",
    response: AppSchema,
    params: true,
  },
  {
    method: "patch",
    path: "/api/v1/apps/{appId}",
    operationId: "updateApp",
    tag: "Apps",
    response: AppSchema,
    body: AppPatchSchema,
    params: true,
  },
  {
    method: "delete",
    path: "/api/v1/apps/{appId}",
    operationId: "deleteApp",
    tag: "Apps",
    response: z.void(),
    params: true,
    status: 204,
  },
  {
    method: "post",
    path: "/api/v1/apps/{appId}/app-keys/rotate",
    operationId: "rotateAppKey",
    tag: "Apps",
    response: AppKeyRotationSchema,
    params: true,
  },
  {
    method: "get",
    path: "/api/v1/apps/{appId}/preview-profiles",
    operationId: "listPreviewProfiles",
    tag: "Preview Profiles",
    response: ListPreviewSchema,
    params: true,
  },
  {
    method: "post",
    path: "/api/v1/apps/{appId}/preview-profiles",
    operationId: "createPreviewProfile",
    tag: "Preview Profiles",
    response: PreviewProfileSchema,
    body: PreviewProfileCreateSchema,
    params: true,
    status: 201,
  },
  {
    method: "get",
    path: "/api/v1/apps/{appId}/preview-profiles/{profileId}",
    operationId: "getPreviewProfile",
    tag: "Preview Profiles",
    response: PreviewProfileSchema,
    params: true,
  },
  {
    method: "patch",
    path: "/api/v1/apps/{appId}/preview-profiles/{profileId}",
    operationId: "updatePreviewProfile",
    tag: "Preview Profiles",
    response: PreviewProfileSchema,
    body: PreviewProfilePatchSchema,
    params: true,
  },
  {
    method: "delete",
    path: "/api/v1/apps/{appId}/preview-profiles/{profileId}",
    operationId: "deletePreviewProfile",
    tag: "Preview Profiles",
    response: z.void(),
    params: true,
    status: 204,
  },
  {
    method: "get",
    path: "/api/v1/apps/{appId}/manifest",
    operationId: "getManifest",
    tag: "Manifest",
    response: JsonObjectSchema,
    params: true,
  },
  {
    method: "get",
    path: "/api/v1/apps/{appId}/manifest/revisions",
    operationId: "listManifestRevisions",
    tag: "Manifest",
    response: z.array(JsonObjectSchema),
    params: true,
  },
  {
    method: "get",
    path: "/api/v1/apps/{appId}/manifest/revisions/{revisionId}",
    operationId: "getManifestRevision",
    tag: "Manifest",
    response: JsonObjectSchema,
    params: true,
  },
  {
    method: "post",
    path: "/api/v1/apps/{appId}/manifest/sync",
    operationId: "syncManifest",
    tag: "Manifest",
    response: JsonObjectSchema,
    params: true,
  },
  {
    method: "post",
    path: "/api/v1/apps/{appId}/manifest/push",
    operationId: "pushManifest",
    tag: "Manifest",
    response: JsonObjectSchema,
    body: JsonObjectSchema,
    params: true,
    headers: AppKeyHeaderSchema,
  },
  ...resourceOperations("pages", "page"),
  ...resourceOperations("templates", "template"),
  {
    method: "get",
    path: "/api/v1/apps/{appId}/documents/{documentId}",
    operationId: "getDocument",
    tag: "Documents",
    response: DocumentSchema,
    params: true,
  },
  {
    method: "get",
    path: "/api/v1/apps/{appId}/documents/{documentId}/draft",
    operationId: "getDraft",
    tag: "Documents",
    response: JsonObjectSchema,
    params: true,
  },
  {
    method: "patch",
    path: "/api/v1/apps/{appId}/documents/{documentId}/draft",
    operationId: "updateDraft",
    tag: "Documents",
    response: JsonObjectSchema,
    body: DraftPatchSchema,
    params: true,
  },
  {
    method: "get",
    path: "/api/v1/apps/{appId}/documents/{documentId}/versions",
    operationId: "listVersions",
    tag: "Versions",
    response: z.array(VersionSchema),
    params: true,
  },
  {
    method: "post",
    path: "/api/v1/apps/{appId}/documents/{documentId}/versions",
    operationId: "createVersion",
    tag: "Versions",
    response: VersionSchema,
    body: VersionCreateSchema,
    params: true,
    status: 201,
  },
  {
    method: "get",
    path: "/api/v1/apps/{appId}/documents/{documentId}/versions/{versionId}",
    operationId: "getVersion",
    tag: "Versions",
    response: VersionSchema,
    params: true,
  },
  {
    method: "get",
    path: "/api/v1/apps/{appId}/documents/{documentId}/releases",
    operationId: "listReleases",
    tag: "Releases",
    response: z.array(ReleaseSchema),
    params: true,
  },
  {
    method: "post",
    path: "/api/v1/apps/{appId}/documents/{documentId}/releases",
    operationId: "createRelease",
    tag: "Releases",
    response: ReleaseSchema,
    body: ReleaseCreateSchema,
    params: true,
    status: 201,
  },
  {
    method: "get",
    path: "/api/v1/apps/{appId}/releases/{releaseId}",
    operationId: "getRelease",
    tag: "Releases",
    response: ReleaseSchema,
    params: true,
  },
  ...categoryOperations(),
  ...localeOperations(),
  {
    method: "get",
    path: "/api/v1/apps/{appId}/assets",
    operationId: "listAssets",
    tag: "Assets",
    response: ListAssetSchema,
    params: true,
  },
  {
    method: "post",
    path: "/api/v1/apps/{appId}/assets/upload-intents",
    operationId: "createUploadIntent",
    tag: "Assets",
    response: UploadIntentResponseSchema,
    body: UploadIntentSchema,
    params: true,
    status: 201,
  },
  {
    method: "get",
    path: "/api/v1/apps/{appId}/assets/{assetId}",
    operationId: "getAsset",
    tag: "Assets",
    response: AssetSchema,
    params: true,
  },
  {
    method: "post",
    path: "/api/v1/apps/{appId}/assets/{assetId}/complete",
    operationId: "completeAsset",
    tag: "Assets",
    response: AssetSchema,
    body: AssetCompleteSchema,
    params: true,
  },
  {
    method: "delete",
    path: "/api/v1/apps/{appId}/assets/{assetId}",
    operationId: "deleteAsset",
    tag: "Assets",
    response: z.void(),
    params: true,
    status: 204,
  },
  {
    method: "post",
    path: "/api/v1/apps/{appId}/studio-sessions",
    operationId: "createStudioSession",
    tag: "Studio Sessions",
    response: StudioSessionSchema,
    body: StudioSessionCreateSchema,
    params: true,
    status: 201,
  },
  {
    method: "get",
    path: "/api/v1/studio-sessions/{sessionId}/bootstrap",
    operationId: "bootstrapStudioSession",
    tag: "Studio Sessions",
    response: BootstrapSchema,
    params: true,
  },
  {
    method: "patch",
    path: "/api/v1/studio-sessions/{sessionId}/draft",
    operationId: "updateStudioDraft",
    tag: "Studio Sessions",
    response: JsonObjectSchema,
    body: DraftPatchSchema,
    params: true,
  },
  {
    method: "get",
    path: "/api/v1/runtime/apps/{appKey}/pages/{pageKey}",
    operationId: "getRuntimePage",
    tag: "Runtime",
    response: JsonObjectSchema,
    params: true,
  },
  {
    method: "get",
    path: "/api/v1/runtime/apps/{appKey}/releases/{releaseId}",
    operationId: "getRuntimeRelease",
    tag: "Runtime",
    response: JsonObjectSchema,
    params: true,
  },
];

for (const operation of operations.sort((a, b) => a.operationId.localeCompare(b.operationId))) {
  registry.registerPath({
    method: operation.method,
    path: operation.path,
    tags: [operation.tag],
    operationId: operation.operationId,
    request: {
      ...(operation.body
        ? { body: { required: true, content: { "application/json": { schema: operation.body } } } }
        : {}),
      ...(operation.params ? { params: pathParams(operation.path) } : {}),
      ...(operation.query ? { query: operation.query } : {}),
      ...(operation.headers ? { headers: operation.headers } : {}),
    },
    responses: {
      [String(operation.status ?? 200)]:
        operation.status === 204
          ? { description: "No Content" }
          : {
              description: "Successful response",
              content: { "application/json": { schema: operation.response } },
            },
      "400": problemResponse("Bad request"),
      "401": problemResponse("Authentication required"),
      "404": problemResponse("Resource not found"),
      "409": problemResponse("Resource conflict"),
      "422": problemResponse("Validation failed"),
      "500": problemResponse("Internal Server Error"),
    },
  });
}

function problemResponse(description: string) {
  return { description, content: { "application/problem+json": { schema: ProblemSchema } } };
}

function pathParams(path: string) {
  const shape: Record<string, z.ZodString> = {};
  for (const match of path.matchAll(/\{([^}]+)\}/g)) shape[match[1]] = z.string().min(1);
  return z.object(shape);
}

function resourceOperations(name: string, kind: "page" | "template"): Operation[] {
  const singular = kind === "page" ? "Page" : "Template";
  const schema = ResourceSchema;
  return [
    {
      method: "get",
      path: `/api/v1/apps/{appId}/${name}`,
      operationId: `list${singular}s`,
      tag: `${singular}s`,
      response: ListResourceSchema,
      params: true,
      query: ResourceQuerySchema,
    },
    {
      method: "post",
      path: `/api/v1/apps/{appId}/${name}`,
      operationId: `create${singular}`,
      tag: `${singular}s`,
      response: schema,
      body: ResourceCreateSchema,
      params: true,
      status: 201,
    },
    {
      method: "get",
      path: `/api/v1/apps/{appId}/${name}/{${kind}Id}`,
      operationId: `get${singular}`,
      tag: `${singular}s`,
      response: schema,
      params: true,
    },
    {
      method: "patch",
      path: `/api/v1/apps/{appId}/${name}/{${kind}Id}`,
      operationId: `update${singular}`,
      tag: `${singular}s`,
      response: schema,
      body: ResourcePatchSchema,
      params: true,
    },
    {
      method: "delete",
      path: `/api/v1/apps/{appId}/${name}/{${kind}Id}`,
      operationId: `delete${singular}`,
      tag: `${singular}s`,
      response: z.void(),
      params: true,
      status: 204,
    },
  ];
}

function categoryOperations(): Operation[] {
  return [
    {
      method: "get",
      path: "/api/v1/apps/{appId}/categories",
      operationId: "listCategories",
      tag: "Categories",
      response: ListCategorySchema,
      params: true,
    },
    {
      method: "post",
      path: "/api/v1/apps/{appId}/categories",
      operationId: "createCategory",
      tag: "Categories",
      response: CategorySchema,
      body: CategoryCreateSchema,
      params: true,
      status: 201,
    },
    {
      method: "get",
      path: "/api/v1/apps/{appId}/categories/{categoryId}",
      operationId: "getCategory",
      tag: "Categories",
      response: CategorySchema,
      params: true,
    },
    {
      method: "patch",
      path: "/api/v1/apps/{appId}/categories/{categoryId}",
      operationId: "updateCategory",
      tag: "Categories",
      response: CategorySchema,
      body: CategoryPatchSchema,
      params: true,
    },
    {
      method: "delete",
      path: "/api/v1/apps/{appId}/categories/{categoryId}",
      operationId: "deleteCategory",
      tag: "Categories",
      response: z.void(),
      params: true,
      status: 204,
    },
  ];
}

function localeOperations(): Operation[] {
  return [
    {
      method: "get",
      path: "/api/v1/apps/{appId}/locales",
      operationId: "listLocales",
      tag: "Locales",
      response: ListLocaleSchema,
      params: true,
    },
    {
      method: "post",
      path: "/api/v1/apps/{appId}/locales",
      operationId: "createLocale",
      tag: "Locales",
      response: LocaleSchema,
      body: LocaleCreateSchema,
      params: true,
      status: 201,
    },
    {
      method: "get",
      path: "/api/v1/apps/{appId}/locales/{localeId}",
      operationId: "getLocale",
      tag: "Locales",
      response: LocaleSchema,
      params: true,
    },
    {
      method: "patch",
      path: "/api/v1/apps/{appId}/locales/{localeId}",
      operationId: "updateLocale",
      tag: "Locales",
      response: LocaleSchema,
      body: LocalePatchSchema,
      params: true,
    },
    {
      method: "delete",
      path: "/api/v1/apps/{appId}/locales/{localeId}",
      operationId: "deleteLocale",
      tag: "Locales",
      response: z.void(),
      params: true,
      status: 204,
    },
  ];
}

export function getOperations(): readonly Operation[] {
  return operations;
}
