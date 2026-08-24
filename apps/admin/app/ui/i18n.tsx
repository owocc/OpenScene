"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { buildHref, parseLanguage, parseMode, type AdminLanguage } from "./navigation";

export const messages = {
  en: {
    apps: "Apps",
    system: "System",
    apiReference: "API reference",
    overview: "Overview",
    pages: "Pages",
    templates: "Templates",
    manifest: "Manifest",
    components: "Components",
    previewProfiles: "Preview profiles",
    assets: "Assets",
    categories: "Categories",
    locales: "Locales",
    openapiDocs: "OpenAPI docs",
    openApiName: "Name",
    openApiJson: "OpenAPI JSON",
    openApiJsonInvalid: "Invalid JSON: must be an object with paths",
    openApiEndpoints: "Endpoints",
    settings: "Settings",
    deployment: "Deployment",
    app: "App",
    selectApp: "Select an app",
    chooseApp: "Choose an app to continue",
    chooseAppDescription: "This page is scoped to an app. Select one from the app list first.",
    language: "Language",
    preferences: "Preferences",
    english: "English",
    chinese: "简体中文",
    signOut: "Sign out",
    signIn: "Sign in",
    managementToken: "Management token",
    continue: "Continue",
    loading: "Loading",
    save: "Save",
    cancel: "Cancel",
    create: "Create",
    edit: "Edit",
    delete: "Delete",
    refresh: "Refresh",
    search: "Search",
    status: "Status",
    actions: "Actions",
    moreOptions: "More options",
    setDefault: "Set as default",
    removeDefault: "Remove default",
    active: "Active",
    disabled: "Disabled",
    draft: "Draft",
    published: "Published",
    default: "Default",
    noResults: "No results",
    noResultsDescription: "There is nothing to show here yet.",
    details: "Details",
    versions: "Versions",
    releases: "Releases",
    previousPage: "Previous",
    nextPage: "Next",
    currentRevision: "Current revision",
    studio: "Open in Studio",
    copied: "Copied",
    created: "Created",
    updated: "Updated",
    deleted: "Deleted",
    serverDetail: "Server detail",
    notFound: "Resource not found",
    requestFailed: "The request failed",
    appKey: "App Key",
    rotateAppKey: "Rotate App Key",
    rotateAppKeyDescription: "Generate a replacement App Key for build and manifest publishing.",
    rotateAppKeyConfirmTitle: "Rotate App Key?",
    rotateAppKeyConfirmDescription:
      "Your current App Key will be revoked immediately. Builds and manifest publishing that use it will stop working.",
    appKeyRotated: "App Key rotated",
    appKeyRotatedDescription: "This replacement key is shown once. Copy it before closing.",

    ai: "AI",
    aiDescription: "Configure the global AI provider used by every app.",
    aiConfiguration: "AI Configuration",
    aiProvider: "Provider",
    aiModel: "Model",
    aiBaseUrl: "Base URL",
    aiApiKey: "API Key",
    aiApiKeySet: "Saved (enter a new key to replace)",
    aiApiKeyPlaceholder: "sk-...",
    aiApiKeyHint: "A key is already saved. Leave blank to keep it.",
    aiEnabled: "Enabled",
    aiTest: "Test connection",
    aiTestSuccess: "Connection successful.",
    aiTestFailed: "Connection failed",
    aiSaved: "AI configuration saved",
    aiConsumption: "Client consumption",
    aiConsumptionDescription:
      "Apps call the AI through a dedicated endpoint. Every request must include a valid App Key.",
    aiConsumptionHint: "Supports json, text and stream (SSE) response formats.",
  },
  "zh-CN": {
    apps: "应用",
    system: "系统",
    apiReference: "API 文档",
    overview: "概览",
    pages: "页面",
    templates: "模板",
    manifest: "Manifest",
    components: "组件",
    previewProfiles: "预览配置",
    assets: "资源",
    categories: "分类",
    locales: "语言",
    openapiDocs: "OpenAPI 文档",
    openApiName: "名称",
    openApiJson: "OpenAPI JSON",
    openApiJsonInvalid: "JSON 无效：必须为包含 paths 的对象",
    openApiEndpoints: "接口数",
    settings: "设置",
    deployment: "部署",
    app: "应用",
    selectApp: "选择应用",
    chooseApp: "选择一个应用继续",
    chooseAppDescription: "此页面属于某个应用，请先从应用列表中选择应用。",
    language: "语言",
    preferences: "偏好设置",
    english: "English",
    chinese: "简体中文",
    signOut: "退出登录",
    signIn: "登录",
    managementToken: "管理 Token",
    continue: "继续",
    loading: "加载中",
    save: "保存",
    cancel: "取消",
    create: "创建",
    edit: "编辑",
    delete: "删除",
    refresh: "刷新",
    search: "搜索",
    status: "状态",
    actions: "操作",
    moreOptions: "更多操作",
    setDefault: "设为默认",
    removeDefault: "取消默认",
    active: "启用",
    disabled: "停用",
    draft: "草稿",
    published: "已发布",
    default: "默认",
    noResults: "暂无结果",
    noResultsDescription: "这里还没有可展示的内容。",
    details: "详情",
    versions: "版本",
    releases: "发布",
    previousPage: "上一页",
    nextPage: "下一页",
    currentRevision: "当前修订",
    studio: "在 Studio 中打开",
    copied: "已复制",
    created: "已创建",
    updated: "已更新",
    deleted: "已删除",
    serverDetail: "服务端详情",
    notFound: "资源不存在",
    requestFailed: "请求失败",
    appKey: "应用密钥",
    rotateAppKey: "轮换应用密钥",
    rotateAppKeyDescription: "为构建和 Manifest 发布生成新的应用密钥。",
    rotateAppKeyConfirmTitle: "轮换应用密钥？",
    rotateAppKeyConfirmDescription:
      "当前应用密钥将立即失效。使用该密钥的构建和 Manifest 发布将无法继续。",
    appKeyRotated: "应用密钥已轮换",

    ai: "AI",
    aiDescription: "配置所有应用共用的全局 AI 提供商。",
    aiConfiguration: "AI 配置",
    aiProvider: "提供商",
    aiModel: "模型",
    aiBaseUrl: "Base URL",
    aiApiKey: "API 密钥",
    aiApiKeySet: "已保存（输入新密钥以替换）",
    aiApiKeyPlaceholder: "sk-...",
    aiApiKeyHint: "已保存密钥，留空以保留原密钥。",
    aiEnabled: "启用",
    aiTest: "测试连接",
    aiTestSuccess: "连接成功。",
    aiTestFailed: "连接失败",
    aiSaved: "AI 配置已保存",
    aiConsumption: "客户端调用",
    aiConsumptionDescription: "应用通过专用接口调用 AI，每次请求都必须携带有效的应用密钥。",
    aiConsumptionHint: "支持 json、text 与 stream（SSE）多种响应格式。",
    appKeyRotatedDescription: "此替换密钥仅显示一次，请在关闭前复制。",
  },
} as const;

export type MessageKey = keyof typeof messages.en;

export function useAdminContext() {
  const pathname = usePathname();
  const router = useRouter();
  const params = useSearchParams();
  const [cookieLanguage, setCookieLanguage] = useState<AdminLanguage | undefined>();
  const queryLanguage = parseLanguage(params.get("lang"));
  const language = queryLanguage ?? cookieLanguage ?? "en";
  const mode = parseMode(params.get("mode"));
  const appId = params.get("appId") || undefined;

  useEffect(() => {
    const cookieValue = document.cookie
      .split(";")
      .map((item) => item.trim().split("="))
      .find(([key]) => key === "openscene_admin_lang")?.[1];
    const saved = parseLanguage(cookieValue);
    setCookieLanguage(
      saved ?? (navigator.language.toLowerCase().startsWith("zh") ? "zh-CN" : "en"),
    );
  }, []);

  useEffect(() => {
    document.cookie = `openscene_admin_lang=${language}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }, [language]);

  const href = useCallback(
    (path: string, extra?: Record<string, string | undefined>) =>
      buildHref(path, { mode, lang: language, appId }, extra),
    [appId, language, mode],
  );

  const setLanguage = useCallback(
    (next: AdminLanguage) => {
      document.cookie = `openscene_admin_lang=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
      router.replace(buildHref(pathname, { mode, lang: next, appId }));
    },
    [appId, mode, pathname, router],
  );

  const dictionary = useMemo(() => messages[language], [language]);
  return { pathname, router, params, mode, language, appId, href, setLanguage, dictionary };
}

export function useI18n() {
  const { dictionary, language } = useAdminContext();
  return { lang: language, t: (key: MessageKey) => dictionary[key] };
}
