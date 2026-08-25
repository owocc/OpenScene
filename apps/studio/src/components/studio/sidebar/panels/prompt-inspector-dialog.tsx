import { useEffect, useMemo, useState } from "react";
import {
  Blocks,
  Braces,
  Check,
  Code2,
  Copy,
  FileCode,
  FileText,
  Globe,
  History,
  Image as ImageIcon,
  MousePointerClick,
  Plug,
  RefreshCw,
  Sparkles,
  User,
} from "lucide-react";
import { splitContentAndUiActions } from "@openscene-ai/protocol";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { MarkdownContent } from "./markdown-content";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Timeline,
  TimelineContent,
  TimelineDate,
  TimelineHeader,
  TimelineIndicator,
  TimelineItem,
  TimelineSeparator,
} from "@/components/reui/timeline";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ChatSession, SelectedElementPayload } from "@/stores/agent-chat-store";
import type { AppPromptInfo } from "@/core/studio-bootstrap";

interface PromptBreakdown {
  globalPrompt?: string;
  appSystem?: string;
  sections?: string[];
  componentsText?: string;
  openApiText?: string;
  selectedElementText?: string;
  requestSystem?: string;
}

interface PromptPreviewData {
  systemPrompt: string;
  breakdown?: PromptBreakdown;
}

interface PromptInspectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appId: string;
  activeSession?: ChatSession;
  selectedPrompt?: AppPromptInfo | null;
  selectedId?: string | null;
  selectedElementPayload?: SelectedElementPayload;
  attachSelectedElement?: boolean;
  serverUrl?: string | null;
  sessionId?: string | null;
  token?: string | null;
}

export function PromptInspectorDialog({
  open,
  onOpenChange,
  appId,
  activeSession,
  selectedPrompt,
  selectedId,
  selectedElementPayload,
  attachSelectedElement = true,
  serverUrl = "",
  sessionId = "",
  token = "",
}: PromptInspectorDialogProps) {
  const { LL } = useI18n();
  const [activeTab, setActiveTab] = useState<
    "all" | "system" | "basePrompt" | "components" | "userContext" | "payload"
  >("all");
  const [renderMode, setRenderMode] = useState<"markdown" | "raw">("markdown");
  const [loading, setLoading] = useState(false);
  const [promptData, setPromptData] = useState<PromptPreviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Compute attached element context payload if enabled
  const attachedElement = useMemo(() => {
    if (!attachSelectedElement || !selectedId || !selectedElementPayload) return undefined;
    return selectedElementPayload;
  }, [attachSelectedElement, selectedId, selectedElementPayload]);

  // Fetch assembled prompt from backend
  const fetchPrompt = async () => {
    setLoading(true);
    setError(null);
    try {
      const cleanServerUrl = (serverUrl || "").replace(/\/$/, "");
      const isStudioSession = sessionId && sessionId !== "local-test";

      const endpoint = isStudioSession
        ? `${cleanServerUrl}/api/v1/studio-sessions/${encodeURIComponent(sessionId)}/prompt-preview`
        : `${cleanServerUrl}/api/v1/ai/prompt-preview`;

      const headers: Record<string, string> = {
        "content-type": "application/json",
      };
      if (token) {
        headers["x-openscene-session-token"] = token;
      }

      const bodyPayload = {
        appId,
        promptId: activeSession?.promptId || selectedPrompt?.id || undefined,
        promptKey: activeSession?.promptKey || selectedPrompt?.key || undefined,
        selectedElement: attachedElement,
      };

      const res = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(bodyPayload),
      });

      if (!res.ok) {
        let errMsg = `Request failed (${res.status})`;
        try {
          const errJson = await res.json();
          if (errJson?.detail) errMsg = errJson.detail;
          else if (errJson?.title) errMsg = errJson.title;
        } catch {
          // ignore
        }
        throw new Error(errMsg);
      }

      const data = (await res.json()) as PromptPreviewData;
      setPromptData(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to fetch assembled prompt";
      setError(msg);
      // Fallback local representation for testing or offline
      setPromptData({
        systemPrompt: `# System Prompt (Local Preview)\n\nApp ID: ${appId}\nPrompt Key: ${
          selectedPrompt?.key || "default"
        }\n\n${
          attachedElement
            ? `## TARGETED ELEMENT MODIFICATION RULES:\nSelected #${attachedElement.nodeId} (${attachedElement.type})\n`
            : "No target element attached."
        }`,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      void fetchPrompt();
    }
  }, [
    open,
    activeSession?.id,
    activeSession?.promptId,
    selectedPrompt?.id,
    selectedId,
    attachSelectedElement,
  ]);

  const handleCopy = (key: string, text: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const systemPromptText = promptData?.systemPrompt || "";
  const charCount = systemPromptText.length;
  const tokenEstimate = Math.ceil(charCount / 4);

  // Assembled Base Prompt text (Global + App System + Sections)
  const basePromptText = useMemo(() => {
    const parts: string[] = [];
    if (promptData?.breakdown?.globalPrompt) {
      parts.push(`### Global System Prompt\n${promptData.breakdown.globalPrompt}`);
    }
    if (promptData?.breakdown?.appSystem) {
      parts.push(`### App Base System Prompt\n${promptData.breakdown.appSystem}`);
    }
    if (promptData?.breakdown?.sections && promptData.breakdown.sections.length > 0) {
      parts.push(`### Custom Sections\n${promptData.breakdown.sections.join("\n\n")}`);
    }
    return parts.join("\n\n") || promptData?.breakdown?.appSystem || systemPromptText;
  }, [promptData, systemPromptText]);

  // Injected Components text
  const injectedComponentsText = promptData?.breakdown?.componentsText || "";

  // Exact payload dispatched to backend AI chat endpoint
  const fullRequestPayload = useMemo(() => {
    const history = (activeSession?.messages || []).map((m) => ({
      role: m.role,
      content: m.content || "(attachment)",
    }));

    return {
      appId,
      promptId: activeSession?.promptId || selectedPrompt?.id || undefined,
      promptKey: activeSession?.promptKey || selectedPrompt?.key || undefined,
      selectedElement: attachedElement,
      messages: history,
      format: "stream",
    };
  }, [appId, activeSession, selectedPrompt, attachedElement]);

  // Full unified timeline representation
  const timelineItems = useMemo(() => {
    const items: Array<{
      id: string;
      role: "system" | "user" | "assistant";
      title: string;
      timestamp?: number;
      content: string;
      selectedElement?: SelectedElementPayload;
      attachments?: Array<{ id: string; name: string; type?: string; size?: number }>;
    }> = [];

    // 1. System Prompt Node
    items.push({
      id: "system_prompt_node",
      role: "system",
      title: "System Prompt",
      content: systemPromptText,
      selectedElement: attachedElement,
    });

    // 2. Chat Messages
    if (activeSession?.messages) {
      for (const m of activeSession.messages) {
        items.push({
          id: m.id,
          role: m.role,
          title: m.role === "user" ? "User Message" : "Assistant Response",
          timestamp: m.createdAt,
          content: m.content,
          selectedElement: m.selectedElement,
          attachments: m.attachments,
        });
      }
    }

    return items;
  }, [systemPromptText, attachedElement, activeSession]);

  const getCopyTextForCurrentTab = () => {
    if (activeTab === "system") return systemPromptText;
    if (activeTab === "basePrompt") return basePromptText;
    if (activeTab === "components") return injectedComponentsText || "No components injected";
    if (activeTab === "payload") return JSON.stringify(fullRequestPayload, null, 2);
    if (activeTab === "userContext") return JSON.stringify(activeSession, null, 2);
    return JSON.stringify(
      {
        systemPrompt: systemPromptText,
        breakdown: promptData?.breakdown,
        session: activeSession,
        requestPayload: fullRequestPayload,
      },
      null,
      2,
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="!h-[80vh] !max-h-[80vh] data-[side=bottom]:!h-[80vh] data-[side=bottom]:!max-h-[80vh] rounded-t-2xl border-t border-border bg-background shadow-2xl flex flex-col p-0 gap-0 overflow-hidden"
      >
        {/* Top Header */}
        <SheetHeader className="px-6 py-3.5 border-b border-border/70 flex shrink-0 flex-row items-center justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <SheetTitle className="text-sm font-semibold flex items-center gap-2">
                <span>{LL.panels.agents.promptInspector()}</span>
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/5"
                >
                  {LL.panels.agents.devModeOnly()}
                </Badge>
              </SheetTitle>
            </div>
            <SheetDescription className="text-xs text-muted-foreground line-clamp-1">
              {LL.panels.agents.promptInspectorDesc()}
            </SheetDescription>
          </div>
          <div className="flex items-center gap-2 pr-8">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5 px-2.5"
              onClick={() => void fetchPrompt()}
              disabled={loading}
            >
              <RefreshCw className={cn("size-3.5", loading && "animate-spin text-primary")} />
              <span>
                {loading ? LL.panels.agents.fetchingPrompt() : LL.panels.agents.fetchPrompt()}
              </span>
            </Button>
            <Button
              variant="default"
              size="sm"
              className="h-7 text-xs gap-1.5 px-2.5"
              onClick={() => handleCopy("global", getCopyTextForCurrentTab())}
            >
              {copiedKey === "global" ? (
                <Check className="size-3.5 text-emerald-400" />
              ) : (
                <Copy className="size-3.5" />
              )}
              <span>
                {copiedKey === "global" ? LL.panels.agents.copied() : LL.panels.agents.copyPrompt()}
              </span>
            </Button>
          </div>
        </SheetHeader>

        {/* Tab Selection Toolbar & Sub-header */}
        <div className="flex items-center justify-between px-6 py-2 border-b border-border/50 bg-muted/30 flex-wrap gap-2">
          <Tabs
            value={activeTab}
            onValueChange={(val) =>
              setActiveTab(
                val as "all" | "system" | "basePrompt" | "components" | "userContext" | "payload",
              )
            }
            className="w-auto"
          >
            <TabsList className="h-7 bg-muted/80 p-0.5 flex-wrap">
              <TabsTrigger value="all" className="text-xs h-6 px-2.5 gap-1.5">
                <History className="size-3 text-indigo-500" />
                <span>{LL.panels.agents.allTimelineTab()}</span>
              </TabsTrigger>
              <TabsTrigger value="system" className="text-xs h-6 px-2.5 gap-1.5">
                <Sparkles className="size-3 text-amber-500" />
                <span>{LL.panels.agents.systemPromptTab()}</span>
              </TabsTrigger>
              <TabsTrigger value="basePrompt" className="text-xs h-6 px-2.5 gap-1.5">
                <FileCode className="size-3 text-violet-500" />
                <span>{LL.panels.agents.basePromptTab()}</span>
              </TabsTrigger>
              <TabsTrigger value="components" className="text-xs h-6 px-2.5 gap-1.5">
                <Blocks className="size-3 text-teal-500" />
                <span>{LL.panels.agents.injectedComponentsTab()}</span>
              </TabsTrigger>
              <TabsTrigger value="userContext" className="text-xs h-6 px-2.5 gap-1.5">
                <User className="size-3 text-blue-500" />
                <span>{LL.panels.agents.userContextTab()}</span>
              </TabsTrigger>
              <TabsTrigger value="payload" className="text-xs h-6 px-2.5 gap-1.5">
                <Braces className="size-3 text-emerald-500" />
                <span>{LL.panels.agents.rawPayloadTab()}</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Right Sub-Toolbar: Mode Switcher & Stats */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center rounded-lg border border-border/70 bg-background p-0.5 shadow-xs">
              <button
                type="button"
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer",
                  renderMode === "markdown"
                    ? "bg-accent text-accent-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setRenderMode("markdown")}
              >
                <FileText className="size-3" />
                <span>{LL.panels.agents.viewModeMarkdown()}</span>
              </button>
              <button
                type="button"
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer",
                  renderMode === "raw"
                    ? "bg-accent text-accent-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setRenderMode("raw")}
              >
                <Code2 className="size-3" />
                <span>{LL.panels.agents.viewModeRaw()}</span>
              </button>
            </div>

            <div className="h-4 w-px bg-border/80" />

            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono">
              <span className="px-1.5 py-0.5 rounded bg-muted/60">
                {LL.panels.agents.charsCount({ count: charCount })}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-muted/60">
                {LL.panels.agents.estimatedTokens({ count: tokenEstimate })}
              </span>
            </div>
          </div>
        </div>

        {/* Tab Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 pb-24 bg-background">
          <div className="max-w-6xl mx-auto w-full space-y-4 pb-12">
            {error && (
              <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-center justify-between">
                <span>{error}</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-[10px] px-2"
                  onClick={() => void fetchPrompt()}
                >
                  Retry
                </Button>
              </div>
            )}

            {/* 1. ALL TIMELINE VIEW */}
            {activeTab === "all" && (
              <div className="space-y-4">
                <Timeline defaultValue={0} className="gap-3 w-full">
                  {timelineItems.map((item, idx) => {
                    const isSystem = item.role === "system";
                    const isUser = item.role === "user";
                    const isAssistant = item.role === "assistant";
                    const itemCopyKey = `item_${item.id || idx}`;
                    const indicatorColor = isSystem
                      ? "bg-amber-500"
                      : isUser
                        ? "bg-blue-500"
                        : "bg-emerald-500";

                    return (
                      <TimelineItem
                        key={item.id || idx}
                        step={idx + 1}
                        className="has-[+[data-completed]]:[&_[data-slot=timeline-separator]]:bg-foreground/20 group-data-[orientation=vertical]/timeline:not-last:pb-4"
                      >
                        <TimelineHeader className="flex items-center gap-2.5">
                          <TimelineSeparator className="bg-border/70" />
                          <TimelineIndicator
                            className={cn("size-2.5 border-none", indicatorColor)}
                          />
                          <Badge
                            variant={isSystem ? "default" : isUser ? "secondary" : "outline"}
                            className={cn(
                              "text-[10px] font-mono uppercase px-2 py-0.5",
                              isSystem &&
                                "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30",
                              isUser &&
                                "bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30",
                              isAssistant &&
                                "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30",
                            )}
                          >
                            {item.role}
                          </Badge>
                          <span className="text-xs font-semibold text-foreground">
                            {item.title}
                          </span>
                          {item.timestamp ? (
                            <TimelineDate className="text-muted-foreground/60 mb-0 text-[10px] font-semibold uppercase">
                              {new Date(item.timestamp).toLocaleTimeString()}
                            </TimelineDate>
                          ) : (
                            <TimelineDate className="text-muted-foreground/60 mb-0 text-[10px] font-semibold uppercase">
                              Injected System
                            </TimelineDate>
                          )}
                          {item.selectedElement && (
                            <Badge
                              variant="secondary"
                              className="gap-1 font-mono text-[10px] text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/30"
                            >
                              <MousePointerClick className="size-2.5" />#
                              {item.selectedElement.nodeId} ({item.selectedElement.type})
                            </Badge>
                          )}
                          {item.attachments && item.attachments.length > 0 && (
                            <div className="flex items-center gap-1">
                              {item.attachments.map((att) => (
                                <Badge key={att.id} variant="outline" className="gap-1 text-[10px]">
                                  {att.type?.startsWith("image/") ? (
                                    <ImageIcon className="size-2.5 text-blue-500" />
                                  ) : (
                                    <FileText className="size-2.5" />
                                  )}
                                  <span>{att.name}</span>
                                </Badge>
                              ))}
                            </div>
                          )}
                          <div className="ml-auto flex items-center gap-1.5">
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {item.content.length} chars
                            </span>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              className="text-muted-foreground hover:text-foreground"
                              onClick={() => handleCopy(itemCopyKey, item.content)}
                              title="Copy content"
                            >
                              {copiedKey === itemCopyKey ? (
                                <Check className="size-3 text-emerald-500" />
                              ) : (
                                <Copy className="size-3" />
                              )}
                            </Button>
                          </div>
                        </TimelineHeader>

                        <TimelineContent className="w-full pl-5 pt-2">
                          <div className="rounded-xl border border-border/80 bg-card p-4 shadow-xs space-y-3">
                            {/* Breakdown tags for System Prompt */}
                            {isSystem && promptData?.breakdown && (
                              <div className="flex flex-wrap gap-1.5 pb-1">
                                {promptData.breakdown.globalPrompt && (
                                  <Badge
                                    variant="secondary"
                                    className="gap-1 font-mono text-[10px]"
                                  >
                                    <Globe className="size-2.5 text-blue-500" />
                                    {LL.panels.agents.globalPrompt()}
                                  </Badge>
                                )}
                                {promptData.breakdown.appSystem && (
                                  <Badge
                                    variant="secondary"
                                    className="gap-1 font-mono text-[10px]"
                                  >
                                    <FileCode className="size-2.5 text-violet-500" />
                                    {LL.panels.agents.appSystem()}
                                  </Badge>
                                )}
                                {promptData.breakdown.componentsText && (
                                  <Badge
                                    variant="secondary"
                                    className="gap-1 font-mono text-[10px] text-teal-600 dark:text-teal-400 bg-teal-500/10 border-teal-500/30"
                                  >
                                    <Blocks className="size-2.5" />
                                    {LL.panels.agents.injectedComponents()}
                                  </Badge>
                                )}
                                {promptData.breakdown.selectedElementText && (
                                  <Badge
                                    variant="secondary"
                                    className="gap-1 font-mono text-[10px] text-amber-600 dark:text-amber-400 border-amber-500/30"
                                  >
                                    <MousePointerClick className="size-2.5" />
                                    {LL.panels.agents.selectedElementContext()} (#
                                    {attachedElement?.nodeId})
                                  </Badge>
                                )}
                                {promptData.breakdown.openApiText && (
                                  <Badge
                                    variant="secondary"
                                    className="gap-1 font-mono text-[10px]"
                                  >
                                    <Plug className="size-2.5 text-emerald-500" />
                                    {LL.panels.agents.injectedOpenApi()}
                                  </Badge>
                                )}
                              </div>
                            )}

                            {/* Selected Element Spec Detail if user message attached */}
                            {isUser && item.selectedElement && (
                              <div className="rounded-lg bg-zinc-950 p-2.5 font-mono text-[10px] text-zinc-300 border border-zinc-800">
                                <span className="text-zinc-500 block mb-1 font-semibold">
                                  // Attached Target Element Spec
                                </span>
                                <pre className="whitespace-pre-wrap break-all overflow-x-auto">
                                  <code>{JSON.stringify(item.selectedElement, null, 2)}</code>
                                </pre>
                              </div>
                            )}

                            {/* Render Content: Markdown or Raw Code */}
                            {renderMode === "markdown" ? (
                              <div className="rounded-lg bg-muted/20 p-3.5">
                                {(() => {
                                  if (isAssistant) {
                                    const parsed = splitContentAndUiActions(item.content);
                                    return (
                                      <div className="space-y-2">
                                        {parsed.displayText && (
                                          <MarkdownContent content={parsed.displayText} />
                                        )}
                                        {parsed.actions && parsed.actions.length > 0 && (
                                          <div className="mt-2 rounded-md bg-zinc-950 p-2.5 text-[11px] font-mono text-zinc-200 border border-zinc-800">
                                            <div className="text-emerald-400 font-semibold mb-1">
                                              ⚡ UI Document Actions ({parsed.actions.length} ops)
                                            </div>
                                            <pre className="whitespace-pre-wrap break-all overflow-x-auto">
                                              <code>{JSON.stringify(parsed.actions, null, 2)}</code>
                                            </pre>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  }
                                  return (
                                    <MarkdownContent content={item.content || "(empty message)"} />
                                  );
                                })()}
                              </div>
                            ) : (
                              <div className="relative rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-100 shadow-inner overflow-hidden">
                                <pre className="p-3.5 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-all select-text overflow-x-auto">
                                  <code>{item.content || "(empty message)"}</code>
                                </pre>
                              </div>
                            )}
                          </div>
                        </TimelineContent>
                      </TimelineItem>
                    );
                  })}
                </Timeline>
              </div>
            )}

            {/* 2. FULL SYSTEM PROMPT VIEW */}
            {activeTab === "system" && (
              <div className="space-y-4">
                {/* Breakdown cards overview */}
                {promptData?.breakdown && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* Base Prompt Card */}
                    <div
                      className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-3 cursor-pointer hover:bg-violet-500/10 transition-colors"
                      onClick={() => setActiveTab("basePrompt")}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-semibold text-violet-600 dark:text-violet-400 flex items-center gap-1.5">
                          <FileCode className="size-3.5" />
                          Base Prompt
                        </span>
                        <Badge variant="outline" className="text-[9px] font-mono">
                          {basePromptText.length} chars
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground line-clamp-2">
                        Global deployment prompt + App base system instructions.
                      </p>
                    </div>

                    {/* Components Card */}
                    <div
                      className="rounded-xl border border-teal-500/30 bg-teal-500/5 p-3 cursor-pointer hover:bg-teal-500/10 transition-colors"
                      onClick={() => setActiveTab("components")}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-semibold text-teal-600 dark:text-teal-400 flex items-center gap-1.5">
                          <Blocks className="size-3.5" />
                          Injected Components
                        </span>
                        <Badge variant="outline" className="text-[9px] font-mono">
                          {injectedComponentsText.length} chars
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground line-clamp-2">
                        {injectedComponentsText
                          ? "Published components schema & props injected."
                          : "No components injected."}
                      </p>
                    </div>

                    {/* Target Element Context Card */}
                    {attachedElement && (
                      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                            <MousePointerClick className="size-3.5" />
                            Target Element
                          </span>
                          <Badge variant="outline" className="text-[9px] font-mono">
                            #{attachedElement.nodeId}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground line-clamp-2">
                          Type: {attachedElement.type} — strict patch editing rules active.
                        </p>
                      </div>
                    )}

                    {/* OpenAPI Specs Card */}
                    {promptData.breakdown.openApiText && (
                      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                            <Plug className="size-3.5" />
                            OpenAPI Specs
                          </span>
                          <Badge variant="outline" className="text-[9px] font-mono">
                            {promptData.breakdown.openApiText.length} chars
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground line-clamp-2">
                          Endpoints & schema definitions injected.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Main Content: Markdown Mode vs Raw Mode */}
                {renderMode === "markdown" ? (
                  <div className="rounded-xl border border-border/80 bg-muted/10 p-5 shadow-inner">
                    <MarkdownContent content={systemPromptText} />
                  </div>
                ) : (
                  <div className="relative rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-100 shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-3.5 py-1.5 bg-zinc-900 border-b border-zinc-800 text-[10px] text-zinc-400 font-mono">
                      <span>system_prompt.txt</span>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="text-zinc-400 hover:text-zinc-200"
                        onClick={() => handleCopy("system_tab", systemPromptText)}
                      >
                        {copiedKey === "system_tab" ? (
                          <Check className="size-3 text-emerald-400" />
                        ) : (
                          <Copy className="size-3" />
                        )}
                      </Button>
                    </div>
                    <pre className="p-4 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-all select-text overflow-x-auto">
                      <code>{systemPromptText}</code>
                    </pre>
                  </div>
                )}
              </div>
            )}

            {/* 3. BASE PROMPT DEDICATED VIEW */}
            {activeTab === "basePrompt" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileCode className="size-4 text-violet-500" />
                    <span className="font-semibold text-xs text-foreground">
                      Injected Base Prompt (Global + App System)
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 text-[10px] gap-1 px-2"
                    onClick={() => handleCopy("base_prompt", basePromptText)}
                  >
                    <Copy className="size-3" />
                    <span>Copy Base Prompt</span>
                  </Button>
                </div>

                {renderMode === "markdown" ? (
                  <div className="rounded-xl border border-border/80 bg-muted/10 p-5 shadow-inner">
                    <MarkdownContent content={basePromptText} />
                  </div>
                ) : (
                  <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 font-mono text-[11px] text-zinc-200 shadow-inner">
                    <pre className="whitespace-pre-wrap break-all overflow-x-auto">
                      <code>{basePromptText}</code>
                    </pre>
                  </div>
                )}
              </div>
            )}

            {/* 4. INJECTED COMPONENTS DEDICATED VIEW */}
            {activeTab === "components" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Blocks className="size-4 text-teal-500" />
                    <span className="font-semibold text-xs text-foreground">
                      Injected Components Specification
                    </span>
                  </div>
                  {injectedComponentsText && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 text-[10px] gap-1 px-2"
                      onClick={() => handleCopy("components_tab", injectedComponentsText)}
                    >
                      <Copy className="size-3" />
                      <span>Copy Components</span>
                    </Button>
                  )}
                </div>

                {injectedComponentsText ? (
                  renderMode === "markdown" ? (
                    <div className="rounded-xl border border-border/80 bg-muted/10 p-5 shadow-inner">
                      <MarkdownContent content={injectedComponentsText} />
                    </div>
                  ) : (
                    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 font-mono text-[11px] text-zinc-200 shadow-inner">
                      <pre className="whitespace-pre-wrap break-all overflow-x-auto">
                        <code>{injectedComponentsText}</code>
                      </pre>
                    </div>
                  )
                ) : (
                  <div className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground text-xs space-y-2">
                    <Blocks className="size-8 mx-auto opacity-40 text-teal-500" />
                    <p>{LL.panels.agents.noInjectedComponents()}</p>
                    <p className="text-[11px]">
                      Configure injected components in Admin Console &gt; AI Prompts for this app.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* 5. USER CONTEXT DEDICATED VIEW */}
            {activeTab === "userContext" && (
              <div className="space-y-4">
                {/* Session Information Card */}
                <div className="rounded-xl border border-border/70 bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-border/50 pb-2">
                    <div className="flex items-center gap-2">
                      <User className="size-4 text-blue-500" />
                      <span className="font-semibold text-xs text-foreground">
                        {activeSession?.title || "Active Session"}
                      </span>
                    </div>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      ID: {activeSession?.id}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-muted-foreground block text-[11px]">
                        Prompt Profile:
                      </span>
                      <span className="font-medium text-foreground">
                        {selectedPrompt?.name || "Default Profile"} (
                        {selectedPrompt?.key || "default"})
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[11px]">
                        Messages Count:
                      </span>
                      <span className="font-medium text-foreground">
                        {activeSession?.messages.length || 0} messages
                      </span>
                    </div>
                  </div>
                </div>

                {/* Target Selected Element Card */}
                <div className="rounded-xl border border-border/70 bg-card p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                      <MousePointerClick className="size-3.5 text-amber-500" />
                      <span>Target Canvas Element</span>
                    </div>
                    {attachedElement ? (
                      <Badge
                        variant="secondary"
                        className="font-mono text-[10px] text-amber-600 bg-amber-500/10"
                      >
                        Attached: #{attachedElement.nodeId} ({attachedElement.type})
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        None attached
                      </Badge>
                    )}
                  </div>

                  {attachedElement ? (
                    <div className="rounded-lg bg-zinc-950 p-3 font-mono text-[11px] text-zinc-200 border border-zinc-800">
                      <pre className="whitespace-pre-wrap break-all overflow-x-auto">
                        <code>{JSON.stringify(attachedElement, null, 2)}</code>
                      </pre>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      No element selected on the canvas. Select an element on the canvas to attach
                      its props and structure to the prompt context.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* 6. RAW PAYLOAD DEDICATED VIEW */}
            {activeTab === "payload" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-muted-foreground">
                    Exact JSON payload dispatched to the backend AI chat endpoint:
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 text-[10px] gap-1 px-2"
                    onClick={() =>
                      handleCopy("payload_tab", JSON.stringify(fullRequestPayload, null, 2))
                    }
                  >
                    <Copy className="size-3" />
                    <span>Copy Payload</span>
                  </Button>
                </div>
                <div className="rounded-xl bg-zinc-950 p-4 font-mono text-[11px] text-zinc-200 border border-zinc-800 shadow-inner">
                  <pre className="whitespace-pre-wrap break-all overflow-x-auto">
                    <code>{JSON.stringify(fullRequestPayload, null, 2)}</code>
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
