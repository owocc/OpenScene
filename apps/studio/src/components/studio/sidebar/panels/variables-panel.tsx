import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Braces,
  Check,
  Code2,
  Copy,
  Edit2,
  ExternalLink,
  Eye,
  FileCode,
  Globe,
  Hash,
  Layers,
  MoreVertical,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  ToggleLeft,
  Trash2,
  Type,
  Variable as VariableIcon,
} from "lucide-react";
import type { SceneDocument } from "@openscene/protocol";
import { createOpenSceneClient } from "@openscene/api-client";
import { useI18n } from "@/i18n";
import { useQueryStore } from "@/stores/query-store";
import { cn } from "@/lib/utils";
import {
  convertVariableValue,
  findVariableReferences,
  getStateVariables,
  isValidVariableKey,
  type JsonValue,
  type StateVariable,
  type StateVariableType,
  type VariableReference,
} from "@/core/document";

function formatDisplayString(val: unknown): string {
  if (typeof val === "string") return val;
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  return "";
}

const KNOWN_LOCALE_NAMES: Record<string, string> = {
  "en-US": "English (US)",
  "zh-CN": "简体中文",
  "zh-TW": "繁體中文",
  "ja-JP": "日本語",
  "ko-KR": "한국어",
  "fr-FR": "Français",
  "de-DE": "Deutsch",
  "es-ES": "Español",
  "ru-RU": "Русский",
  "it-IT": "Italiano",
  "pt-BR": "Português",
};

export interface ServerLocaleOption {
  id?: string;
  code: string;
  name: string;
  isDefault?: boolean;
}

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useStudioStore } from "@/stores/studio-store";
import type { StudioBootstrap } from "@/core/studio-bootstrap";

interface VariablesPanelProps {
  locale: string;
  locales: string[];
  onLocaleChange: (locale: string) => void;
  document?: SceneDocument;
  onSetVariable?: (key: string, value: unknown) => void;
  onDeleteVariable?: (key: string) => void;
  onRenameVariable?: (oldKey: string, newKey: string) => void;
  onSelectNode?: (nodeId: string | null) => void;
  bootstrap?: StudioBootstrap | null;
}

const TYPE_CONFIG: Record<
  StateVariableType,
  {
    label: string;
    icon: typeof Type;
    badgeClass: string;
  }
> = {
  string: {
    label: "String",
    icon: Type,
    badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  },
  number: {
    label: "Number",
    icon: Hash,
    badgeClass: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
  },
  boolean: {
    label: "Boolean",
    icon: ToggleLeft,
    badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  },
  object: {
    label: "Object",
    icon: Braces,
    badgeClass: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  },
  array: {
    label: "Array",
    icon: Layers,
    badgeClass: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
  },
  null: {
    label: "Null",
    icon: Code2,
    badgeClass: "bg-muted text-muted-foreground border-border",
  },
};
export function VariablesPanel({
  locale,
  locales,
  onLocaleChange,
  document: docProp,
  onSetVariable: setVarProp,
  onDeleteVariable: deleteVarProp,
  onRenameVariable: renameVarProp,
  onSelectNode,
  bootstrap: bootstrapProp,
}: VariablesPanelProps) {
  const { LL } = useI18n();
  const storeDocument = useStudioStore((s) => s.document);
  const storeSetVariable = useStudioStore((s) => s.setVariable);
  const storeDeleteVariable = useStudioStore((s) => s.deleteVariable);
  const storeRenameVariable = useStudioStore((s) => s.renameVariable);
  const showNotice = useStudioStore((s) => s.showNotice);
  const storeBootstrap = useStudioStore((s) => s.bootstrap);
  const bootstrap = bootstrapProp ?? storeBootstrap;

  const document = docProp ?? storeDocument;
  const setVariable = setVarProp ?? storeSetVariable;
  const deleteVariable = deleteVarProp ?? storeDeleteVariable;
  const renameVariable = renameVarProp ?? storeRenameVariable;

  const [activeTab, setActiveTab] = useState<"variables" | "locales">("variables");
  const [searchQuery, setSearchQuery] = useState("");
  const [localeSearchQuery, setLocaleSearchQuery] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [editingVar, setEditingVar] = useState<StateVariable | null>(null);
  // Server locales state
  const [serverLocales, setServerLocales] = useState<ServerLocaleOption[]>([]);
  const [isLoadingLocales, setIsLoadingLocales] = useState(false);

  const fetchServerLocales = useCallback(async () => {
    const query = useQueryStore.getState();
    const appId = bootstrap?.app?.id || query.appId;
    const serverUrl = query.serverUrl;
    const token = query.token;
    if (!appId || !serverUrl || !token || appId === "local-test-app") {
      return;
    }
    setIsLoadingLocales(true);
    try {
      const client = createOpenSceneClient({
        baseUrl: serverUrl.replace(/\/$/, ""),
        headers: { "x-openscene-session-token": token },
      });
      const { data, error, response } = await client.GET("/api/v1/apps/{appId}/locales", {
        params: { path: { appId } },
      });
      if (error || !Array.isArray(data)) {
        console.warn(
          "[OpenScene Studio] Failed to fetch server locales:",
          error || `Status ${response?.status}`,
        );
        return;
      }
      setServerLocales(
        data.map((item) => ({
          id: item.id,
          code: item.code,
          name: item.name,
          isDefault: item.isDefault,
        })),
      );
    } catch (err) {
      console.warn("[OpenScene Studio] Failed to fetch server locales:", err);
    } finally {
      setIsLoadingLocales(false);
    }
  }, [bootstrap?.app?.id]);

  useEffect(() => {
    void fetchServerLocales();
  }, [fetchServerLocales]);

  const effectiveLocales = useMemo<ServerLocaleOption[]>(() => {
    if (serverLocales.length > 0) {
      const list: ServerLocaleOption[] = serverLocales.map((l) => ({
        id: l.id,
        code: l.code,
        name: l.name || KNOWN_LOCALE_NAMES[l.code] || l.code,
        isDefault: l.isDefault,
      }));
      for (const code of locales) {
        if (!list.some((item) => item.code === code)) {
          list.push({
            code,
            name: KNOWN_LOCALE_NAMES[code] || code,
            isDefault: false,
          });
        }
      }
      return list;
    }

    return locales.map((code) => ({
      code,
      name: KNOWN_LOCALE_NAMES[code] || code,
      isDefault: code === "en-US",
    }));
  }, [serverLocales, locales]);

  const filteredLocales = useMemo(() => {
    if (!localeSearchQuery.trim()) return effectiveLocales;
    const q = localeSearchQuery.toLowerCase().trim();
    return effectiveLocales.filter(
      (l) => l.code.toLowerCase().includes(q) || l.name.toLowerCase().includes(q),
    );
  }, [effectiveLocales, localeSearchQuery]);

  // Dialog states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [renamingVar, setRenamingVar] = useState<StateVariable | null>(null);
  const [deletingVar, setDeletingVar] = useState<StateVariable | null>(null);
  const [inspectingRefsVar, setInspectingRefsVar] = useState<StateVariable | null>(null);

  // Expanded JSON previews
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  // Form states for Add / Edit
  const [formKey, setFormKey] = useState("");
  const [formType, setFormType] = useState<StateVariableType>("string");
  const [formValue, setFormValue] = useState<unknown>("");
  const [formJsonText, setFormJsonText] = useState("");
  const [formJsonError, setFormJsonError] = useState<string | null>(null);
  const [formKeyError, setFormKeyError] = useState<string | null>(null);

  // Extract non-reserved variables from spec.state
  const variables = useMemo(
    () => getStateVariables(document.spec.state as Record<string, unknown> | undefined),
    [document.spec.state],
  );

  const hasLangVariable = useMemo(() => variables.some((v) => v.key === "lang"), [variables]);
  // References map for each variable in document elements
  const referencesMap = useMemo(() => {
    const map = new Map<string, VariableReference[]>();
    for (const v of variables) {
      map.set(v.key, findVariableReferences(document, v.key));
    }
    return map;
  }, [document, variables]);

  const filteredVariables = useMemo(() => {
    if (!searchQuery.trim()) return variables;
    const query = searchQuery.toLowerCase().trim();
    return variables.filter((v) => {
      if (v.key.toLowerCase().includes(query)) return true;
      if (typeof v.value === "string" && v.value.toLowerCase().includes(query)) return true;
      if (typeof v.value === "number" && String(v.value).includes(query)) return true;
      return false;
    });
  }, [variables, searchQuery]);

  const handleCopyPath = (key: string) => {
    const path = `/${key}`;
    void navigator.clipboard?.writeText(path);
    setCopiedKey(key);
    showNotice(LL.panels.variables.pathCopied());
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const toggleExpand = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const openAddDialog = () => {
    setFormKey("");
    setFormType("string");
    setFormValue("");
    setFormJsonText("");
    setFormJsonError(null);
    setFormKeyError(null);
    setIsAddOpen(true);
  };

  const openEditDialog = (v: StateVariable) => {
    setEditingVar(v);
    setFormKey(v.key);
    setFormType(v.type);
    setFormValue(v.value);
    if (v.type === "object" || v.type === "array") {
      setFormJsonText(JSON.stringify(v.value, null, 2));
    } else {
      setFormJsonText("");
    }
    setFormJsonError(null);
    setFormKeyError(null);
  };

  const openRenameDialog = (v: StateVariable) => {
    setRenamingVar(v);
    setFormKey(v.key);
    setFormKeyError(null);
  };

  const handleTypeChange = (newType: StateVariableType) => {
    setFormType(newType);
    setFormJsonError(null);
    const converted = convertVariableValue(formValue, newType);
    setFormValue(converted);
    if (newType === "object" || newType === "array") {
      setFormJsonText(JSON.stringify(converted, null, 2));
    }
  };

  const handleFormatJson = () => {
    try {
      const parsed = JSON.parse(formJsonText);
      setFormJsonText(JSON.stringify(parsed, null, 2));
      setFormJsonError(null);
      setFormValue(parsed);
    } catch (err) {
      setFormJsonError(err instanceof Error ? err.message : LL.panels.variables.jsonInvalid());
    }
  };

  const handleSaveAdd = () => {
    const trimmedKey = formKey.trim();
    if (!trimmedKey) {
      setFormKeyError(LL.panels.variables.invalidKey());
      return;
    }
    if (!isValidVariableKey(trimmedKey)) {
      setFormKeyError(
        trimmedKey === "i18n" || trimmedKey === "lang" || trimmedKey === "__scene"
          ? LL.panels.variables.reservedKey()
          : LL.panels.variables.invalidKey(),
      );
      return;
    }
    if (variables.some((v) => v.key === trimmedKey)) {
      setFormKeyError(LL.panels.variables.duplicateKey());
      return;
    }

    let finalValue: JsonValue = formValue as JsonValue;
    if (formType === "object" || formType === "array") {
      try {
        finalValue = JSON.parse(formJsonText || (formType === "object" ? "{}" : "[]"));
      } catch (err) {
        setFormJsonError(err instanceof Error ? err.message : LL.panels.variables.jsonInvalid());
        return;
      }
    } else if (formType === "number") {
      finalValue = Number(formValue) || 0;
    } else if (formType === "boolean") {
      finalValue = Boolean(formValue);
    } else if (formType === "null") {
      finalValue = null;
    }

    setVariable(trimmedKey, finalValue);
    setIsAddOpen(false);
  };

  const handleSaveEdit = () => {
    if (!editingVar) return;

    let finalValue: JsonValue = formValue as JsonValue;
    if (formType === "object" || formType === "array") {
      try {
        finalValue = JSON.parse(formJsonText || (formType === "object" ? "{}" : "[]"));
      } catch (err) {
        setFormJsonError(err instanceof Error ? err.message : LL.panels.variables.jsonInvalid());
        return;
      }
    } else if (formType === "number") {
      finalValue = Number(formValue) || 0;
    } else if (formType === "boolean") {
      finalValue = Boolean(formValue);
    } else if (formType === "null") {
      finalValue = null;
    }

    setVariable(editingVar.key, finalValue);
    setEditingVar(null);
  };

  const handleSaveRename = () => {
    if (!renamingVar) return;
    const trimmedKey = formKey.trim();
    if (!trimmedKey || trimmedKey === renamingVar.key) {
      setRenamingVar(null);
      return;
    }
    if (!isValidVariableKey(trimmedKey)) {
      setFormKeyError(
        trimmedKey === "i18n" || trimmedKey === "lang" || trimmedKey === "__scene"
          ? LL.panels.variables.reservedKey()
          : LL.panels.variables.invalidKey(),
      );
      return;
    }
    if (variables.some((v) => v.key === trimmedKey && v.key !== renamingVar.key)) {
      setFormKeyError(LL.panels.variables.duplicateKey());
      return;
    }

    renameVariable(renamingVar.key, trimmedKey);
    setRenamingVar(null);
  };

  const handleDuplicate = (v: StateVariable) => {
    let newKey = `${v.key}_copy`;
    let count = 1;
    while (variables.some((item) => item.key === newKey)) {
      count += 1;
      newKey = `${v.key}_copy_${count}`;
    }
    setVariable(newKey, structuredClone(v.value));
  };

  const handleConfirmDelete = () => {
    if (!deletingVar) return;
    deleteVariable(deletingVar.key);
    setDeletingVar(null);
  };

  const handleSelectReferenceElement = (elementId: string) => {
    if (onSelectNode) {
      onSelectNode(elementId);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header & Tabs */}
      <div className="flex flex-col gap-2.5 border-b border-border/60 bg-muted/20 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <VariableIcon className="size-4 text-primary" />
            <span className="text-xs font-semibold text-foreground">
              {activeTab === "variables"
                ? LL.panels.variables.variablesTab()
                : LL.panels.variables.localesTab()}
            </span>
            <Badge variant="secondary" className="h-4 px-1.5 text-[10px] font-medium">
              {activeTab === "variables" ? variables.length : effectiveLocales.length}
            </Badge>
          </div>
          {activeTab === "variables" && (
            <div className="flex items-center gap-1.5">
              {!hasLangVariable && (
                <Button
                  size="xs"
                  variant="outline"
                  className="h-6 gap-1 px-1.5 text-[11px] border-sky-500/30 bg-sky-500/5 text-sky-600 dark:text-sky-400 hover:bg-sky-500/10"
                  onClick={() => {
                    const initialCode = locale || effectiveLocales[0]?.code || "en-US";
                    setVariable("lang", initialCode);
                    onLocaleChange(initialCode);
                  }}
                  title={LL.panels.variables.addLangVariable()}
                >
                  <Globe className="size-3" />
                  <span>{LL.panels.variables.addLangVariable()}</span>
                </Button>
              )}
              <Button
                size="xs"
                variant="default"
                className="h-6 gap-1 px-2 text-xs"
                onClick={openAddDialog}
              >
                <Plus className="size-3" />
                <span>{LL.panels.variables.addVariable()}</span>
              </Button>
            </div>
          )}
        </div>
        {/* Tab switch */}
        <div className="grid grid-cols-2 gap-1 rounded-lg border border-border/60 bg-background/50 p-0.5">
          <button
            type="button"
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-md py-1 text-xs font-medium transition-all",
              activeTab === "variables"
                ? "bg-background text-foreground shadow-xs shadow-slate-900/5 font-semibold"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setActiveTab("variables")}
          >
            <VariableIcon className="size-3.5" />
            <span>{LL.panels.variables.variablesTab()}</span>
          </button>
          <button
            type="button"
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-md py-1 text-xs font-medium transition-all",
              activeTab === "locales"
                ? "bg-background text-foreground shadow-xs shadow-slate-900/5 font-semibold"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setActiveTab("locales")}
          >
            <Globe className="size-3.5" />
            <span>{LL.panels.variables.localesTab()}</span>
          </button>
        </div>

        {activeTab === "variables" && variables.length > 0 && (
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder={LL.panels.variables.searchPlaceholder()}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-7 pl-8 pr-2 text-xs"
            />
          </div>
        )}

        {activeTab === "locales" && effectiveLocales.length > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder={LL.panels.variables.searchLocalesPlaceholder()}
                value={localeSearchQuery}
                onChange={(e) => setLocaleSearchQuery(e.target.value)}
                className="h-7 pl-8 pr-2 text-xs"
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
              onClick={() => void fetchServerLocales()}
              title={LL.panels.variables.refreshLocales()}
              disabled={isLoadingLocales}
            >
              <RotateCcw
                className={cn("size-3.5", isLoadingLocales && "animate-spin text-primary")}
              />
            </Button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {activeTab === "locales" ? (
          /* Locales / i18n switcher with server options */
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between px-0.5">
              <span className="text-xs font-medium text-muted-foreground">
                {serverLocales.length > 0
                  ? LL.panels.variables.serverLocalesTitle()
                  : LL.panels.variables.locales()}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {filteredLocales.length} / {effectiveLocales.length}
              </span>
            </div>

            {filteredLocales.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 p-6 text-center">
                <Globe className="size-5 text-muted-foreground mb-1.5 opacity-60" />
                <p className="text-xs text-muted-foreground">
                  {LL.panels.variables.noLocalesFound()}
                </p>
              </div>
            ) : (
              <div className="grid gap-1.5">
                {filteredLocales.map((item) => {
                  const isSelected = locale === item.code;
                  return (
                    <button
                      key={item.code}
                      type="button"
                      className={cn(
                        "flex items-center justify-between rounded-lg border p-2.5 text-xs transition-colors cursor-pointer text-left",
                        isSelected
                          ? "border-primary/50 bg-primary/10 font-semibold text-primary shadow-xs"
                          : "border-border/60 bg-card hover:bg-muted/60 text-foreground",
                      )}
                      onClick={() => onLocaleChange(item.code)}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Globe
                          className={cn(
                            "size-3.5 shrink-0",
                            isSelected ? "text-primary" : "text-muted-foreground opacity-70",
                          )}
                        />
                        <div className="flex flex-col min-w-0">
                          <span className="truncate">{item.name}</span>
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {item.code}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {item.isDefault && (
                          <Badge variant="secondary" className="h-4 px-1 text-[9px] font-normal">
                            {LL.panels.variables.defaultLocaleBadge()}
                          </Badge>
                        )}
                        {isSelected && <Check className="size-3.5 text-primary" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* Variables List */
          <div className="flex flex-col gap-2">
            {filteredVariables.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 p-6 text-center">
                <div className="mb-2.5 flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Sparkles className="size-5" />
                </div>
                <h4 className="text-xs font-semibold text-foreground">
                  {searchQuery ? LL.toolbar.noComponents() : LL.panels.variables.emptyStateTitle()}
                </h4>
                <p className="mt-1 text-[11px] leading-4 text-muted-foreground max-w-[200px]">
                  {searchQuery ? "" : LL.panels.variables.emptyStateDesc()}
                </p>
                {!searchQuery && (
                  <Button
                    size="xs"
                    variant="outline"
                    className="mt-3.5 h-7 gap-1 text-xs"
                    onClick={openAddDialog}
                  >
                    <Plus className="size-3" />
                    <span>{LL.panels.variables.addVariable()}</span>
                  </Button>
                )}
              </div>
            ) : (
              filteredVariables.map((v) => {
                const config = TYPE_CONFIG[v.type] ?? TYPE_CONFIG.string;
                const TypeIcon = config.icon;
                const refs = referencesMap.get(v.key) ?? [];
                const isExpanded = expandedKeys.has(v.key);
                const isComplex = v.type === "object" || v.type === "array";

                return (
                  <div
                    key={v.key}
                    className={cn(
                      "group flex flex-col rounded-lg border p-2.5 shadow-xs transition-all hover:shadow-xs",
                      v.key === "lang"
                        ? "border-sky-500/30 bg-sky-500/5 hover:border-sky-500/50"
                        : "border-border/60 bg-card hover:border-border",
                    )}
                  >
                    {/* Top Row: Key, Type/Badge, Refs, Actions */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span className="font-mono text-xs font-semibold text-foreground truncate">
                          {v.key}
                        </span>
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <button
                                type="button"
                                onClick={() => handleCopyPath(v.key)}
                                className="text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100 cursor-pointer"
                              >
                                {copiedKey === v.key ? (
                                  <Check className="size-3 text-emerald-500" />
                                ) : (
                                  <Copy className="size-3" />
                                )}
                              </button>
                            }
                          />
                          <TooltipContent side="top" className="text-[10px]">
                            {LL.panels.variables.copyPath()} ({v.path})
                          </TooltipContent>
                        </Tooltip>
                      </div>

                      <div className="flex items-center gap-1">
                        {v.key === "lang" ? (
                          <Badge
                            variant="outline"
                            className="h-4.5 gap-1 px-1.5 text-[10px] font-normal border border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400"
                          >
                            <Globe className="size-2.5" />
                            <span>{LL.panels.variables.langBadge()}</span>
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className={cn(
                              "h-4.5 gap-1 px-1.5 text-[10px] font-normal border",
                              config.badgeClass,
                            )}
                          >
                            <TypeIcon className="size-2.5" />
                            <span>{config.label}</span>
                          </Badge>
                        )}

                        {/* References count badge */}
                        {refs.length > 0 ? (
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <button
                                  type="button"
                                  onClick={() => setInspectingRefsVar(v)}
                                  className="inline-flex h-4.5 items-center gap-0.5 rounded-full border border-primary/30 bg-primary/10 px-1.5 text-[10px] font-medium text-primary hover:bg-primary/20 transition-colors cursor-pointer"
                                >
                                  <span>{refs.length} refs</span>
                                </button>
                              }
                            />
                            <TooltipContent side="top" className="text-[10px]">
                              {LL.panels.variables.referencesCount({ count: refs.length })}
                            </TooltipContent>
                          </Tooltip>
                        ) : null}

                        {/* Actions Menu */}
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            className="inline-flex size-5.5 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                            aria-label="Variable actions"
                          >
                            <MoreVertical className="size-3.5" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-36 text-xs">
                            {v.key !== "lang" && (
                              <>
                                <DropdownMenuItem onClick={() => openEditDialog(v)}>
                                  <Edit2 className="size-3.5 mr-2" />
                                  <span>{LL.panels.variables.editVariable()}</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openRenameDialog(v)}>
                                  <FileCode className="size-3.5 mr-2" />
                                  <span>{LL.panels.variables.renameVariable()}</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDuplicate(v)}>
                                  <Copy className="size-3.5 mr-2" />
                                  <span>{LL.panels.variables.duplicate()}</span>
                                </DropdownMenuItem>
                              </>
                            )}
                            {refs.length > 0 && (
                              <DropdownMenuItem onClick={() => setInspectingRefsVar(v)}>
                                <Eye className="size-3.5 mr-2" />
                                <span>{LL.panels.variables.referencesTitle()}</span>
                              </DropdownMenuItem>
                            )}
                            {v.key !== "lang" && <DropdownMenuSeparator />}
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setDeletingVar(v)}
                            >
                              <Trash2 className="size-3.5 mr-2" />
                              <span>{LL.panels.variables.deleteVariable()}</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    {/* Middle Row: Inline Value Editor / Preview */}
                    <div className="mt-2">
                      {v.key === "lang" ? (
                        <div className="flex flex-col gap-1">
                          <select
                            className="h-7 w-full font-mono text-xs bg-muted/40 rounded-lg border border-border/60 px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                            value={formatDisplayString(v.value)}
                            onChange={(e) => {
                              const nextCode = e.target.value;
                              setVariable("lang", nextCode);
                              onLocaleChange(nextCode);
                            }}
                          >
                            {effectiveLocales.map((item) => (
                              <option key={item.code} value={item.code}>
                                {item.name} ({item.code})
                                {item.isDefault
                                  ? ` - ${LL.panels.variables.defaultLocaleBadge()}`
                                  : ""}
                              </option>
                            ))}
                          </select>
                          <span className="text-[10px] text-muted-foreground">
                            {LL.panels.variables.langVariableDesc()}
                          </span>
                        </div>
                      ) : v.type === "boolean" ? (
                        <div className="flex items-center justify-between rounded-md bg-muted/40 px-2 py-1">
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {v.value === true ? "true" : "false"}
                          </span>
                          <Switch
                            checked={Boolean(v.value)}
                            onCheckedChange={(checked) => setVariable(v.key, checked)}
                            className="scale-75 origin-right"
                          />
                        </div>
                      ) : v.type === "string" ? (
                        <div className="flex items-center gap-1.5">
                          <Input
                            value={formatDisplayString(v.value)}
                            onChange={(e) => setVariable(v.key, e.target.value)}
                            className="h-6.5 font-mono text-[11px] bg-muted/30"
                            placeholder="empty string"
                          />
                        </div>
                      ) : v.type === "number" ? (
                        <div className="flex items-center gap-1.5">
                          <Input
                            type="number"
                            value={v.value === null || v.value === undefined ? "" : Number(v.value)}
                            onChange={(e) => {
                              const val = e.target.value === "" ? 0 : Number(e.target.value);
                              setVariable(v.key, isNaN(val) ? 0 : val);
                            }}
                            className="h-6.5 font-mono text-[11px] bg-muted/30"
                          />
                        </div>
                      ) : isComplex ? (
                        <div className="rounded-md border border-border/50 bg-muted/30 p-1.5 text-[11px]">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] text-muted-foreground">
                              {v.type === "array"
                                ? `${(v.value as unknown[])?.length ?? 0} items`
                                : `${Object.keys((v.value as object) ?? {}).length} keys`}
                            </span>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="xs"
                                className="h-5 px-1.5 text-[10px]"
                                onClick={() => toggleExpand(v.key)}
                              >
                                {isExpanded
                                  ? LL.panels.variables.collapseJson()
                                  : LL.panels.variables.expandJson()}
                              </Button>
                              <Button
                                variant="ghost"
                                size="xs"
                                className="h-5 px-1.5 text-[10px]"
                                onClick={() => openEditDialog(v)}
                              >
                                <Edit2 className="size-2.5 mr-1" />
                                <span>{LL.panels.variables.editVariable()}</span>
                              </Button>
                            </div>
                          </div>
                          {isExpanded ? (
                            <pre className="max-h-36 overflow-auto rounded bg-background/80 p-1.5 font-mono text-[10px] leading-relaxed text-foreground">
                              {JSON.stringify(v.value, null, 2)}
                            </pre>
                          ) : (
                            <div className="font-mono text-[10px] text-muted-foreground truncate">
                              {JSON.stringify(v.value)}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="font-mono text-[11px] text-muted-foreground italic px-1">
                          null
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
      {/* Add Variable Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
              <VariableIcon className="size-4 text-primary" />
              <span>{LL.panels.variables.addVariable()}</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              {LL.panels.variables.emptyStateDesc()}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3.5 py-2">
            {/* Key / Name */}
            <div className="grid gap-1.5">
              <label className="text-xs font-medium text-foreground">
                {LL.panels.variables.variableName()}
              </label>
              <Input
                value={formKey}
                onChange={(e) => {
                  setFormKey(e.target.value);
                  setFormKeyError(null);
                }}
                placeholder={LL.panels.variables.variableKeyPlaceholder()}
                className={cn("h-8 font-mono text-xs", formKeyError && "border-destructive")}
                autoFocus
              />
              {formKeyError && <p className="text-[11px] text-destructive">{formKeyError}</p>}
            </div>

            {/* Type selector */}
            <div className="grid gap-1.5">
              <label className="text-xs font-medium text-foreground">
                {LL.panels.variables.variableType()}
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  ["string", "number", "boolean", "object", "array", "null"] as StateVariableType[]
                ).map((t) => {
                  const cfg = TYPE_CONFIG[t];
                  const Icon = cfg.icon;
                  return (
                    <button
                      key={t}
                      type="button"
                      className={cn(
                        "flex items-center gap-1.5 rounded-lg border p-2 text-xs font-medium transition-all",
                        formType === t
                          ? "border-primary bg-primary/10 text-primary font-semibold"
                          : "border-border/60 bg-card hover:bg-muted/60 text-muted-foreground",
                      )}
                      onClick={() => handleTypeChange(t)}
                    >
                      <Icon className="size-3.5" />
                      <span>{cfg.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Value Editor */}
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-foreground">
                  {LL.panels.variables.variableValue()}
                </label>
                {(formType === "object" || formType === "array") && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    className="h-5 px-1.5 text-[10px]"
                    onClick={handleFormatJson}
                  >
                    {LL.panels.variables.formatJson()}
                  </Button>
                )}
              </div>

              {formType === "string" && (
                <Input
                  value={formatDisplayString(formValue)}
                  onChange={(e) => setFormValue(e.target.value)}
                  placeholder="value..."
                  className="h-8 text-xs"
                />
              )}

              {formType === "number" && (
                <Input
                  type="number"
                  value={formValue === "" ? "" : Number(formValue)}
                  onChange={(e) =>
                    setFormValue(e.target.value === "" ? "" : Number(e.target.value))
                  }
                  placeholder="0"
                  className="h-8 text-xs font-mono"
                />
              )}

              {formType === "boolean" && (
                <div className="flex items-center justify-between rounded-lg border border-border/60 p-2.5">
                  <span className="font-mono text-xs">{String(Boolean(formValue))}</span>
                  <Switch
                    checked={Boolean(formValue)}
                    onCheckedChange={(checked) => setFormValue(checked)}
                  />
                </div>
              )}

              {(formType === "object" || formType === "array") && (
                <div className="grid gap-1">
                  <Textarea
                    value={formJsonText}
                    onChange={(e) => {
                      setFormJsonText(e.target.value);
                      setFormJsonError(null);
                    }}
                    placeholder={formType === "object" ? "{\n  \n}" : "[\n  \n]"}
                    className={cn(
                      "min-h-[120px] font-mono text-xs leading-relaxed",
                      formJsonError && "border-destructive",
                    )}
                  />
                  {formJsonError && <p className="text-[11px] text-destructive">{formJsonError}</p>}
                </div>
              )}

              {formType === "null" && (
                <div className="rounded-lg border border-border/60 bg-muted/40 p-2.5 text-xs text-muted-foreground italic">
                  null
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setIsAddOpen(false)}>
              {LL.panels.variables.cancel()}
            </Button>
            <Button size="sm" onClick={handleSaveAdd}>
              {LL.panels.variables.create()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Variable Dialog */}
      <Dialog open={editingVar !== null} onOpenChange={(open) => !open && setEditingVar(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
              <Edit2 className="size-4 text-primary" />
              <span>
                {LL.panels.variables.editVariable()} ({editingVar?.key})
              </span>
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-3.5 py-2">
            {/* Type selector */}
            <div className="grid gap-1.5">
              <label className="text-xs font-medium text-foreground">
                {LL.panels.variables.variableType()}
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  ["string", "number", "boolean", "object", "array", "null"] as StateVariableType[]
                ).map((t) => {
                  const cfg = TYPE_CONFIG[t];
                  const Icon = cfg.icon;
                  return (
                    <button
                      key={t}
                      type="button"
                      className={cn(
                        "flex items-center gap-1.5 rounded-lg border p-2 text-xs font-medium transition-all",
                        formType === t
                          ? "border-primary bg-primary/10 text-primary font-semibold"
                          : "border-border/60 bg-card hover:bg-muted/60 text-muted-foreground",
                      )}
                      onClick={() => handleTypeChange(t)}
                    >
                      <Icon className="size-3.5" />
                      <span>{cfg.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Value editor */}
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-foreground">
                  {LL.panels.variables.variableValue()}
                </label>
                {(formType === "object" || formType === "array") && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    className="h-5 px-1.5 text-[10px]"
                    onClick={handleFormatJson}
                  >
                    {LL.panels.variables.formatJson()}
                  </Button>
                )}
              </div>

              {formType === "string" && (
                <Input
                  value={formatDisplayString(formValue)}
                  onChange={(e) => setFormValue(e.target.value)}
                  className="h-8 text-xs font-mono"
                />
              )}

              {formType === "number" && (
                <Input
                  type="number"
                  value={formValue === "" ? "" : Number(formValue)}
                  onChange={(e) =>
                    setFormValue(e.target.value === "" ? "" : Number(e.target.value))
                  }
                  className="h-8 text-xs font-mono"
                />
              )}

              {formType === "boolean" && (
                <div className="flex items-center justify-between rounded-lg border border-border/60 p-2.5">
                  <span className="font-mono text-xs">{String(Boolean(formValue))}</span>
                  <Switch
                    checked={Boolean(formValue)}
                    onCheckedChange={(checked) => setFormValue(checked)}
                  />
                </div>
              )}

              {(formType === "object" || formType === "array") && (
                <div className="grid gap-1">
                  <Textarea
                    value={formJsonText}
                    onChange={(e) => {
                      setFormJsonText(e.target.value);
                      setFormJsonError(null);
                    }}
                    className={cn(
                      "min-h-[140px] font-mono text-xs leading-relaxed",
                      formJsonError && "border-destructive",
                    )}
                  />
                  {formJsonError && <p className="text-[11px] text-destructive">{formJsonError}</p>}
                </div>
              )}

              {formType === "null" && (
                <div className="rounded-lg border border-border/60 bg-muted/40 p-2.5 text-xs text-muted-foreground italic">
                  null
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setEditingVar(null)}>
              {LL.panels.variables.cancel()}
            </Button>
            <Button size="sm" onClick={handleSaveEdit}>
              {LL.panels.variables.save()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Variable Dialog */}
      <Dialog open={renamingVar !== null} onOpenChange={(open) => !open && setRenamingVar(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
              <FileCode className="size-4 text-primary" />
              <span>{LL.panels.variables.renameVariable()}</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              {LL.panels.variables.renameVariable()} (
              <span className="font-mono font-medium">{renamingVar?.key}</span>)
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3.5 py-2">
            <div className="grid gap-1.5">
              <label className="text-xs font-medium text-foreground">
                {LL.panels.variables.variableName()}
              </label>
              <Input
                value={formKey}
                onChange={(e) => {
                  setFormKey(e.target.value);
                  setFormKeyError(null);
                }}
                className={cn("h-8 font-mono text-xs", formKeyError && "border-destructive")}
                autoFocus
              />
              {formKeyError && <p className="text-[11px] text-destructive">{formKeyError}</p>}
            </div>

            {renamingVar && (referencesMap.get(renamingVar.key)?.length ?? 0) > 0 && (
              <div className="flex items-start gap-2 rounded-lg bg-sky-500/10 p-2.5 text-sky-600 dark:text-sky-400 border border-sky-500/20 text-xs">
                <Sparkles className="size-4 shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed">
                  {LL.panels.variables.referencesCount({
                    count: referencesMap.get(renamingVar.key)?.length ?? 0,
                  })}
                  . All dynamic bindings ($state, $bindState, and templates) will be migrated
                  automatically.
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setRenamingVar(null)}>
              {LL.panels.variables.cancel()}
            </Button>
            <Button size="sm" onClick={handleSaveRename}>
              {LL.panels.variables.save()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Variable Confirmation Dialog */}
      <Dialog open={deletingVar !== null} onOpenChange={(open) => !open && setDeletingVar(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold text-destructive">
              <AlertTriangle className="size-4" />
              <span>{LL.panels.variables.confirmDeleteTitle()}</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              {deletingVar?.key === "lang"
                ? LL.panels.variables.confirmDeleteLang()
                : deletingVar && (referencesMap.get(deletingVar.key)?.length ?? 0) > 0
                  ? LL.panels.variables.confirmDeleteWithRefs({
                      name: deletingVar.key,
                      count: referencesMap.get(deletingVar.key)?.length ?? 0,
                    })
                  : deletingVar
                    ? LL.panels.variables.confirmDelete({ name: deletingVar.key })
                    : ""}
            </DialogDescription>
          </DialogHeader>
          {deletingVar && (referencesMap.get(deletingVar.key)?.length ?? 0) > 0 && (
            <div className="max-h-36 overflow-auto rounded-lg border border-destructive/20 bg-destructive/5 p-2 text-xs">
              <div className="font-semibold text-destructive mb-1 text-[11px]">
                {LL.panels.variables.referencesTitle()}:
              </div>
              <ul className="space-y-1">
                {(referencesMap.get(deletingVar.key) ?? []).map((ref, idx) => (
                  <li
                    key={idx}
                    className="flex items-center justify-between rounded bg-background/60 px-1.5 py-0.5 font-mono text-[10px]"
                  >
                    <span>
                      {ref.elementType} ({ref.elementId}).{ref.property}
                    </span>
                    <Badge variant="outline" className="text-[9px] h-4">
                      {ref.kind}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setDeletingVar(null)}>
              {LL.panels.variables.cancel()}
            </Button>
            <Button variant="destructive" size="sm" onClick={handleConfirmDelete}>
              {LL.panels.variables.delete()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Inspect References Dialog */}
      <Dialog
        open={inspectingRefsVar !== null}
        onOpenChange={(open) => !open && setInspectingRefsVar(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
              <Eye className="size-4 text-primary" />
              <span>
                {LL.panels.variables.referencesTitle()} ({inspectingRefsVar?.key})
              </span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              {inspectingRefsVar &&
                LL.panels.variables.referencesCount({
                  count: referencesMap.get(inspectingRefsVar.key)?.length ?? 0,
                })}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-60 overflow-y-auto space-y-1.5 py-2">
            {(inspectingRefsVar ? (referencesMap.get(inspectingRefsVar.key) ?? []) : []).map(
              (ref, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-lg border border-border/60 bg-card p-2 text-xs"
                >
                  <div className="flex flex-col">
                    <span className="font-semibold text-foreground">{ref.elementType}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {ref.elementId} &bull; {ref.property}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="secondary" className="text-[10px] h-4.5 font-mono">
                      {ref.kind}
                    </Badge>
                    {onSelectNode && (
                      <Button
                        variant="ghost"
                        size="xs"
                        className="h-6 px-1.5 text-primary"
                        onClick={() => {
                          handleSelectReferenceElement(ref.elementId);
                          setInspectingRefsVar(null);
                        }}
                      >
                        <ExternalLink className="size-3 mr-1" />
                        <span>Select</span>
                      </Button>
                    )}
                  </div>
                </div>
              ),
            )}
          </div>

          <DialogFooter>
            <Button size="sm" onClick={() => setInspectingRefsVar(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
