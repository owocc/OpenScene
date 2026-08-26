import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Braces,
  Check,
  ChevronDown,
  Code2,
  Copy,
  Edit2,
  ExternalLink,
  Eye,
  FileCode,
  Globe,
  Hash,
  Image as ImageIcon,
  Layers,
  MoreVertical,
  Plus,
  Search,
  Sparkles,
  ToggleLeft,
  Trash2,
  Type,
  Variable as VariableIcon,
} from "lucide-react";
import type { SceneDocument } from "@openscene-ai/core";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import {
  convertVariableValue,
  findI18nReferences,
  findVariableReferences,
  getI18nDictionary,
  getI18nKeys,
  getStateVariables,
  isValidVariableKey,
  type JsonValue,
  type StateVariable,
  type StateVariableType,
  type VariableReference,
} from "@/core/document";
import { AssetPickerDialog } from "@/components/studio/asset-picker-dialog";
function formatDisplayString(val: unknown): string {
  if (typeof val === "string") return val;
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  return "";
}
const KNOWN_LOCALE_NAMES: Record<string, string> = {
  en: "English",
  "en-US": "English (US)",
  "en-GB": "English (UK)",
  ar: "العربية (Arabic)",
  "ar-SA": "العربية (Saudi Arabia)",
  "ar-EG": "العربية (Egypt)",
  zh: "中文",
  "zh-CN": "简体中文",
  "zh-TW": "繁體中文",
  "zh-HK": "繁體中文 (香港)",
  ja: "日本語",
  "ja-JP": "日本語",
  ko: "한국어",
  "ko-KR": "한국어",
  fr: "Français",
  "fr-FR": "Français",
  de: "Deutsch",
  "de-DE": "Deutsch",
  es: "Español",
  "es-ES": "Español",
  ru: "Русский",
  "ru-RU": "Русский",
  it: "Italiano",
  "it-IT": "Italiano",
  pt: "Português",
  "pt-BR": "Português (Brasil)",
  "pt-PT": "Português (Portugal)",
  hi: "हिन्दी (Hindi)",
  vi: "Tiếng Việt",
  th: "ไทย (Thai)",
  id: "Bahasa Indonesia",
};
export interface ServerLocaleOption {
  id?: string;
  code: string;
  name: string;
  isDefault?: boolean;
}

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
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
  onSetI18nValue?: (
    locale: string,
    key: string,
    value: string,
    defaultLocale?: string,
    allLocales?: string[],
  ) => void;
  onAddI18nKey?: (
    key: string,
    value: string,
    currentLocale?: string,
    defaultLocale?: string,
    allLocales?: string[],
  ) => void;
  onDeleteI18nKey?: (key: string) => void;
  onRenameI18nKey?: (oldKey: string, newKey: string) => void;
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
  asset: {
    label: "Asset",
    icon: ImageIcon,
    badgeClass: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
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
  onSetI18nValue: setI18nValProp,
  onAddI18nKey: addI18nKeyProp,
  onDeleteI18nKey: deleteI18nKeyProp,
  onRenameI18nKey: renameI18nKeyProp,
  onSelectNode,
  bootstrap: bootstrapProp,
}: VariablesPanelProps) {
  const { LL } = useI18n();
  const storeDocument = useStudioStore((s) => s.document);
  const storeSetVariable = useStudioStore((s) => s.setVariable);
  const storeDeleteVariable = useStudioStore((s) => s.deleteVariable);
  const storeRenameVariable = useStudioStore((s) => s.renameVariable);
  const storeSetI18nValue = useStudioStore((s) => s.setI18nValue);
  const storeAddI18nKey = useStudioStore((s) => s.addI18nKey);
  const storeDeleteI18nKey = useStudioStore((s) => s.deleteI18nKey);
  const storeRenameI18nKey = useStudioStore((s) => s.renameI18nKey);
  const showNotice = useStudioStore((s) => s.showNotice);
  const storeBootstrap = useStudioStore((s) => s.bootstrap);
  const bootstrap = bootstrapProp ?? storeBootstrap;

  const document = docProp ?? storeDocument;
  const setVariable = setVarProp ?? storeSetVariable;
  const deleteVariable = deleteVarProp ?? storeDeleteVariable;
  const renameVariable = renameVarProp ?? storeRenameVariable;
  const setI18nValue = setI18nValProp ?? storeSetI18nValue;
  const addI18nKey = addI18nKeyProp ?? storeAddI18nKey;
  const deleteI18nKey = deleteI18nKeyProp ?? storeDeleteI18nKey;
  const renameI18nKey = renameI18nKeyProp ?? storeRenameI18nKey;

  const [activeTab, setActiveTab] = useState<"variables" | "locales">("variables");
  const [searchQuery, setSearchQuery] = useState("");
  const [i18nSearchQuery, setI18nSearchQuery] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [copiedI18nKey, setCopiedI18nKey] = useState<string | null>(null);
  const [editingVar, setEditingVar] = useState<StateVariable | null>(null);
  const effectiveLocales = useMemo<ServerLocaleOption[]>(() => {
    const rawLocales = bootstrap?.locales;
    if (rawLocales && rawLocales.length > 0) {
      return rawLocales.map((l) => ({
        id: l.id,
        code: l.code,
        name: l.name || KNOWN_LOCALE_NAMES[l.code] || l.code,
        isDefault: l.isDefault,
      }));
    }

    const docI18n = document?.spec?.state?.i18n;
    const docI18nLocales =
      docI18n && typeof docI18n === "object" && !Array.isArray(docI18n) ? Object.keys(docI18n) : [];
    const allCodes = Array.from(new Set([...locales, ...docI18nLocales]));
    if (allCodes.length === 0) allCodes.push("en-US");

    return allCodes.map((code) => ({
      code,
      name: KNOWN_LOCALE_NAMES[code] || code,
      isDefault: code === "en" || code === "en-US",
    }));
  }, [bootstrap?.locales, locales, document?.spec?.state?.i18n]);

  const defaultLocaleOption = useMemo(() => {
    return (
      effectiveLocales.find((l) => l.isDefault) ||
      effectiveLocales[0] || {
        code: "en-US",
        name: "English (US)",
        isDefault: true,
      }
    );
  }, [effectiveLocales]);

  const defaultLocaleCode = defaultLocaleOption.code;
  const currentEditingLocale = locale || defaultLocaleCode;
  const allLocaleCodes = useMemo(() => effectiveLocales.map((l) => l.code), [effectiveLocales]);

  const i18nDictionary = useMemo(
    () => getI18nDictionary(document.spec.state as Record<string, unknown> | undefined),
    [document.spec.state],
  );

  const i18nKeys = useMemo(
    () =>
      getI18nKeys(document.spec.state as Record<string, unknown> | undefined, defaultLocaleCode),
    [document.spec.state, defaultLocaleCode],
  );

  const i18nReferencesMap = useMemo(() => {
    const map = new Map<string, VariableReference[]>();
    for (const key of i18nKeys) {
      map.set(key, findI18nReferences(document, key));
    }
    return map;
  }, [document, i18nKeys]);

  const filteredI18nKeys = useMemo(() => {
    if (!i18nSearchQuery.trim()) return i18nKeys;
    const q = i18nSearchQuery.toLowerCase().trim();
    return i18nKeys.filter((key) => {
      if (key.toLowerCase().includes(q)) return true;
      const currentVal = i18nDictionary[currentEditingLocale]?.[key];
      if (currentVal && currentVal.toLowerCase().includes(q)) return true;
      const defaultVal = i18nDictionary[defaultLocaleCode]?.[key];
      if (defaultVal && defaultVal.toLowerCase().includes(q)) return true;
      return false;
    });
  }, [i18nKeys, i18nSearchQuery, i18nDictionary, currentEditingLocale, defaultLocaleCode]);

  // i18n Dialog states
  const [isAddI18nOpen, setIsAddI18nOpen] = useState(false);
  const [renamingI18nKey, setRenamingI18nKey] = useState<string | null>(null);
  const [deletingI18nKeyName, setDeletingI18nKeyName] = useState<string | null>(null);
  const [inspectingI18nRefsKey, setInspectingI18nRefsKey] = useState<string | null>(null);
  const [i18nFormKey, setI18nFormKey] = useState("");
  const [i18nFormValue, setI18nFormValue] = useState("");
  const [i18nFormKeyError, setI18nFormKeyError] = useState<string | null>(null);
  // Dialog states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isAssetPickerOpen, setIsAssetPickerOpen] = useState(false);
  const [targetAssetVarKey, setTargetAssetVarKey] = useState<string | null>(null);
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
  const hasAssetBaseUrlVariable = useMemo(
    () => variables.some((v) => v.key === "asset_base_url"),
    [variables],
  );
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

  const handleCopyI18nPath = (key: string) => {
    const path = `/i18n/$lang/${key}`;
    void navigator.clipboard?.writeText(path);
    setCopiedI18nKey(key);
    showNotice(LL.panels.variables.i18nPathCopied());
    setTimeout(() => setCopiedI18nKey(null), 1500);
  };

  const openAddI18nDialog = () => {
    setI18nFormKey("");
    setI18nFormValue("");
    setI18nFormKeyError(null);
    setIsAddI18nOpen(true);
  };

  const openRenameI18nDialog = (key: string) => {
    setRenamingI18nKey(key);
    setI18nFormKey(key);
    setI18nFormKeyError(null);
  };

  const handleSaveAddI18n = () => {
    const trimmedKey = i18nFormKey.trim();
    if (!trimmedKey) {
      setI18nFormKeyError(LL.panels.variables.invalidKey());
      return;
    }
    if (i18nKeys.includes(trimmedKey)) {
      setI18nFormKeyError(LL.panels.variables.duplicateKey());
      return;
    }

    addI18nKey(trimmedKey, i18nFormValue, currentEditingLocale, defaultLocaleCode, allLocaleCodes);
    setIsAddI18nOpen(false);
  };

  const handleSaveRenameI18n = () => {
    if (!renamingI18nKey) return;
    const trimmedKey = i18nFormKey.trim();
    if (!trimmedKey || trimmedKey === renamingI18nKey) {
      setRenamingI18nKey(null);
      return;
    }
    if (i18nKeys.includes(trimmedKey) && trimmedKey !== renamingI18nKey) {
      setI18nFormKeyError(LL.panels.variables.duplicateKey());
      return;
    }

    renameI18nKey(renamingI18nKey, trimmedKey);
    setRenamingI18nKey(null);
  };

  const handleConfirmDeleteI18n = () => {
    if (!deletingI18nKeyName) return;
    deleteI18nKey(deletingI18nKeyName);
    setDeletingI18nKeyName(null);
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
          <div className="flex items-center gap-1.5 min-w-0">
            {activeTab === "variables" ? (
              <VariableIcon className="size-4 text-primary shrink-0" />
            ) : (
              <Globe className="size-4 text-primary shrink-0" />
            )}
            <span className="text-xs font-semibold text-foreground truncate">
              {activeTab === "variables"
                ? LL.panels.variables.variablesTab()
                : LL.panels.variables.localesTab()}
            </span>
            <Badge variant="secondary" className="h-4 px-1.5 text-[10px] font-medium shrink-0">
              {activeTab === "variables" ? variables.length : i18nKeys.length}
            </Badge>
          </div>
          {activeTab === "variables" && (
            <ButtonGroup className="shrink-0">
              <Button variant="default" onClick={openAddDialog}>
                <Plus />
                <span>{LL.panels.variables.addVariable()}</span>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="default"
                      className="px-2 border-l border-primary-foreground/20"
                      aria-label="More variable options"
                    >
                      <ChevronDown />
                    </Button>
                  }
                />
                <DropdownMenuContent align="end" className="w-56 text-xs">
                  <DropdownMenuItem
                    disabled={hasLangVariable}
                    onClick={() => {
                      if (hasLangVariable) return;
                      const initialCode = locale || effectiveLocales[0]?.code || "en-US";
                      setVariable("lang", initialCode);
                      onLocaleChange(initialCode);
                    }}
                  >
                    <Globe className="size-4 mr-2" />
                    <span>{LL.panels.variables.addLangVariable()}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={hasAssetBaseUrlVariable}
                    onClick={() => {
                      if (hasAssetBaseUrlVariable) return;
                      const defaultUrl = bootstrap?.preview?.url
                        ? new URL(bootstrap.preview.url).origin
                        : "";
                      setVariable("asset_base_url", defaultUrl);
                    }}
                  >
                    <ImageIcon className="size-4 mr-2" />
                    <span>{LL.panels.variables.addAssetBaseUrlVariable()}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </ButtonGroup>
          )}
          {activeTab === "locales" && (
            <Button variant="default" onClick={openAddI18nDialog}>
              <Plus />
              <span>{LL.panels.variables.addI18nKey()}</span>
            </Button>
          )}
        </div>
        {/* Tab switch */}
        <div className="grid grid-cols-2 gap-1 rounded-lg border border-border/60 bg-background/50 p-0.5">
          <button
            type="button"
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-md py-1 text-xs font-medium transition-all cursor-pointer",
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
              "flex items-center justify-center gap-1.5 rounded-md py-1 text-xs font-medium transition-all cursor-pointer",
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

        {activeTab === "locales" && (
          <div className="flex flex-col gap-2">
            {/* Locale Dropdown Selector */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium text-muted-foreground shrink-0">
                {LL.panels.variables.currentLocale()}:
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="flex flex-1 min-w-0 items-center justify-between gap-1.5 rounded-lg border border-border/80 bg-background px-2.5 py-1 text-xs font-medium text-foreground shadow-xs hover:bg-muted/60 transition-colors cursor-pointer"
                  aria-label={LL.panels.variables.selectLocale()}
                >
                  <div className="flex items-center gap-1.5 min-w-0 truncate">
                    <Globe className="size-3.5 text-primary shrink-0" />
                    <span className="truncate">
                      {effectiveLocales.find((l) => l.code === currentEditingLocale)?.name ||
                        currentEditingLocale}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                      ({currentEditingLocale})
                    </span>
                  </div>
                  <ChevronDown className="size-3 text-muted-foreground shrink-0 ml-1" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 text-xs">
                  {effectiveLocales.map((item) => {
                    const isSelected = currentEditingLocale === item.code;
                    const isDef = item.isDefault || item.code === defaultLocaleCode;
                    return (
                      <DropdownMenuItem
                        key={item.code}
                        className={cn(
                          "flex items-center justify-between gap-2 cursor-pointer py-1.5",
                          isSelected && "bg-accent font-medium",
                        )}
                        onClick={() => onLocaleChange(item.code)}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Globe
                            className={cn(
                              "size-3.5 shrink-0",
                              isSelected ? "text-primary" : "text-muted-foreground",
                            )}
                          />
                          <div className="flex flex-col min-w-0">
                            <span className="truncate text-xs">{item.name}</span>
                            <span className="font-mono text-[10px] text-muted-foreground">
                              {item.code}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {isDef && (
                            <Badge variant="secondary" className="h-4 px-1 text-[9px] font-normal">
                              {LL.panels.variables.defaultLocaleBadge()}
                            </Badge>
                          )}
                          {isSelected && <Check className="size-3.5 text-primary ml-1" />}
                        </div>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Search Input for i18n */}
            {i18nKeys.length > 0 && (
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder={LL.panels.variables.searchI18nPlaceholder()}
                  value={i18nSearchQuery}
                  onChange={(e) => setI18nSearchQuery(e.target.value)}
                  className="h-7 pl-8 pr-2 text-xs"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {activeTab === "locales" ? (
          /* i18n Content Key-Value Editor */
          <div className="flex flex-col gap-2">
            {filteredI18nKeys.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 p-6 text-center">
                <div className="mb-2.5 flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Globe className="size-5" />
                </div>
                <h4 className="text-xs font-semibold text-foreground">
                  {i18nSearchQuery
                    ? LL.toolbar.noComponents()
                    : LL.panels.variables.emptyI18nTitle()}
                </h4>
                <p className="mt-1 text-[11px] leading-4 text-muted-foreground max-w-[220px]">
                  {i18nSearchQuery ? "" : LL.panels.variables.emptyI18nDesc()}
                </p>
                {!i18nSearchQuery && (
                  <Button
                    size="xs"
                    variant="outline"
                    className="mt-3.5 h-7 gap-1 text-xs"
                    onClick={openAddI18nDialog}
                  >
                    <Plus className="size-3" />
                    <span>{LL.panels.variables.addI18nKey()}</span>
                  </Button>
                )}
              </div>
            ) : (
              filteredI18nKeys.map((key) => {
                const currentVal = i18nDictionary[currentEditingLocale]?.[key] ?? "";
                const defaultVal = i18nDictionary[defaultLocaleCode]?.[key] ?? "";
                const refs = i18nReferencesMap.get(key) ?? [];
                const isUntranslated =
                  currentEditingLocale !== defaultLocaleCode && !currentVal.trim();

                return (
                  <div
                    key={key}
                    className={cn(
                      "group flex flex-col gap-2 rounded-lg border p-2.5 shadow-xs transition-all hover:shadow-xs",
                      isUntranslated
                        ? "border-amber-500/30 bg-amber-500/5 hover:border-amber-500/50"
                        : "border-border/60 bg-card hover:border-border",
                    )}
                  >
                    {/* Top Row: Key, Copy, Refs, Status, Actions */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span className="font-mono text-xs font-semibold text-foreground truncate">
                          {key}
                        </span>
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <button
                                type="button"
                                onClick={() => handleCopyI18nPath(key)}
                                className="text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100 cursor-pointer"
                              >
                                {copiedI18nKey === key ? (
                                  <Check className="size-3 text-emerald-500" />
                                ) : (
                                  <Copy className="size-3" />
                                )}
                              </button>
                            }
                          />
                          <TooltipContent side="top" className="text-[10px]">
                            {LL.panels.variables.copyI18nPath()} (/i18n/$lang/{key})
                          </TooltipContent>
                        </Tooltip>
                      </div>

                      <div className="flex items-center gap-1">
                        {isUntranslated && (
                          <Badge
                            variant="outline"
                            className="h-4.5 px-1.5 text-[10px] font-normal border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                          >
                            {LL.panels.variables.untranslated()}
                          </Badge>
                        )}

                        {/* References count badge */}
                        {refs.length > 0 ? (
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <button
                                  type="button"
                                  onClick={() => setInspectingI18nRefsKey(key)}
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
                            aria-label="i18n key actions"
                          >
                            <MoreVertical className="size-3.5" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-36 text-xs">
                            <DropdownMenuItem onClick={() => openRenameI18nDialog(key)}>
                              <FileCode className="size-3.5 mr-2" />
                              <span>{LL.panels.variables.renameI18nKey()}</span>
                            </DropdownMenuItem>
                            {refs.length > 0 && (
                              <DropdownMenuItem onClick={() => setInspectingI18nRefsKey(key)}>
                                <Eye className="size-3.5 mr-2" />
                                <span>{LL.panels.variables.referencesTitle()}</span>
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setDeletingI18nKeyName(key)}
                            >
                              <Trash2 className="size-3.5 mr-2" />
                              <span>{LL.panels.variables.deleteI18nKey()}</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    {/* Value Input */}
                    <div className="flex flex-col gap-1">
                      <Input
                        value={currentVal}
                        onChange={(e) =>
                          setI18nValue(
                            currentEditingLocale,
                            key,
                            e.target.value,
                            defaultLocaleCode,
                            allLocaleCodes,
                          )
                        }
                        placeholder={
                          currentEditingLocale !== defaultLocaleCode && defaultVal
                            ? LL.panels.variables.fallbackHint({ val: defaultVal })
                            : LL.panels.variables.i18nValuePlaceholder()
                        }
                        className="h-8 text-xs bg-background/80"
                      />
                    </div>
                  </div>
                );
              })
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
                      ) : v.key === "asset_base_url" ? (
                        <div className="flex flex-col gap-1">
                          <Input
                            value={formatDisplayString(v.value)}
                            onChange={(e) => setVariable("asset_base_url", e.target.value)}
                            className="h-6.5 font-mono text-[11px] bg-muted/30"
                            placeholder="http://localhost:3000"
                          />
                          <span className="text-[10px] text-muted-foreground">
                            资源前缀基准地址，在运行时解析为内置变量 {"${/asset_base_url}"}
                          </span>
                        </div>
                      ) : v.type === "asset" ? (
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-1.5">
                            <Input
                              value={formatDisplayString(v.value)}
                              onChange={(e) => setVariable(v.key, e.target.value)}
                              className="h-6.5 font-mono text-[11px] bg-muted/30 flex-1"
                              placeholder="/assets/... or /api/v1/apps/.../raw"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="xs"
                              className="h-6.5 px-2 text-[10px] gap-1 shrink-0"
                              onClick={() => {
                                setTargetAssetVarKey(v.key);
                                setIsAssetPickerOpen(true);
                              }}
                            >
                              <ImageIcon className="size-3 text-primary" />
                              选择
                            </Button>
                          </div>
                          {v.value && typeof v.value === "string" ? (
                            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground bg-muted/20 px-1.5 py-0.5 rounded border border-border/30">
                              <span className="shrink-0">模板:</span>
                              <span className="font-mono text-primary truncate select-all">{`\${/asset_base_url}${v.value}`}</span>
                            </div>
                          ) : null}
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
                  [
                    "string",
                    "number",
                    "boolean",
                    "object",
                    "array",
                    "asset",
                    "null",
                  ] as StateVariableType[]
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

              {formType === "asset" && (
                <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-muted/20 p-2.5">
                  <div className="flex items-center gap-2">
                    <Input
                      value={formatDisplayString(formValue)}
                      onChange={(e) => setFormValue(e.target.value)}
                      placeholder="/assets/... or /api/v1/apps/.../raw"
                      className="h-8 text-xs font-mono flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 text-xs shrink-0"
                      onClick={() => {
                        setTargetAssetVarKey(null);
                        setIsAssetPickerOpen(true);
                      }}
                    >
                      <ImageIcon className="size-3.5 text-primary" />
                      选择资源
                    </Button>
                  </div>
                  {formValue && typeof formValue === "string" ? (
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground bg-background/80 p-1.5 rounded border border-border/40">
                      <span className="shrink-0 text-[10px]">模板引用:</span>
                      <code className="text-[10px] font-mono text-primary truncate select-all">
                        {`\${/asset_base_url}${formValue}`}
                      </code>
                    </div>
                  ) : null}
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
                  [
                    "string",
                    "number",
                    "boolean",
                    "object",
                    "array",
                    "asset",
                    "null",
                  ] as StateVariableType[]
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

              {formType === "asset" && (
                <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-muted/20 p-2.5">
                  <div className="flex items-center gap-2">
                    <Input
                      value={formatDisplayString(formValue)}
                      onChange={(e) => setFormValue(e.target.value)}
                      placeholder="/assets/... or /api/v1/apps/.../raw"
                      className="h-8 text-xs font-mono flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 text-xs shrink-0"
                      onClick={() => {
                        setTargetAssetVarKey(null);
                        setIsAssetPickerOpen(true);
                      }}
                    >
                      <ImageIcon className="size-3.5 text-primary" />
                      选择资源
                    </Button>
                  </div>
                  {formValue && typeof formValue === "string" ? (
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground bg-background/80 p-1.5 rounded border border-border/40">
                      <span className="shrink-0 text-[10px]">模板引用:</span>
                      <code className="text-[10px] font-mono text-primary truncate select-all">
                        {`\${/asset_base_url}${formValue}`}
                      </code>
                    </div>
                  ) : null}
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

      {/* Add i18n Key Dialog */}
      <Dialog open={isAddI18nOpen} onOpenChange={setIsAddI18nOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
              <Globe className="size-4 text-primary" />
              <span>{LL.panels.variables.addI18nKey()}</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              {LL.panels.variables.emptyI18nDesc()}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3.5 py-2">
            {/* Key Name */}
            <div className="grid gap-1.5">
              <label className="text-xs font-medium text-foreground">
                {LL.panels.variables.i18nKeyName()}
              </label>
              <Input
                value={i18nFormKey}
                onChange={(e) => {
                  setI18nFormKey(e.target.value);
                  setI18nFormKeyError(null);
                }}
                placeholder={LL.panels.variables.i18nKeyPlaceholder()}
                className={cn("h-8 font-mono text-xs", i18nFormKeyError && "border-destructive")}
                autoFocus
              />
              {i18nFormKeyError && (
                <p className="text-[11px] text-destructive">{i18nFormKeyError}</p>
              )}
            </div>

            {/* Content for current locale */}
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-foreground">
                  {LL.panels.variables.i18nKeyValue()}
                </label>
                <span className="font-mono text-[10px] text-muted-foreground">
                  ({currentEditingLocale})
                </span>
              </div>
              <Textarea
                value={i18nFormValue}
                onChange={(e) => setI18nFormValue(e.target.value)}
                placeholder={LL.panels.variables.i18nValuePlaceholder()}
                className="min-h-[80px] text-xs leading-relaxed"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setIsAddI18nOpen(false)}>
              {LL.panels.variables.cancel()}
            </Button>
            <Button size="sm" onClick={handleSaveAddI18n}>
              {LL.panels.variables.create()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename i18n Key Dialog */}
      <Dialog
        open={renamingI18nKey !== null}
        onOpenChange={(open) => !open && setRenamingI18nKey(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
              <FileCode className="size-4 text-primary" />
              <span>{LL.panels.variables.renameI18nKey()}</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              {LL.panels.variables.renameI18nKey()} (
              <span className="font-mono font-medium">{renamingI18nKey}</span>)
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3.5 py-2">
            <div className="grid gap-1.5">
              <label className="text-xs font-medium text-foreground">
                {LL.panels.variables.i18nKeyName()}
              </label>
              <Input
                value={i18nFormKey}
                onChange={(e) => {
                  setI18nFormKey(e.target.value);
                  setI18nFormKeyError(null);
                }}
                className={cn("h-8 font-mono text-xs", i18nFormKeyError && "border-destructive")}
                autoFocus
              />
              {i18nFormKeyError && (
                <p className="text-[11px] text-destructive">{i18nFormKeyError}</p>
              )}
            </div>

            {renamingI18nKey && (i18nReferencesMap.get(renamingI18nKey)?.length ?? 0) > 0 && (
              <div className="flex items-start gap-2 rounded-lg bg-sky-500/10 p-2.5 text-sky-600 dark:text-sky-400 border border-sky-500/20 text-xs">
                <Sparkles className="size-4 shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed">
                  {LL.panels.variables.referencesCount({
                    count: i18nReferencesMap.get(renamingI18nKey)?.length ?? 0,
                  })}
                  . All dynamic i18n bindings ($t) across elements will be migrated automatically.
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setRenamingI18nKey(null)}>
              {LL.panels.variables.cancel()}
            </Button>
            <Button size="sm" onClick={handleSaveRenameI18n}>
              {LL.panels.variables.save()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete i18n Key Dialog */}
      <Dialog
        open={deletingI18nKeyName !== null}
        onOpenChange={(open) => !open && setDeletingI18nKeyName(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold text-destructive">
              <AlertTriangle className="size-4" />
              <span>{LL.panels.variables.confirmDeleteI18nTitle()}</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              {deletingI18nKeyName && (i18nReferencesMap.get(deletingI18nKeyName)?.length ?? 0) > 0
                ? LL.panels.variables.confirmDeleteI18nWithRefs({
                    key: deletingI18nKeyName,
                    count: i18nReferencesMap.get(deletingI18nKeyName)?.length ?? 0,
                  })
                : deletingI18nKeyName
                  ? LL.panels.variables.confirmDeleteI18n({ key: deletingI18nKeyName })
                  : ""}
            </DialogDescription>
          </DialogHeader>
          {deletingI18nKeyName && (i18nReferencesMap.get(deletingI18nKeyName)?.length ?? 0) > 0 && (
            <div className="max-h-36 overflow-auto rounded-lg border border-destructive/20 bg-destructive/5 p-2 text-xs">
              <div className="font-semibold text-destructive mb-1 text-[11px]">
                {LL.panels.variables.referencesTitle()}:
              </div>
              <ul className="space-y-1">
                {(i18nReferencesMap.get(deletingI18nKeyName) ?? []).map((ref, idx) => (
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
            <Button variant="outline" size="sm" onClick={() => setDeletingI18nKeyName(null)}>
              {LL.panels.variables.cancel()}
            </Button>
            <Button variant="destructive" size="sm" onClick={handleConfirmDeleteI18n}>
              {LL.panels.variables.delete()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Inspect i18n References Dialog */}
      <Dialog
        open={inspectingI18nRefsKey !== null}
        onOpenChange={(open) => !open && setInspectingI18nRefsKey(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
              <Eye className="size-4 text-primary" />
              <span>
                {LL.panels.variables.referencesTitle()} ({inspectingI18nRefsKey})
              </span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              {inspectingI18nRefsKey &&
                LL.panels.variables.referencesCount({
                  count: i18nReferencesMap.get(inspectingI18nRefsKey)?.length ?? 0,
                })}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-60 overflow-y-auto space-y-1.5 py-2">
            {(inspectingI18nRefsKey
              ? (i18nReferencesMap.get(inspectingI18nRefsKey) ?? [])
              : []
            ).map((ref, idx) => (
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
                      className="h-6 px-1.5 text-primary cursor-pointer"
                      onClick={() => {
                        handleSelectReferenceElement(ref.elementId);
                        setInspectingI18nRefsKey(null);
                      }}
                    >
                      <ExternalLink className="size-3 mr-1" />
                      <span>Select</span>
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button size="sm" onClick={() => setInspectingI18nRefsKey(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AssetPickerDialog
        open={isAssetPickerOpen}
        onOpenChange={setIsAssetPickerOpen}
        onSelect={(_asset, path) => {
          if (targetAssetVarKey) {
            setVariable(targetAssetVarKey, path);
            setTargetAssetVarKey(null);
          } else {
            setFormValue(path);
          }
        }}
      />
    </div>
  );
}
