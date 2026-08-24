import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Code2,
  Edit2,
  ExternalLink,
  Eye,
  MoreVertical,
  Plus,
  Search,
  Settings2,
  Trash2,
  Zap,
} from "lucide-react";
import type { SceneDocument } from "@openscene/protocol";

import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { isRecord } from "@/core/document";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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

export interface ActionItem {
  key: string;
  title: string;
  description?: string;
  type: "setState" | "custom";
  isBuiltIn?: boolean;
  params?: Record<string, unknown>;
}

export interface ActionBindingReference {
  elementId: string;
  elementType: string;
  eventName: string; // e.g. "press"
  actionName: string;
  params?: Record<string, unknown>;
}

interface ActionsPanelProps {
  document?: SceneDocument;
  selectedId?: string | null;
  onSelectNode?: (nodeId: string | null) => void;
  bootstrap?: StudioBootstrap | null;
}

export function ActionsPanel({
  document: docProp,
  selectedId,
  onSelectNode,
  bootstrap: bootstrapProp,
}: ActionsPanelProps) {
  const { LL } = useI18n();
  const storeDocument = useStudioStore((s) => s.document);
  const storeBootstrap = useStudioStore((s) => s.bootstrap);
  const updateElement = useStudioStore((s) => s.updateElement);
  const showNotice = useStudioStore((s) => s.showNotice);

  const document = docProp ?? storeDocument;
  const bootstrap = bootstrapProp ?? storeBootstrap;

  const [searchQuery, setSearchQuery] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingAction, setEditingAction] = useState<ActionItem | null>(null);
  const [deletingAction, setDeletingAction] = useState<ActionItem | null>(null);
  const [inspectingRefsAction, setInspectingRefsAction] = useState<ActionItem | null>(null);

  // Form states
  const [formKey, setFormKey] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formType, setFormType] = useState<"setState" | "custom">("setState");
  const [formTargetVar, setFormTargetVar] = useState("");
  const [formTargetVal, setFormTargetVal] = useState<unknown>("__toggle__");
  const [formJsonText, setFormJsonText] = useState("");
  const [formKeyError, setFormKeyError] = useState<string | null>(null);

  // Custom user actions stored in document or local state
  const [customActions, setCustomActions] = useState<ActionItem[]>([
    {
      key: "toggleVisibility",
      title: "切换显示状态",
      description: "一键切换绑定的布尔状态变量显示与隐藏",
      type: "setState",
      params: { isVisible: "__toggle__" },
    },
  ]);

  // Extract available state variable keys
  const stateKeys = useMemo(
    () => Object.keys(document.spec.state ?? {}).filter((k) => k !== "i18n" && k !== "__scene"),
    [document.spec.state],
  );

  // Scan all element event bindings across the document
  const referencesMap = useMemo(() => {
    const map = new Map<string, ActionBindingReference[]>();
    const elements = document.spec.elements ?? {};

    for (const [elementId, element] of Object.entries(elements)) {
      const onMap = element.on as Record<string, unknown> | undefined;
      if (!onMap || !isRecord(onMap)) continue;

      for (const [eventName, rawAction] of Object.entries(onMap)) {
        let actionName = "custom";
        let params: Record<string, unknown> | undefined;

        if (typeof rawAction === "string") {
          actionName = rawAction;
        } else if (isRecord(rawAction)) {
          if (typeof rawAction.action === "string") {
            actionName = rawAction.action;
          } else if (typeof rawAction.name === "string") {
            actionName = rawAction.name;
          }
          if (isRecord(rawAction.params)) {
            params = rawAction.params as Record<string, unknown>;
          }
        }

        const ref: ActionBindingReference = {
          elementId,
          elementType: element.type,
          eventName,
          actionName,
          params,
        };

        const existing = map.get(actionName) ?? [];
        existing.push(ref);
        map.set(actionName, existing);
      }
    }
    return map;
  }, [document]);

  // Combined action list
  const allActions = useMemo<ActionItem[]>(() => {
    const list: ActionItem[] = [
      {
        key: "setState",
        title: "修改状态 (Set State)",
        description: "内置状态修改动作，支持按变量赋值或取反切换 (!toggle)",
        type: "setState",
        isBuiltIn: true,
      },
    ];

    // Manifest actions
    const manifestActions = bootstrap?.manifest?.actions;
    if (manifestActions && isRecord(manifestActions)) {
      for (const [key, actionMeta] of Object.entries(manifestActions)) {
        if (key === "setState") continue;
        const meta = isRecord(actionMeta) ? actionMeta : {};
        list.push({
          key,
          title: typeof meta.title === "string" ? meta.title : key,
          description: typeof meta.description === "string" ? meta.description : undefined,
          type: "custom",
          isBuiltIn: true,
        });
      }
    }

    // Custom actions
    for (const ca of customActions) {
      if (!list.some((item) => item.key === ca.key)) {
        list.push(ca);
      }
    }

    return list;
  }, [bootstrap?.manifest?.actions, customActions]);

  const filteredActions = useMemo(() => {
    if (!searchQuery.trim()) return allActions;
    const q = searchQuery.toLowerCase().trim();
    return allActions.filter(
      (a) =>
        a.key.toLowerCase().includes(q) ||
        a.title.toLowerCase().includes(q) ||
        (a.description && a.description.toLowerCase().includes(q)),
    );
  }, [allActions, searchQuery]);

  const openAddDialog = () => {
    setFormKey("");
    setFormTitle("");
    setFormDesc("");
    setFormType("setState");
    setFormTargetVar(stateKeys[0] || "isVisible");
    setFormTargetVal("__toggle__");
    setFormJsonText("");
    setFormKeyError(null);
    setIsAddOpen(true);
  };

  const openEditDialog = (action: ActionItem) => {
    setEditingAction(action);
    setFormKey(action.key);
    setFormTitle(action.title);
    setFormDesc(action.description ?? "");
    setFormType(action.type);
    if (action.params) {
      const firstKey = Object.keys(action.params)[0] || "";
      setFormTargetVar(firstKey);
      setFormTargetVal(action.params[firstKey]);
      setFormJsonText(JSON.stringify(action.params, null, 2));
    } else {
      setFormTargetVar(stateKeys[0] || "");
      setFormTargetVal("__toggle__");
      setFormJsonText("");
    }
    setFormKeyError(null);
  };

  const handleSaveAdd = () => {
    const trimmedKey = formKey.trim();
    if (!trimmedKey) {
      setFormKeyError(LL.panels.variables.invalidKey());
      return;
    }
    if (allActions.some((a) => a.key === trimmedKey)) {
      setFormKeyError(LL.panels.variables.duplicateKey());
      return;
    }

    let params: Record<string, unknown> | undefined;
    if (formType === "setState") {
      params = { [formTargetVar || "isVisible"]: formTargetVal };
    } else if (formJsonText.trim()) {
      try {
        params = JSON.parse(formJsonText);
      } catch {
        // invalid JSON
      }
    }

    const newItem: ActionItem = {
      key: trimmedKey,
      title: formTitle.trim() || trimmedKey,
      description: formDesc.trim() || undefined,
      type: formType,
      params,
    };

    setCustomActions((prev) => [...prev, newItem]);
    setIsAddOpen(false);
  };

  const handleSaveEdit = () => {
    if (!editingAction) return;

    let params: Record<string, unknown> | undefined;
    if (formType === "setState") {
      params = { [formTargetVar || "isVisible"]: formTargetVal };
    } else if (formJsonText.trim()) {
      try {
        params = JSON.parse(formJsonText);
      } catch {
        // ignore
      }
    }

    setCustomActions((prev) =>
      prev.map((a) =>
        a.key === editingAction.key
          ? {
              ...a,
              title: formTitle.trim() || a.key,
              description: formDesc.trim() || undefined,
              type: formType,
              params,
            }
          : a,
      ),
    );
    setEditingAction(null);
  };

  const handleDeleteAction = (action: ActionItem) => {
    setCustomActions((prev) => prev.filter((a) => a.key !== action.key));
    setDeletingAction(null);
  };

  const handleBindToSelectedNode = (action: ActionItem) => {
    if (!selectedId) {
      showNotice("请先在画布中选中一个组件");
      return;
    }

    updateElement(selectedId, (el) => {
      const on = { ...(el.on as Record<string, unknown> | undefined) };
      if (action.type === "setState" && action.params) {
        on.press = { action: "setState", params: action.params };
      } else {
        on.press = { action: action.key };
      }
      return { ...el, on } as typeof el;
    });

    showNotice(`已将动作 "${action.title}" 绑定至选中的组件 (#${selectedId})`);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex flex-col gap-2.5 border-b border-border/60 bg-muted/20 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Zap className="size-4 text-amber-500" />
            <span className="text-xs font-semibold text-foreground">
              {LL.panels.actions.title()}
            </span>
            <Badge variant="secondary" className="h-4 px-1.5 text-[10px] font-medium">
              {allActions.length}
            </Badge>
          </div>
          <Button
            size="xs"
            variant="default"
            className="h-6 gap-1 px-2 text-xs"
            onClick={openAddDialog}
          >
            <Plus className="size-3" />
            <span>{LL.panels.actions.addAction()}</span>
          </Button>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder={LL.panels.actions.searchPlaceholder()}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-7 pl-8 pr-2 text-xs"
          />
        </div>
      </div>

      {/* Action List */}
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <div className="flex flex-col gap-2">
          {filteredActions.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 p-6 text-center">
              <div className="mb-2.5 flex size-10 items-center justify-center rounded-full bg-amber-500/10 text-amber-500">
                <Zap className="size-5" />
              </div>
              <h4 className="text-xs font-semibold text-foreground">
                {searchQuery ? LL.toolbar.noComponents() : LL.panels.actions.emptyTitle()}
              </h4>
              <p className="mt-1 text-[11px] leading-4 text-muted-foreground max-w-[200px]">
                {searchQuery ? "" : LL.panels.actions.emptyDesc()}
              </p>
              {!searchQuery && (
                <Button
                  size="xs"
                  variant="outline"
                  className="mt-3.5 h-7 gap-1 text-xs"
                  onClick={openAddDialog}
                >
                  <Plus className="size-3" />
                  <span>{LL.panels.actions.addAction()}</span>
                </Button>
              )}
            </div>
          ) : (
            filteredActions.map((action) => {
              const refs = referencesMap.get(action.key) ?? [];
              const isBuiltIn = action.isBuiltIn;

              return (
                <div
                  key={action.key}
                  className={cn(
                    "group flex flex-col rounded-lg border p-2.5 shadow-xs transition-all hover:shadow-xs",
                    isBuiltIn
                      ? "border-amber-500/20 bg-amber-500/5 hover:border-amber-500/40"
                      : "border-border/60 bg-card hover:border-border",
                  )}
                >
                  {/* Top Row */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="font-mono text-xs font-semibold text-foreground truncate">
                        {action.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <Badge
                        variant="outline"
                        className={cn(
                          "h-4.5 gap-1 px-1.5 text-[10px] font-normal border",
                          isBuiltIn
                            ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            : "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400",
                        )}
                      >
                        <Zap className="size-2.5" />
                        <span>
                          {isBuiltIn
                            ? LL.panels.actions.builtInBadge()
                            : LL.panels.actions.customBadge()}
                        </span>
                      </Badge>

                      {/* References count badge */}
                      {refs.length > 0 ? (
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <button
                                type="button"
                                onClick={() => setInspectingRefsAction(action)}
                                className="inline-flex h-4.5 items-center gap-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 text-[10px] font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-colors cursor-pointer"
                              >
                                <span>{refs.length} refs</span>
                              </button>
                            }
                          />
                          <TooltipContent side="top" className="text-[10px]">
                            {LL.panels.actions.referencesCount({ count: refs.length })}
                          </TooltipContent>
                        </Tooltip>
                      ) : null}

                      {/* Actions Menu */}
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          className="inline-flex size-5.5 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                          aria-label="Action options"
                        >
                          <MoreVertical className="size-3.5" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40 text-xs">
                          {selectedId && (
                            <DropdownMenuItem onClick={() => handleBindToSelectedNode(action)}>
                              <Zap className="size-3.5 mr-2 text-amber-500" />
                              <span>绑定到选中组件</span>
                            </DropdownMenuItem>
                          )}
                          {!isBuiltIn && (
                            <DropdownMenuItem onClick={() => openEditDialog(action)}>
                              <Edit2 className="size-3.5 mr-2" />
                              <span>{LL.panels.actions.editAction()}</span>
                            </DropdownMenuItem>
                          )}
                          {refs.length > 0 && (
                            <DropdownMenuItem onClick={() => setInspectingRefsAction(action)}>
                              <Eye className="size-3.5 mr-2" />
                              <span>{LL.panels.actions.referencesTitle()}</span>
                            </DropdownMenuItem>
                          )}
                          {!isBuiltIn && <DropdownMenuSeparator />}
                          {!isBuiltIn && (
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setDeletingAction(action)}
                            >
                              <Trash2 className="size-3.5 mr-2" />
                              <span>{LL.panels.actions.deleteAction()}</span>
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* Key & Desc */}
                  <div className="mt-1 flex flex-col gap-0.5">
                    <span className="font-mono text-[10px] text-muted-foreground">
                      action: "{action.key}"
                    </span>
                    {action.description && (
                      <p className="text-[11px] leading-relaxed text-muted-foreground">
                        {action.description}
                      </p>
                    )}
                  </div>

                  {/* Quick Bind Button */}
                  {selectedId && (
                    <div className="mt-2 pt-1.5 border-t border-border/40 flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground">选中: #{selectedId}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        className="h-5 px-1.5 text-[10px] text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 cursor-pointer gap-1"
                        onClick={() => handleBindToSelectedNode(action)}
                      >
                        <Zap className="size-2.5" />
                        <span>绑定事件 (on.press)</span>
                      </Button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Create / Add Action Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
              <Zap className="size-4 text-amber-500" />
              <span>{LL.panels.actions.addAction()}</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              {LL.panels.actions.emptyDesc()}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3.5 py-2">
            <div className="grid gap-1.5">
              <label className="text-xs font-medium text-foreground">
                {LL.panels.actions.actionKey()}
              </label>
              <Input
                value={formKey}
                onChange={(e) => {
                  setFormKey(e.target.value);
                  setFormKeyError(null);
                }}
                placeholder={LL.panels.actions.actionKeyPlaceholder()}
                className={cn("h-8 font-mono text-xs", formKeyError && "border-destructive")}
                autoFocus
              />
              {formKeyError && <p className="text-[11px] text-destructive">{formKeyError}</p>}
            </div>

            <div className="grid gap-1.5">
              <label className="text-xs font-medium text-foreground">
                {LL.panels.actions.actionTitle()}
              </label>
              <Input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder={LL.panels.actions.actionTitlePlaceholder()}
                className="h-8 text-xs"
              />
            </div>

            <div className="grid gap-1.5">
              <label className="text-xs font-medium text-foreground">
                {LL.panels.actions.actionDesc()}
              </label>
              <Input
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                placeholder="动作执行的功能说明..."
                className="h-8 text-xs"
              />
            </div>

            <div className="grid gap-1.5">
              <label className="text-xs font-medium text-foreground">
                {LL.panels.actions.actionType()}
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg border p-2 text-xs font-medium transition-all",
                    formType === "setState"
                      ? "border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold"
                      : "border-border/60 bg-card hover:bg-muted/60 text-muted-foreground",
                  )}
                  onClick={() => setFormType("setState")}
                >
                  <Settings2 className="size-3.5" />
                  <span>{LL.panels.actions.typeSetState()}</span>
                </button>
                <button
                  type="button"
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg border p-2 text-xs font-medium transition-all",
                    formType === "custom"
                      ? "border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold"
                      : "border-border/60 bg-card hover:bg-muted/60 text-muted-foreground",
                  )}
                  onClick={() => setFormType("custom")}
                >
                  <Code2 className="size-3.5" />
                  <span>{LL.panels.actions.typeCustom()}</span>
                </button>
              </div>
            </div>

            {formType === "setState" ? (
              <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-muted/20 p-2.5">
                <div className="grid gap-1">
                  <label className="text-[11px] font-medium text-foreground">
                    {LL.panels.actions.targetVariable()}
                  </label>
                  <select
                    className="h-7 w-full font-mono text-xs bg-background rounded-lg border border-input px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                    value={formTargetVar}
                    onChange={(e) => setFormTargetVar(e.target.value)}
                  >
                    {stateKeys.map((key) => (
                      <option key={key} value={key}>
                        /{key}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-1">
                  <label className="text-[11px] font-medium text-foreground">
                    {LL.panels.actions.targetValue()}
                  </label>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant={formTargetVal === "__toggle__" ? "default" : "outline"}
                      size="xs"
                      className="h-6 text-[10px]"
                      onClick={() => setFormTargetVal("__toggle__")}
                    >
                      {LL.panels.actions.toggleOption()}
                    </Button>
                    <Button
                      type="button"
                      variant={formTargetVal === true ? "default" : "outline"}
                      size="xs"
                      className="h-6 text-[10px]"
                      onClick={() => setFormTargetVal(true)}
                    >
                      {LL.panels.actions.trueOption()}
                    </Button>
                    <Button
                      type="button"
                      variant={formTargetVal === false ? "default" : "outline"}
                      size="xs"
                      className="h-6 text-[10px]"
                      onClick={() => setFormTargetVal(false)}
                    >
                      {LL.panels.actions.falseOption()}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid gap-1">
                <label className="text-[11px] font-medium text-foreground">
                  {LL.panels.actions.paramsJson()}
                </label>
                <Textarea
                  value={formJsonText}
                  onChange={(e) => setFormJsonText(e.target.value)}
                  placeholder="{\n  \n}"
                  className="font-mono text-xs leading-relaxed"
                />
              </div>
            )}
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

      {/* Edit Action Dialog */}
      <Dialog
        open={editingAction !== null}
        onOpenChange={(open) => !open && setEditingAction(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
              <Edit2 className="size-4 text-amber-500" />
              <span>
                {LL.panels.actions.editAction()} ({editingAction?.key})
              </span>
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-3.5 py-2">
            <div className="grid gap-1.5">
              <label className="text-xs font-medium text-foreground">
                {LL.panels.actions.actionTitle()}
              </label>
              <Input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            <div className="grid gap-1.5">
              <label className="text-xs font-medium text-foreground">
                {LL.panels.actions.actionDesc()}
              </label>
              <Input
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            {formType === "setState" && (
              <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-muted/20 p-2.5">
                <div className="grid gap-1">
                  <label className="text-[11px] font-medium text-foreground">
                    {LL.panels.actions.targetVariable()}
                  </label>
                  <select
                    className="h-7 w-full font-mono text-xs bg-background rounded-lg border border-input px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                    value={formTargetVar}
                    onChange={(e) => setFormTargetVar(e.target.value)}
                  >
                    {stateKeys.map((key) => (
                      <option key={key} value={key}>
                        /{key}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-1">
                  <label className="text-[11px] font-medium text-foreground">
                    {LL.panels.actions.targetValue()}
                  </label>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant={formTargetVal === "__toggle__" ? "default" : "outline"}
                      size="xs"
                      className="h-6 text-[10px]"
                      onClick={() => setFormTargetVal("__toggle__")}
                    >
                      {LL.panels.actions.toggleOption()}
                    </Button>
                    <Button
                      type="button"
                      variant={formTargetVal === true ? "default" : "outline"}
                      size="xs"
                      className="h-6 text-[10px]"
                      onClick={() => setFormTargetVal(true)}
                    >
                      {LL.panels.actions.trueOption()}
                    </Button>
                    <Button
                      type="button"
                      variant={formTargetVal === false ? "default" : "outline"}
                      size="xs"
                      className="h-6 text-[10px]"
                      onClick={() => setFormTargetVal(false)}
                    >
                      {LL.panels.actions.falseOption()}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setEditingAction(null)}>
              {LL.panels.variables.cancel()}
            </Button>
            <Button size="sm" onClick={handleSaveEdit}>
              {LL.panels.variables.save()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Action Dialog */}
      <Dialog
        open={deletingAction !== null}
        onOpenChange={(open) => !open && setDeletingAction(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold text-destructive">
              <AlertTriangle className="size-4" />
              <span>{LL.panels.actions.confirmDeleteTitle()}</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              {deletingAction && (referencesMap.get(deletingAction.key)?.length ?? 0) > 0
                ? LL.panels.actions.confirmDeleteWithRefs({
                    name: deletingAction.title,
                    count: referencesMap.get(deletingAction.key)?.length ?? 0,
                  })
                : deletingAction
                  ? LL.panels.actions.confirmDelete({ name: deletingAction.title })
                  : ""}
            </DialogDescription>
          </DialogHeader>

          {deletingAction && (referencesMap.get(deletingAction.key)?.length ?? 0) > 0 && (
            <div className="max-h-36 overflow-auto rounded-lg border border-destructive/20 bg-destructive/5 p-2 text-xs">
              <div className="font-semibold text-destructive mb-1 text-[11px]">
                {LL.panels.actions.referencesTitle()}:
              </div>
              <ul className="space-y-1">
                {(referencesMap.get(deletingAction.key) ?? []).map((ref, idx) => (
                  <li
                    key={idx}
                    className="flex items-center justify-between rounded bg-background/60 px-1.5 py-0.5 font-mono text-[10px]"
                  >
                    <span>
                      {ref.elementType} ({ref.elementId}).on.{ref.eventName}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setDeletingAction(null)}>
              {LL.panels.variables.cancel()}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => deletingAction && handleDeleteAction(deletingAction)}
            >
              {LL.panels.variables.delete()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Inspect References Dialog */}
      <Dialog
        open={inspectingRefsAction !== null}
        onOpenChange={(open) => !open && setInspectingRefsAction(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
              <Eye className="size-4 text-amber-500" />
              <span>
                {LL.panels.actions.referencesTitle()} ({inspectingRefsAction?.title})
              </span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              {inspectingRefsAction &&
                LL.panels.actions.referencesCount({
                  count: referencesMap.get(inspectingRefsAction.key)?.length ?? 0,
                })}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-60 overflow-y-auto space-y-1.5 py-2">
            {(inspectingRefsAction ? (referencesMap.get(inspectingRefsAction.key) ?? []) : []).map(
              (ref, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-lg border border-border/60 bg-card p-2 text-xs"
                >
                  <div className="flex flex-col">
                    <span className="font-semibold text-foreground">{ref.elementType}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      #{ref.elementId} &bull; on.{ref.eventName}
                    </span>
                  </div>
                  {onSelectNode && (
                    <Button
                      variant="ghost"
                      size="xs"
                      className="h-6 px-1.5 text-primary"
                      onClick={() => {
                        onSelectNode(ref.elementId);
                        setInspectingRefsAction(null);
                      }}
                    >
                      <ExternalLink className="size-3 mr-1" />
                      <span>Select</span>
                    </Button>
                  )}
                </div>
              ),
            )}
          </div>

          <DialogFooter>
            <Button size="sm" onClick={() => setInspectingRefsAction(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
