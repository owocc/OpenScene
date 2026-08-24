import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowUp,
  Bot,
  Check,
  ChevronDown,
  Code2,
  Copy,
  Edit2,
  File,
  FileText,
  Image as ImageIcon,
  LayoutTemplate,
  List,
  MessageSquare,
  MoreVertical,
  MousePointerClick,
  Paperclip,
  Plus,
  RotateCcw,
  Sparkles,
  Square,
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
import { useStudioStore } from "@/stores/studio-store";
import { useAgentChatStore, type ChatAttachment } from "@/stores/agent-chat-store";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Attachment,
  AttachmentAction,
  AttachmentContent,
  AttachmentDescription,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
} from "@/components/ui/attachment";
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
  MessageGroup,
  MessageHeader,
} from "@/components/ui/message";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

interface AgentsPanelProps {
  appKey: string;
  manifestVersion: string;
  componentsCount: number;
  valid: boolean;
  revision: number;
  diagnostics: Array<{ message: string }>;
  document?: SceneDocument;
  selectedId?: string | null;
  onApplyAgentActions?: (actions: AgentUiAction[]) => void;
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
  const [renameTitle, setRenameTitle] = useState("");
  const [input, setInput] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showContractInfo, setShowContractInfo] = useState(false);
  const [attachSelectedElement, setAttachSelectedElement] = useState(true);

  const selectedElement = useMemo(() => {
    if (!selectedId || !document?.spec.elements) return null;
    return document.spec.elements[selectedId] ?? null;
  }, [selectedId, document]);

  const [expandedJsonMap, setExpandedJsonMap] = useState<Record<string, boolean>>({});

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
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

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const newAttachments: ChatAttachment[] = Array.from(files).map((file) => {
      const isImg = file.type.startsWith("image/");
      return {
        id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: file.name,
        size: file.size,
        type: file.type,
        dataUrl: isImg ? URL.createObjectURL(file) : undefined,
      };
    });

    setPendingAttachments((prev) => [...prev, ...newAttachments]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }
  function handleRemoveAttachment(id: string) {
    setPendingAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  function handleCreateSession() {
    createSession(defaultPromptId, undefined, `Chat ${sessions.length + 1}`);
    setInput("");
    setPendingAttachments([]);
    setViewMode("chat");
  }

  function handleSaveRename(sessionId: string) {
    if (renameTitle.trim()) {
      renameSession(sessionId, renameTitle.trim());
    }
    setRenamingSessionId(null);
    setRenameTitle("");
  }
  async function handleSend() {
    if (!activeSession || (!input.trim() && pendingAttachments.length === 0)) return;
    const content = input.trim();
    const attachments = [...pendingAttachments];
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

    setInput("");
    setPendingAttachments([]);
    await sendMessage(activeSession.id, content, attachments, elementPayload);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

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

            {/* Prompt Profile Selector */}
            {promptProfiles.length > 0 && activeSession && (
              <div className="flex items-center justify-between gap-1 rounded-lg border border-border/40 bg-background/60 px-2 py-1">
                <span className="text-[11px] text-muted-foreground">
                  {LL.panels.agents.promptProfile()}:
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 gap-1 px-1.5 text-[11px] font-medium"
                      >
                        <Sparkles className="size-3 text-amber-500" />
                        <span className="max-w-[130px] truncate">
                          {selectedPrompt?.name || LL.panels.agents.defaultProfile()}
                        </span>
                        <ChevronDown className="size-2.5 opacity-60" />
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="end" className="w-60">
                    <div className="px-2 py-1 text-[11px] font-semibold text-muted-foreground">
                      {LL.panels.agents.promptProfile()}
                    </div>
                    <DropdownMenuSeparator />
                    {promptProfiles.map((p) => (
                      <DropdownMenuItem
                        key={p.id}
                        onClick={() => setSessionPrompt(activeSession.id, p.id, p.key)}
                        className={cn(
                          "flex flex-col items-start gap-0.5 text-xs",
                          (p.id === activeSession.promptId ||
                            (!activeSession.promptId && p.isDefault)) &&
                            "bg-accent font-medium",
                        )}
                      >
                        <div className="flex w-full items-center justify-between">
                          <span>{p.name}</span>
                          {p.isDefault && (
                            <Badge variant="outline" className="h-4 px-1 text-[9px]">
                              {LL.panels.agents.defaultProfile()}
                            </Badge>
                          )}
                        </div>
                        <span className="font-mono text-[10px] text-muted-foreground">{p.key}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
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
                <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Bot className="size-5" />
                </div>
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
                        setInput(suggestion);
                        textareaRef.current?.focus();
                      }}
                    >
                      <Sparkles className="mr-1.5 size-3 shrink-0 text-amber-500" />
                      <span className="truncate">{suggestion}</span>
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <MessageGroup className="gap-4">
                {activeSession.messages.map((m) => {
                  const isUser = m.role === "user";
                  return (
                    <Message key={m.id} align={isUser ? "end" : "start"} className="gap-2">
                      {!isUser && (
                        <MessageAvatar className="size-7 bg-primary/10 text-primary">
                          <Sparkles className="size-3.5" />
                        </MessageAvatar>
                      )}

                      <MessageContent className="max-w-[85%]">
                        <MessageHeader className="justify-between text-[10px]">
                          <span>{isUser ? "You" : selectedPrompt?.name || "AI Agent"}</span>
                          <span>
                            {new Date(m.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </MessageHeader>
                        {/* Selected Element Context Tag (User Message) */}
                        {isUser && m.selectedElement && (
                          <div className="mb-1 flex items-center gap-1.5 self-end rounded-lg border border-primary/20 bg-primary/5 px-2 py-0.5 text-[10px] text-muted-foreground select-none">
                            <MousePointerClick className="size-3 text-primary" />
                            <span className="font-semibold text-foreground">
                              {m.selectedElement.type}
                            </span>
                            <span className="font-mono text-muted-foreground/80">
                              ({m.selectedElement.nodeId})
                            </span>
                          </div>
                        )}

                        {/* Attachments if any (rendered above message bubble) */}
                        {m.attachments && m.attachments.length > 0 && (
                          <AttachmentGroup className="gap-1.5">
                            {m.attachments.map((att) => (
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

                        {/* Message Bubble Content */}
                        {(() => {
                          const parsed =
                            !isUser && m.content ? splitContentAndUiActions(m.content) : null;
                          const displayText = isUser ? m.content : parsed?.displayText;
                          const actions = parsed?.actions;
                          const rawJson = parsed?.rawJson;
                          const isJsonExpanded = Boolean(expandedJsonMap[m.id]);

                          const replaceAction = actions?.find(
                            (a) => a.action === "replace_document",
                          );
                          const insertCount =
                            actions?.filter((a) => a.action === "insert_element").length ?? 0;
                          const updateCount =
                            actions?.filter((a) => a.action === "update_element").length ?? 0;
                          const deleteCount =
                            actions?.filter((a) => a.action === "delete_element").length ?? 0;

                          return (
                            <>
                              <div
                                className={cn(
                                  "rounded-2xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap",
                                  isUser
                                    ? "bg-primary text-primary-foreground"
                                    : "border border-border/50 bg-muted/40 text-foreground",
                                )}
                              >
                                {displayText ||
                                  (actions && actions.length > 0 ? (
                                    <div className="flex items-center gap-1.5 font-medium text-foreground">
                                      <Sparkles className="size-3.5 text-amber-500" />
                                      <span>{LL.panels.agents.uiDocumentDetected()}</span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1.5 py-0.5 text-muted-foreground">
                                      <Spinner className="size-3" />
                                      <span className="text-[11px]">Thinking…</span>
                                    </div>
                                  ))}
                              </div>

                              {/* Generated UI Action Plan Card */}
                              {!isUser && actions && actions.length > 0 && (
                                <div className="mt-1.5 flex flex-col gap-2 rounded-xl border border-primary/30 bg-primary/5 p-2.5">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5 font-medium text-foreground">
                                      <Sparkles className="size-3.5 text-amber-500" />
                                      <span>{LL.panels.agents.uiDocumentDetected()}</span>
                                    </div>
                                    <Button
                                      variant="default"
                                      size="sm"
                                      className="h-6 gap-1 px-2 text-[11px]"
                                      onClick={() => handleApplyActions(actions)}
                                    >
                                      <LayoutTemplate className="size-3" />
                                      {LL.panels.agents.applyToCanvas()}
                                    </Button>
                                  </div>
                                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                                    <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                                      {replaceAction &&
                                      replaceAction.action === "replace_document" ? (
                                        <Badge
                                          variant="outline"
                                          className="h-4 border-blue-500/40 bg-blue-500/10 px-1 text-[9px] font-normal text-blue-500"
                                        >
                                          全量重绘画布 (
                                          {Object.keys(replaceAction.document.spec.elements).length}{" "}
                                          elements)
                                        </Badge>
                                      ) : (
                                        <>
                                          {insertCount > 0 && (
                                            <Badge
                                              variant="outline"
                                              className="h-4 border-emerald-500/40 bg-emerald-500/10 px-1 text-[9px] font-normal text-emerald-500"
                                            >
                                              +{insertCount} 插入
                                            </Badge>
                                          )}
                                          {updateCount > 0 && (
                                            <Badge
                                              variant="outline"
                                              className="h-4 border-amber-500/40 bg-amber-500/10 px-1 text-[9px] font-normal text-amber-500"
                                            >
                                              ~{updateCount} 编辑
                                            </Badge>
                                          )}
                                          {deleteCount > 0 && (
                                            <Badge
                                              variant="outline"
                                              className="h-4 border-destructive/40 bg-destructive/10 px-1 text-[9px] font-normal text-destructive"
                                            >
                                              -{deleteCount} 删除
                                            </Badge>
                                          )}
                                        </>
                                      )}
                                    </div>

                                    {rawJson && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-4 gap-1 p-0 text-[10px] text-muted-foreground hover:text-foreground"
                                        onClick={() =>
                                          setExpandedJsonMap((prev) => ({
                                            ...prev,
                                            [m.id]: !prev[m.id],
                                          }))
                                        }
                                      >
                                        <Code2 className="size-3" />
                                        <span>
                                          {isJsonExpanded
                                            ? LL.panels.agents.hideJson()
                                            : LL.panels.agents.viewJson()}
                                        </span>
                                      </Button>
                                    )}
                                  </div>

                                  {isJsonExpanded && rawJson && (
                                    <pre className="max-h-60 overflow-auto rounded-lg bg-muted/60 p-2 font-mono text-[10px] leading-tight text-foreground select-text whitespace-pre-wrap">
                                      <code>{rawJson}</code>
                                    </pre>
                                  )}
                                </div>
                              )}
                            </>
                          );
                        })()}
                        {!isUser && m.content && (
                          <MessageFooter className="gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-5 opacity-70 hover:opacity-100"
                              title={
                                copiedId === m.id
                                  ? LL.panels.agents.copied()
                                  : LL.panels.agents.copyMessage()
                              }
                              onClick={() => handleCopyMessage(m.id, m.content)}
                            >
                              {copiedId === m.id ? (
                                <Check className="size-3 text-emerald-500" />
                              ) : (
                                <Copy className="size-3" />
                              )}
                            </Button>
                          </MessageFooter>
                        )}
                      </MessageContent>
                    </Message>
                  );
                })}
                <div ref={messagesEndRef} />
              </MessageGroup>
            )}
          </div>

          {/* 4. Error Banner if any */}
          {error && (
            <div className="flex items-center gap-2 border-t border-destructive/30 bg-destructive/10 px-3 py-1.5 text-[11px] text-destructive">
              <AlertCircle className="size-3.5 shrink-0" />
              <span className="truncate">{error}</span>
            </div>
          )}

          {/* 5. Input Area with Attachment Trigger */}
          <div className="shrink-0 border-t border-border/60 bg-background p-2.5">
            {/* Selected Element Context pill */}
            {selectedElement && selectedId && (
              <div
                className={cn(
                  "mb-2 flex items-center justify-between gap-2 rounded-xl border px-2.5 py-1.5 text-xs transition-all",
                  attachSelectedElement
                    ? "border-primary/40 bg-primary/5 text-foreground"
                    : "border-border/60 bg-muted/20 text-muted-foreground opacity-60",
                )}
              >
                <div className="flex min-w-0 items-center gap-1.5 truncate">
                  <MousePointerClick className="size-3.5 shrink-0 text-primary" />
                  <span className="font-semibold text-[11px] text-foreground">
                    {selectedElement.type}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground truncate">
                    ({selectedId})
                  </span>
                </div>
                <label className="flex items-center gap-1.5 shrink-0 cursor-pointer select-none">
                  <Checkbox
                    checked={attachSelectedElement}
                    onCheckedChange={(checked) => setAttachSelectedElement(Boolean(checked))}
                  />
                  <span className="text-[10px] font-medium text-foreground">
                    {LL.panels.agents.attachElementContext()}
                  </span>
                </label>
              </div>
            )}

            {/* Pending attachments preview strip */}
            {pendingAttachments.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {pendingAttachments.map((att) => (
                  <Attachment key={att.id} size="sm" className="max-w-full">
                    <AttachmentMedia variant="icon">
                      {att.type?.startsWith("image/") ? (
                        <ImageIcon className="size-3.5 text-blue-500" />
                      ) : (
                        <File className="size-3.5 text-muted-foreground" />
                      )}
                    </AttachmentMedia>
                    <AttachmentContent>
                      <AttachmentTitle className="max-w-[100px] truncate text-[11px]">
                        {att.name}
                      </AttachmentTitle>
                    </AttachmentContent>
                    <AttachmentAction
                      title={LL.panels.agents.removeAttachment()}
                      onClick={() => handleRemoveAttachment(att.id)}
                    >
                      <X className="size-3" />
                    </AttachmentAction>
                  </Attachment>
                ))}
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              accept="image/*,.json,.txt,.md,.pdf,.csv"
              onChange={handleFileSelect}
            />

            <div className="relative flex items-end gap-1.5 rounded-xl border border-border/80 bg-muted/20 p-1.5 focus-within:border-ring/60 focus-within:ring-1 focus-within:ring-ring/30">
              <Button
                variant="ghost"
                size="icon"
                type="button"
                className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
                title={LL.panels.agents.addAttachment()}
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="size-3.5" />
              </Button>

              <Textarea
                ref={textareaRef}
                rows={1}
                value={input}
                placeholder={LL.panels.agents.inputPlaceholder()}
                className="max-h-28 min-h-[28px] resize-none border-0 bg-transparent p-1 text-xs shadow-none focus-visible:ring-0"
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
              />

              {isStreaming ? (
                <Button
                  variant="destructive"
                  size="icon"
                  type="button"
                  className="size-7 shrink-0 rounded-lg"
                  title={LL.panels.agents.stop()}
                  onClick={stopStreaming}
                >
                  <Square className="size-3 fill-current" />
                </Button>
              ) : (
                <Button
                  variant="default"
                  size="icon"
                  type="button"
                  disabled={!input.trim() && pendingAttachments.length === 0}
                  className="size-7 shrink-0 rounded-lg"
                  title={LL.panels.agents.send()}
                  onClick={() => void handleSend()}
                >
                  <ArrowUp className="size-3.5" />
                </Button>
              )}
            </div>

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
