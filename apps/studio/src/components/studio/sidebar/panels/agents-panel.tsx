import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Astroid,
  Check,
  ChevronDown,
  Code2,
  Copy,
  Edit2,
  FileText,
  Image as ImageIcon,
  List,
  MessageSquare,
  MoreVertical,
  MousePointerClick,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import {
  applyAgentUiActionsToDocument,
  splitContentAndUiActions,
  type AgentUiAction,
  type SceneDocument,
} from "@openscene/protocol";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { MarkdownContent } from "./markdown-content";
import { ShineBorder } from "@/components/ui/shine-border";
import { useStudioStore } from "@/stores/studio-store";
import { useAgentChatStore } from "@/stores/agent-chat-store";
import { Button } from "@/components/ui/button";
import {
  Attachment as PromptAttachment,
  AttachmentName,
  AttachmentPreview,
  AttachmentRemove,
  Attachments as PromptAttachments,
} from "@/components/ai-elements/attachments";
import {
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorEmpty,
  ModelSelectorGroup,
  ModelSelectorInput,
  ModelSelectorItem,
  ModelSelectorList,
  ModelSelectorLogo,
  ModelSelectorName,
  ModelSelectorTrigger,
} from "@/components/ai-elements/model-selector";
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionAddScreenshot,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  PromptInputProvider,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  usePromptInputAttachments,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Attachment,
  AttachmentContent,
  AttachmentDescription,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
} from "@/components/ui/attachment";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
interface AgentsPanelProps {
  appKey: string;
  manifestVersion: string;
  componentsCount: number;
  valid: boolean;
  revision: number;
  diagnostics: Array<{ message: string }>;
  document?: SceneDocument;
  selectedId?: string | null;
  onSelectNode?: (nodeId: string | null) => void;
  onApplyAgentActions?: (actions: AgentUiAction[]) => void;
}

function PromptInputAttachmentsDisplay({
  selectedElement,
  selectedId,
  attachSelectedElement,
  onDetachElement,
  onSelectElement,
}: {
  selectedElement: { type: string } | null;
  selectedId: string | null;
  attachSelectedElement: boolean;
  onDetachElement: () => void;
  onSelectElement?: (nodeId: string | null) => void;
}) {
  const attachments = usePromptInputAttachments();
  const handleRemove = (id: string) => attachments.remove(id);

  const hasElement = attachSelectedElement && selectedElement && selectedId;
  if (attachments.files.length === 0 && !hasElement) {
    return null;
  }

  return (
    <PromptAttachments variant="inline">
      {hasElement && (
        <PromptAttachment
          data={{
            id: `elem_${selectedId}`,
            type: "element",
            filename: `#${selectedId}`,
          }}
          onRemove={onDetachElement}
          className="cursor-pointer hover:bg-muted/80 transition-all"
          onClick={() => onSelectElement?.(selectedId)}
        >
          <AttachmentPreview />
          <AttachmentName />
          <AttachmentRemove />
        </PromptAttachment>
      )}
      {attachments.files.map((attachment) => (
        <PromptAttachment
          data={attachment}
          key={attachment.id}
          onRemove={() => handleRemove(attachment.id)}
        >
          <AttachmentPreview />
          <AttachmentName />
          <AttachmentRemove />
        </PromptAttachment>
      ))}
    </PromptAttachments>
  );
}
function summarizeAndDeduplicateActions(actions: AgentUiAction[]) {
  const map = new Map<
    string,
    {
      id: string;
      action: AgentUiAction["action"];
      componentType?: string;
      targetParentId?: string;
      mergedProps: Record<string, unknown>;
      elementSpec?: Record<string, unknown>;
    }
  >();
  let replaceAction: AgentUiAction | null = null;

  for (const act of actions) {
    if (act.action === "replace_document") {
      replaceAction = act;
      continue;
    }

    const elementId =
      act.action === "insert_element" ? act.elementId || act.element.id || "new" : act.elementId;

    if (!elementId) continue;

    const existing = map.get(elementId);
    if (!existing) {
      const initialProps =
        act.action === "update_element" && act.patch?.props
          ? { ...(act.patch.props as Record<string, unknown>) }
          : {};
      map.set(elementId, {
        id: elementId,
        action: act.action,
        componentType: act.action === "insert_element" ? act.element.type : undefined,
        targetParentId: act.action === "insert_element" ? act.target?.parentId : undefined,
        mergedProps: initialProps,
        elementSpec:
          act.action === "insert_element" ? (act.element as Record<string, unknown>) : undefined,
      });
    } else {
      if (act.action === "update_element" && act.patch?.props) {
        Object.assign(existing.mergedProps, act.patch.props as Record<string, unknown>);
      }
      if (act.action === "delete_element") {
        existing.action = "delete_element";
      }
    }
  }

  const list: Array<{
    id: string;
    action: AgentUiAction["action"];
    label: string;
    details: string;
    badgeColor: string;
    badgeText: string;
  }> = [];

  if (replaceAction && replaceAction.action === "replace_document") {
    list.push({
      id: "document",
      action: "replace_document",
      label: "Canvas Document",
      details: `Replaced full document (${Object.keys(replaceAction.document.spec.elements).length} elements)`,
      badgeColor: "text-blue-500",
      badgeText: "Replace",
    });
  }

  for (const item of map.values()) {
    if (item.action === "insert_element") {
      list.push({
        id: item.id,
        action: item.action,
        label: `#${item.id}`,
        details: item.elementSpec
          ? JSON.stringify(item.elementSpec, null, 2)
          : `Inserted into #${item.targetParentId || "root"}`,
        badgeColor: "text-emerald-500",
        badgeText: "+ Insert",
      });
    } else if (item.action === "update_element") {
      const hasProps = Object.keys(item.mergedProps).length > 0;
      list.push({
        id: item.id,
        action: item.action,
        label: `#${item.id}`,
        details: hasProps
          ? JSON.stringify(item.mergedProps, null, 2)
          : "Element properties updated",
        badgeColor: "text-amber-500",
        badgeText: "~ Edit",
      });
    } else if (item.action === "delete_element") {
      list.push({
        id: item.id,
        action: item.action,
        label: `#${item.id}`,
        details: `Deleted element #${item.id} from canvas`,
        badgeColor: "text-destructive",
        badgeText: "- Delete",
      });
    }
  }

  return {
    items: list,
    replaceAction,
    uniqueCount: list.length,
    insertCount: list.filter((x) => x.action === "insert_element").length,
    updateCount: list.filter((x) => x.action === "update_element").length,
    deleteCount: list.filter((x) => x.action === "delete_element").length,
  };
}
export function AgentsPanel({
  appKey,
  manifestVersion,
  componentsCount,
  valid,
  revision,
  diagnostics,
  document,
  selectedId,
  onSelectNode,
  onApplyAgentActions,
}: AgentsPanelProps) {
  const { LL } = useI18n();
  const bootstrap = useStudioStore((s) => s.bootstrap);
  const {
    sessions,
    activeSessionId,
    isStreaming,
    error,
    createSession,
    deleteSession,
    setActiveSession,
    setSessionPrompt,
    renameSession,
    clearSessionMessages,
    sendMessage,
    stopStreaming,
  } = useAgentChatStore();

  const [viewMode, setViewMode] = useState<"chat" | "sessions">("chat");
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null);
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false);
  const [renameTitle, setRenameTitle] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showContractInfo, setShowContractInfo] = useState(false);
  const [attachSelectedElement, setAttachSelectedElement] = useState(true);
  const handleSelectElement = (nodeId: string | null) => {
    if (onSelectNode) {
      onSelectNode(nodeId);
    } else {
      useStudioStore.getState().selectNode(nodeId);
    }
  };
  const selectedElement = useMemo(() => {
    if (!selectedId || !document?.spec.elements) return null;
    return document.spec.elements[selectedId] ?? null;
  }, [selectedId, document]);

  useEffect(() => {
    if (selectedId) {
      setAttachSelectedElement(true);
    }
  }, [selectedId]);

  const [expandedJsonMap, setExpandedJsonMap] = useState<Record<string, boolean>>({});

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  function handleApplyActions(actions: AgentUiAction[]) {
    if (onApplyAgentActions) {
      onApplyAgentActions(actions);
    } else {
      const currentDoc = useStudioStore.getState().document;
      const nextDoc = applyAgentUiActionsToDocument(currentDoc, actions);
      useStudioStore.getState().dispatch({ type: "document.replace", document: nextDoc });
      useStudioStore.getState().showNotice(`✨ ${LL.panels.agents.appliedToCanvasSuccess()}`);
    }
  }

  function handlePreviewActions(actions: AgentUiAction[]) {
    const currentDoc = useStudioStore.getState().document;
    const previewDoc = applyAgentUiActionsToDocument(currentDoc, actions);
    useAgentChatStore.getState().setAiPreview(previewDoc, actions);
  }
  // Available prompt profiles for this App
  // Initialize sessions from bootstrap if available
  useEffect(() => {
    if (bootstrap) {
      useAgentChatStore.getState().initFromBootstrap(bootstrap);
    }
  }, [bootstrap]);

  const promptProfiles = useMemo(() => {
    return bootstrap?.prompts ?? [];
  }, [bootstrap]);

  const defaultPromptId = bootstrap?.resource.defaultPromptId;

  // Ensure an active session exists on startup
  useEffect(() => {
    if (sessions.length === 0) {
      createSession(defaultPromptId, undefined, "Chat 1");
    } else if (!activeSessionId || !sessions.some((s) => s.id === activeSessionId)) {
      setActiveSession(sessions[0].id);
    }
  }, [sessions, activeSessionId, defaultPromptId, createSession, setActiveSession]);

  const activeSession = useMemo(() => {
    return sessions.find((s) => s.id === activeSessionId) ?? sessions[0];
  }, [sessions, activeSessionId]);

  // Current active prompt profile
  const selectedPrompt = useMemo(() => {
    if (!activeSession) return null;
    if (activeSession.promptId) {
      return promptProfiles.find((p) => p.id === activeSession.promptId) ?? null;
    }
    if (activeSession.promptKey) {
      return promptProfiles.find((p) => p.key === activeSession.promptKey) ?? null;
    }
    return promptProfiles.find((p) => p.isDefault) ?? promptProfiles[0] ?? null;
  }, [activeSession, promptProfiles]);

  // Auto-scroll on new messages or stream chunks
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeSession?.messages, isStreaming]);

  function handleCopyMessage(id: string, text: string) {
    void navigator.clipboard.writeText(text);
    setCopiedId(id);
    window.setTimeout(() => setCopiedId(null), 2000);
  }

  function handleCreateSession() {
    createSession(defaultPromptId, undefined, `Chat ${sessions.length + 1}`);
    setViewMode("chat");
  }

  function handleSaveRename(sessionId: string) {
    if (renameTitle.trim()) {
      renameSession(sessionId, renameTitle.trim());
    }
    setRenamingSessionId(null);
    setRenameTitle("");
  }
  const handleSubmit = (message: PromptInputMessage) => {
    if (!activeSession) return;
    const content = message.text;
    const attachments = message.files?.map((f) => ({
      id: f.id,
      name: f.filename || "file",
      size: f.size,
      type: f.mediaType,
      url: f.url,
    }));
    const elementPayload =
      attachSelectedElement && selectedElement && selectedId
        ? {
            nodeId: selectedId,
            type: selectedElement.type,
            props: selectedElement.props || {},
            children: selectedElement.children || [],
            slots: selectedElement.slots || {},
          }
        : undefined;

    void sendMessage(activeSession.id, content, attachments, elementPayload);
  };
  return (
    <div className="flex h-full flex-col overflow-hidden bg-background text-xs">
      {/* Top Header Toolbar */}
      <div className="flex shrink-0 flex-col gap-1.5 border-b border-border/60 bg-muted/20 p-2.5">
        {viewMode === "sessions" ? (
          /* Sessions View Header */
          <div className="flex items-center justify-between gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-xs font-medium"
              onClick={() => setViewMode("chat")}
            >
              <ArrowLeft className="size-3.5" />
              <span>{LL.sidebar.agents()}</span>
            </Button>
            <span className="font-semibold text-xs text-foreground">
              {LL.panels.agents.sessionsList()} ({sessions.length})
            </span>
            <Button
              variant="default"
              size="sm"
              className="h-7 gap-1 px-2.5 text-xs"
              onClick={handleCreateSession}
            >
              <Plus className="size-3.5" />
              <span>{LL.panels.agents.newChat()}</span>
            </Button>
          </div>
        ) : (
          /* Active Chat View Header */
          <>
            <div className="flex items-center justify-between gap-1.5">
              {/* Session Switcher Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 max-w-[170px] gap-1.5 px-2 text-xs font-medium"
                    >
                      <MessageSquare className="size-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate">
                        {activeSession?.title || LL.panels.agents.title()}
                      </span>
                      <ChevronDown className="size-3 shrink-0 opacity-60" />
                    </Button>
                  }
                />
                <DropdownMenuContent align="start" className="w-56">
                  <div className="flex items-center justify-between px-2 py-1 text-[11px] font-semibold text-muted-foreground">
                    <span>
                      {LL.sidebar.agents()} ({sessions.length})
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 px-1 text-[10px]"
                      onClick={() => setViewMode("sessions")}
                    >
                      {LL.panels.agents.sessionsList()}
                    </Button>
                  </div>
                  <DropdownMenuSeparator />
                  {sessions.map((s) => (
                    <DropdownMenuItem
                      key={s.id}
                      onClick={() => setActiveSession(s.id)}
                      className={cn(
                        "flex items-center justify-between text-xs",
                        s.id === activeSession?.id && "bg-accent font-medium",
                      )}
                    >
                      <span className="truncate">{s.title}</span>
                      {s.id === activeSession?.id && <Check className="size-3.5 text-primary" />}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleCreateSession} className="text-xs text-primary">
                    <Plus className="mr-1.5 size-3.5" />
                    {LL.panels.agents.newChat()}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Header Actions: Switch to Sessions List, New Chat, Clear */}
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  title={LL.panels.agents.sessionsList()}
                  onClick={() => setViewMode("sessions")}
                >
                  <List className="size-3.5 text-muted-foreground" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  title={LL.panels.agents.newChat()}
                  onClick={handleCreateSession}
                >
                  <Plus className="size-3.5" />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button variant="ghost" size="icon" className="size-7">
                        <RotateCcw className="size-3.5 text-muted-foreground" />
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem
                      onClick={() => activeSession && clearSessionMessages(activeSession.id)}
                      className="text-xs"
                    >
                      <RotateCcw className="mr-2 size-3.5 text-muted-foreground" />
                      {LL.panels.agents.clearChat()}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => activeSession && deleteSession(activeSession.id)}
                      className="text-xs text-destructive focus:text-destructive"
                      disabled={sessions.length <= 1}
                    >
                      <Trash2 className="mr-2 size-3.5" />
                      {LL.panels.agents.deleteSession()}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Main Body: Either Sessions List View OR Chat Messages View */}
      {viewMode === "sessions" ? (
        /* ---------------- DEDICATED SESSIONS LIST VIEW ---------------- */
        <div className="flex-1 overflow-y-auto p-2.5 flex flex-col gap-2">
          {sessions.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center p-4 text-center text-muted-foreground">
              <p>{LL.panels.agents.noSessions()}</p>
            </div>
          ) : (
            sessions.map((s) => {
              const isCurrent = s.id === activeSession?.id;
              const prompt = promptProfiles.find(
                (p) => p.id === s.promptId || p.key === s.promptKey,
              );
              const isRenaming = renamingSessionId === s.id;

              return (
                <div
                  key={s.id}
                  className={cn(
                    "group relative flex flex-col gap-1.5 rounded-xl border p-3 transition-all",
                    isCurrent
                      ? "border-primary/50 bg-primary/5 shadow-sm"
                      : "border-border/60 bg-muted/20 hover:border-border hover:bg-muted/40",
                  )}
                >
                  {isRenaming ? (
                    /* Inline Rename Box */
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        className="h-7 flex-1 rounded-lg border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        value={renameTitle}
                        autoFocus
                        onChange={(e) => setRenameTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveRename(s.id);
                          if (e.key === "Escape") setRenamingSessionId(null);
                        }}
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7"
                        onClick={() => handleSaveRename(s.id)}
                      >
                        <Check className="size-3.5 text-primary" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7"
                        onClick={() => setRenamingSessionId(null)}
                      >
                        <X className="size-3.5" />
                      </Button>
                    </div>
                  ) : (
                    /* Session Card Info */
                    <div className="flex items-start justify-between gap-2">
                      <div
                        className="flex flex-1 min-w-0 flex-col gap-1 cursor-pointer"
                        onClick={() => {
                          setActiveSession(s.id);
                          setViewMode("chat");
                        }}
                      >
                        <div className="flex items-center gap-1.5">
                          {isCurrent && <div className="size-2 rounded-full bg-primary" />}
                          <span className="truncate font-semibold text-xs text-foreground">
                            {s.title}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                          <span>
                            {LL.panels.agents.messagesCount({ count: s.messages.length })}
                          </span>
                          <span>·</span>
                          <span>
                            {new Date(s.createdAt).toLocaleDateString([], {
                              month: "numeric",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          {prompt && (
                            <Badge variant="outline" className="h-4 px-1 text-[9px]">
                              {prompt.name}
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Row Dropdown Actions */}
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-6 text-muted-foreground opacity-70 hover:opacity-100"
                            >
                              <MoreVertical className="size-3.5" />
                            </Button>
                          }
                        />
                        <DropdownMenuContent align="end" className="w-36">
                          <DropdownMenuItem
                            className="text-xs"
                            onClick={() => {
                              setRenamingSessionId(s.id);
                              setRenameTitle(s.title);
                            }}
                          >
                            <Edit2 className="mr-2 size-3.5" />
                            {LL.panels.agents.rename()}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-xs"
                            onClick={() => clearSessionMessages(s.id)}
                          >
                            <RotateCcw className="mr-2 size-3.5" />
                            {LL.panels.agents.clearChat()}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-xs text-destructive focus:text-destructive"
                            disabled={sessions.length <= 1}
                            onClick={() => deleteSession(s.id)}
                          >
                            <Trash2 className="mr-2 size-3.5" />
                            {LL.panels.agents.deleteSession()}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* ---------------- ACTIVE CHAT MESSAGES VIEW ---------------- */
        <>
          {/* 3. Messages Scroller */}
          <div className="flex-1 overflow-y-auto p-3">
            {!activeSession || activeSession.messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center">
                <Astroid className="size-8 text-foreground/80" />
                <div>
                  <div className="text-xs font-semibold text-foreground">
                    {LL.panels.agents.title()}
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    {LL.panels.agents.description()}
                  </p>
                </div>

                {/* Quick Starter Suggestions */}
                <div className="mt-2 flex w-full flex-col gap-1.5">
                  {[
                    "Suggest components for this page layout",
                    "Explain available API endpoints",
                    "Review page contract & diagnostics",
                  ].map((suggestion, idx) => (
                    <Button
                      key={idx}
                      variant="outline"
                      size="sm"
                      className="h-auto justify-start px-2.5 py-1.5 text-left text-[11px] text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        handleSubmit({ text: suggestion });
                      }}
                    >
                      <Astroid className="mr-1.5 size-3 shrink-0 text-foreground/70" />
                      <span className="truncate">{suggestion}</span>
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {activeSession.messages.map((m) => {
                  const isUser = m.role === "user";
                  return (
                    <div
                      key={m.id}
                      className={cn(
                        "flex flex-col w-full min-w-0",
                        isUser ? "items-end" : "items-start",
                      )}
                    >
                      {/* Attachments (including attached canvas element) */}
                      {((m.attachments && m.attachments.length > 0) ||
                        (isUser && m.selectedElement)) && (
                        <AttachmentGroup className="mb-1 gap-1.5 max-w-[60%]">
                          {isUser && m.selectedElement && (
                            <Attachment
                              key="selected-elem"
                              size="sm"
                              className="max-w-full cursor-pointer hover:bg-muted/80 hover:border-primary/50 transition-all select-none"
                              onClick={() =>
                                m.selectedElement && handleSelectElement(m.selectedElement.nodeId)
                              }
                              title={`Select ${m.selectedElement.type} (#${m.selectedElement.nodeId})`}
                            >
                              <AttachmentMedia variant="icon">
                                <MousePointerClick className="size-3.5 text-primary" />
                              </AttachmentMedia>
                              <AttachmentContent>
                                <AttachmentTitle className="truncate text-[11px]">
                                  #{m.selectedElement.nodeId}
                                </AttachmentTitle>
                              </AttachmentContent>
                            </Attachment>
                          )}
                          {m.attachments?.map((att) => (
                            <Attachment key={att.id} size="sm" className="max-w-full">
                              <AttachmentMedia variant="icon">
                                {att.type?.startsWith("image/") ? (
                                  <ImageIcon className="size-3.5 text-blue-500" />
                                ) : (
                                  <FileText className="size-3.5 text-muted-foreground" />
                                )}
                              </AttachmentMedia>
                              <AttachmentContent>
                                <AttachmentTitle className="truncate text-[11px]">
                                  {att.name}
                                </AttachmentTitle>
                                {att.size ? (
                                  <AttachmentDescription className="text-[9px]">
                                    {(att.size / 1024).toFixed(1)} KB
                                  </AttachmentDescription>
                                ) : null}
                              </AttachmentContent>
                            </Attachment>
                          ))}
                        </AttachmentGroup>
                      )}
                      {/* Message Content */}
                      {(() => {
                        const parsed =
                          !isUser && m.content ? splitContentAndUiActions(m.content) : null;
                        const displayText = isUser ? m.content : parsed?.displayText;
                        const actions = parsed?.actions;
                        const rawJson = parsed?.rawJson;
                        const isJsonExpanded = Boolean(expandedJsonMap[m.id]);
                        const summary =
                          actions && actions.length > 0
                            ? summarizeAndDeduplicateActions(actions)
                            : null;

                        if (isUser) {
                          return (
                            <div className="flex flex-col items-end max-w-[60%] space-y-0.5">
                              <div className="w-full rounded-2xl bg-primary px-3 py-2 text-xs leading-relaxed text-primary-foreground whitespace-pre-wrap break-words shadow-sm">
                                {displayText}
                              </div>
                              {m.content && (
                                <div className="flex items-center gap-1 pr-1">
                                  <Button
                                    variant="ghost"
                                    size="icon-xs"
                                    className="opacity-50 hover:opacity-100"
                                    title={
                                      copiedId === m.id
                                        ? LL.panels.agents.copied()
                                        : LL.panels.agents.copyMessage()
                                    }
                                    onClick={() => handleCopyMessage(m.id, m.content)}
                                  >
                                    {copiedId === m.id ? (
                                      <Check className="text-emerald-500" />
                                    ) : (
                                      <Copy />
                                    )}
                                  </Button>
                                </div>
                              )}
                            </div>
                          );
                        }

                        // Agent message: 100% width, no bubble background, markdown rendered
                        return (
                          <div className="w-full space-y-2 pt-0.5">
                            {displayText ? (
                              <MarkdownContent content={displayText} />
                            ) : actions && actions.length > 0 ? (
                              <div className="flex items-center text-xs font-medium text-foreground">
                                <span>{LL.panels.agents.uiDocumentDetected()}</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 py-0.5 text-xs text-muted-foreground">
                                <Spinner className="size-3" />
                                <span className="text-[11px]">Thinking…</span>
                              </div>
                            )}

                            {/* Generated UI Action Plan Card */}
                            {summary && summary.items.length > 0 && (
                              <div
                                className="relative w-full overflow-hidden rounded-2xl border border-border/80 bg-card/60 shadow-sm backdrop-blur flex flex-col cursor-pointer transition-all hover:border-primary/50 hover:shadow-md"
                                onClick={() => handlePreviewActions(actions!)}
                                title="Click to preview on AI replica canvas"
                              >
                                <ShineBorder
                                  borderWidth={1.5}
                                  duration={8}
                                  shineColor={["#A07CFE", "#FE8FB5", "#FFBE7B"]}
                                />
                                {/* Header Row */}
                                <div className="flex items-center justify-between p-2.5 pb-2">
                                  <div className="flex flex-col min-w-0 pr-2">
                                    <span className="font-semibold text-xs text-foreground truncate">
                                      {summary.replaceAction
                                        ? "Full Canvas Replacement"
                                        : `Changed ${summary.uniqueCount} ${summary.uniqueCount === 1 ? "element" : "elements"}`}
                                    </span>
                                    <div className="flex items-center gap-1.5 font-mono text-[10px]">
                                      {summary.insertCount > 0 && (
                                        <span className="text-emerald-500 font-medium">
                                          +{summary.insertCount}
                                        </span>
                                      )}
                                      {summary.updateCount > 0 && (
                                        <span className="text-amber-500 font-medium">
                                          ~{summary.updateCount}
                                        </span>
                                      )}
                                      {summary.deleteCount > 0 && (
                                        <span className="text-destructive font-medium">
                                          -{summary.deleteCount}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <Button
                                    variant="default"
                                    size="xs"
                                    className="font-medium shadow-xs shrink-0 px-2.5"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleApplyActions(actions!);
                                    }}
                                  >
                                    Apply
                                  </Button>
                                </div>

                                {/* Line by Line Updates */}
                                <div className="flex flex-col divide-y divide-border/40 border-t border-border/60 bg-muted/20">
                                  {summary.items.map((item, itemIdx) => (
                                    <div
                                      key={itemIdx}
                                      className="flex items-center justify-between px-3 py-1.5 text-xs hover:bg-muted/40 transition-colors"
                                    >
                                      <div className="flex items-center min-w-0 pr-2">
                                        <Tooltip>
                                          <TooltipTrigger
                                            render={
                                              <span
                                                className="font-mono text-[11px] font-medium text-foreground cursor-pointer underline decoration-dotted decoration-muted-foreground/50 underline-offset-2 hover:text-primary transition-colors truncate"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleSelectElement(item.id);
                                                }}
                                              >
                                                {item.label}
                                              </span>
                                            }
                                          />
                                          <TooltipContent
                                            side="right"
                                            sideOffset={6}
                                            className="max-w-xs whitespace-pre-wrap font-mono text-[10px] leading-tight p-2.5 bg-zinc-950 text-zinc-100 border border-zinc-800 shadow-xl rounded-xl"
                                          >
                                            {item.details}
                                          </TooltipContent>
                                        </Tooltip>
                                      </div>
                                      <span
                                        className={cn(
                                          "shrink-0 font-mono text-[10px] font-medium",
                                          item.badgeColor,
                                        )}
                                      >
                                        {item.badgeText}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {/* Message Footer with Copy and View JSON buttons */}
                            {m.content && (
                              <div className="flex flex-col gap-1.5 pt-0.5">
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon-xs"
                                    className="opacity-60 hover:opacity-100"
                                    title={
                                      copiedId === m.id
                                        ? LL.panels.agents.copied()
                                        : LL.panels.agents.copyMessage()
                                    }
                                    onClick={() => handleCopyMessage(m.id, m.content)}
                                  >
                                    {copiedId === m.id ? (
                                      <Check className="text-emerald-500" />
                                    ) : (
                                      <Copy />
                                    )}
                                  </Button>

                                  {rawJson && (
                                    <Button
                                      variant="ghost"
                                      size="icon-xs"
                                      className={cn(
                                        "opacity-60 hover:opacity-100",
                                        isJsonExpanded && "opacity-100 bg-muted text-foreground",
                                      )}
                                      title={
                                        isJsonExpanded
                                          ? LL.panels.agents.hideJson()
                                          : LL.panels.agents.viewJson()
                                      }
                                      onClick={() =>
                                        setExpandedJsonMap((prev) => ({
                                          ...prev,
                                          [m.id]: !prev[m.id],
                                        }))
                                      }
                                    >
                                      <Code2 />
                                    </Button>
                                  )}
                                </div>

                                {isJsonExpanded && rawJson && (
                                  <pre className="max-h-60 w-full overflow-auto rounded-xl border border-border/70 bg-zinc-950 p-2.5 font-mono text-[10px] leading-relaxed text-zinc-200 select-text whitespace-pre-wrap">
                                    <code>{rawJson}</code>
                                  </pre>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* 4. Error Banner if any */}
          {error && (
            <div className="flex items-center gap-2 border-t border-destructive/30 bg-destructive/10 px-3 py-1.5 text-[11px] text-destructive">
              <AlertCircle className="size-3.5 shrink-0" />
              <span className="truncate">{error}</span>
            </div>
          )}

          {/* 5. Modern AI Elements PromptInput Area */}
          <div className="shrink-0 border-t border-border/60 bg-background p-2.5">
            <PromptInputProvider
              status={isStreaming ? "streaming" : "ready"}
              onStop={stopStreaming}
            >
              <PromptInput globalDrop multiple onSubmit={handleSubmit}>
                <PromptInputAttachmentsDisplay
                  selectedElement={selectedElement}
                  selectedId={selectedId ?? null}
                  attachSelectedElement={attachSelectedElement}
                  onDetachElement={() => setAttachSelectedElement(false)}
                  onSelectElement={handleSelectElement}
                />
                <PromptInputBody>
                  <PromptInputTextarea placeholder={LL.panels.agents.inputPlaceholder()} />
                </PromptInputBody>
                <PromptInputFooter>
                  <PromptInputTools>
                    <PromptInputActionMenu>
                      <PromptInputActionMenuTrigger />
                      <PromptInputActionMenuContent>
                        <PromptInputActionAddAttachments />
                        <PromptInputActionAddScreenshot />
                      </PromptInputActionMenuContent>
                    </PromptInputActionMenu>

                    {/* Model / Prompt Profile Selector */}
                    {promptProfiles.length > 0 && activeSession && (
                      <ModelSelector open={modelSelectorOpen} onOpenChange={setModelSelectorOpen}>
                        <ModelSelectorTrigger asChild>
                          <PromptInputButton>
                            <ModelSelectorLogo provider={selectedPrompt?.key || "claude"} />
                            <ModelSelectorName>
                              {selectedPrompt?.name || "Default Prompt"}
                            </ModelSelectorName>
                          </PromptInputButton>
                        </ModelSelectorTrigger>
                        <ModelSelectorContent>
                          <ModelSelectorInput placeholder="Search prompt profiles…" />
                          <ModelSelectorList>
                            <ModelSelectorEmpty>No prompt profile found.</ModelSelectorEmpty>
                            <ModelSelectorGroup heading="Prompt Profiles">
                              {promptProfiles.map((p) => (
                                <ModelSelectorItem
                                  key={p.id}
                                  value={p.name}
                                  onSelect={() => {
                                    setSessionPrompt(activeSession.id, p.id, p.key);
                                    setModelSelectorOpen(false);
                                  }}
                                >
                                  <ModelSelectorLogo provider={p.key} />
                                  <div className="flex flex-col flex-1 min-w-0">
                                    <span className="font-medium truncate">{p.name}</span>
                                    <span className="text-[10px] text-muted-foreground font-mono truncate">
                                      {p.key}
                                    </span>
                                  </div>
                                  {p.id === activeSession.promptId && (
                                    <Check className="ml-auto size-3.5 text-primary shrink-0" />
                                  )}
                                </ModelSelectorItem>
                              ))}
                            </ModelSelectorGroup>
                          </ModelSelectorList>
                        </ModelSelectorContent>
                      </ModelSelector>
                    )}
                  </PromptInputTools>
                  <PromptInputSubmit />
                </PromptInputFooter>
              </PromptInput>
            </PromptInputProvider>
            {/* Footer info & toggle for diagnostics */}
            <div className="mt-1.5 flex items-center justify-between px-1 text-[10px] text-muted-foreground">
              <span className="truncate">
                {appKey} · {componentsCount} types · v{manifestVersion} {valid ? "✓" : "!"} · rev{" "}
                {revision}
              </span>
              {diagnostics.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 p-0 text-[10px] text-amber-500"
                  onClick={() => setShowContractInfo((prev) => !prev)}
                >
                  {diagnostics.length} diagnostics
                </Button>
              )}
            </div>

            {showContractInfo && diagnostics.length > 0 && (
              <div className="mt-2 rounded-lg border border-destructive/20 bg-destructive/5 p-2 text-[10px] text-destructive">
                <div className="mb-1 font-semibold">{LL.panels.agents.diagnostics()}:</div>
                {diagnostics.map((d, i) => (
                  <div key={i}>• {d.message}</div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
