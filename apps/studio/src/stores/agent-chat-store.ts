import { create } from "zustand";
import {
  applyAgentUiActionsToDocument,
  extractAgentUiActions,
  type AgentUiAction,
  type SceneDocument,
} from "@openscene-ai/protocol";
import { useQueryStore } from "./query-store";
import { useStudioStore } from "./studio-store";

export interface ChatAttachment {
  id: string;
  name: string;
  size?: number;
  type?: string;
  url?: string;
  dataUrl?: string;
}

export interface SelectedElementPayload {
  nodeId: string;
  type: string;
  props?: Record<string, unknown>;
  children?: string[];
  slots?: Record<string, string[]>;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: number;
  attachments?: ChatAttachment[];
  selectedElement?: SelectedElementPayload;
}

export interface ChatSession {
  id: string;
  title: string;
  promptId?: string | null;
  promptKey?: string | null;
  createdAt: number;
  messages: ChatMessage[];
}

export interface AgentChatStoreState {
  sessions: ChatSession[];
  activeSessionId: string | null;
  isStreaming: boolean;
  error: string | null;
  aiPreviewDocument: SceneDocument | null;
  aiPreviewRevision: number;
  aiPreviewActions: AgentUiAction[] | null;

  initFromBootstrap: (bootstrap: unknown) => void;
  createSession: (promptId?: string | null, promptKey?: string | null, title?: string) => string;
  deleteSession: (id: string) => void;
  setActiveSession: (id: string) => void;
  setSessionPrompt: (sessionId: string, promptId: string | null, promptKey?: string | null) => void;
  renameSession: (sessionId: string, title: string) => void;
  clearSessionMessages: (sessionId: string) => void;
  setAiPreview: (doc: SceneDocument | null, actions?: AgentUiAction[] | null) => void;
  discardAiPreview: () => void;
  sendMessage: (
    sessionId: string,
    content: string,
    attachments?: ChatAttachment[],
    selectedElement?: SelectedElementPayload,
  ) => Promise<void>;
  stopStreaming: () => void;
}

function getResourceScope(): { appId: string; resourceId: string } {
  const bootstrap = useStudioStore.getState().bootstrap;
  return {
    appId: bootstrap?.app.id || "local-test-app",
    resourceId: bootstrap?.resource.id || "local-resource",
  };
}

function getStorageKey(appId: string, resourceId: string): string {
  return `openscene_sessions_${appId}_${resourceId}`;
}

function loadStoredSessions(appId?: string, resourceId?: string): ChatSession[] {
  try {
    const scope = appId && resourceId ? { appId, resourceId } : getResourceScope();
    const raw = localStorage.getItem(getStorageKey(scope.appId, scope.resourceId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveStoredSessions(sessions: ChatSession[], appId?: string, resourceId?: string) {
  try {
    const scope = appId && resourceId ? { appId, resourceId } : getResourceScope();
    localStorage.setItem(getStorageKey(scope.appId, scope.resourceId), JSON.stringify(sessions));
    void syncSessionsToBackend(sessions);
  } catch {
    // Ignore storage quota errors
  }
}

async function syncSessionsToBackend(sessions: ChatSession[]) {
  const query = useQueryStore.getState();
  const serverUrl = (query.serverUrl || "").replace(/\/$/, "");
  const sessionId = query.sessionId;
  const token = query.token;
  if (!serverUrl || !sessionId || sessionId === "local-test") return;

  // Only persist sessions that have messages to the backend database
  const validSessionsToPersist = sessions.filter((s) => s.messages.length > 0);

  try {
    await fetch(
      `${serverUrl}/api/v1/studio-sessions/${encodeURIComponent(sessionId)}/chat-sessions`,
      {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          ...(token ? { "x-openscene-session-token": token } : {}),
        },
        body: JSON.stringify(validSessionsToPersist),
      },
    );
  } catch {
    // Ignore background sync errors
  }
}

function generateId(prefix = "chat"): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

let activeAbortController: AbortController | null = null;

const initialSessions = loadStoredSessions();

export const useAgentChatStore = create<AgentChatStoreState>()((set, get) => ({
  sessions: initialSessions,
  activeSessionId: initialSessions.length > 0 ? initialSessions[0].id : null,
  isStreaming: false,
  error: null,
  aiPreviewDocument: null,
  aiPreviewRevision: 1,
  aiPreviewActions: null,

  setAiPreview: (doc, actions = null) => {
    set((state) => ({
      aiPreviewDocument: doc,
      aiPreviewRevision: state.aiPreviewRevision + 1,
      aiPreviewActions: actions,
    }));
  },

  discardAiPreview: () => {
    set({ aiPreviewDocument: null, aiPreviewActions: null });
  },
  initFromBootstrap: (bootstrapRaw: unknown) => {
    const b = bootstrapRaw as
      | {
          app: { id: string };
          resource: { id: string; defaultPromptId?: string | null };
          prompts?: Array<{ id: string; key: string; isDefault?: boolean }>;
          chatSessions?: unknown[];
        }
      | undefined;
    if (!b) return;

    const defaultPrompt = (b.prompts || []).find((p) => p.isDefault);
    const defaultPromptId = b.resource.defaultPromptId || defaultPrompt?.id || null;
    const defaultPromptKey = defaultPrompt?.key || null;

    if (b.chatSessions && Array.isArray(b.chatSessions) && b.chatSessions.length > 0) {
      const loaded = b.chatSessions as ChatSession[];
      set({ sessions: loaded, activeSessionId: loaded[0].id });
      saveStoredSessions(loaded, b.app.id, b.resource.id);
      return;
    }

    const local = loadStoredSessions(b.app.id, b.resource.id);
    if (local.length > 0) {
      set({ sessions: local, activeSessionId: local[0].id });
      return;
    }

    // Initial blank session in UI (not written to DB until first message)
    const firstId = generateId("session");
    const firstSession: ChatSession = {
      id: firstId,
      title: "Chat 1",
      promptId: defaultPromptId,
      promptKey: defaultPromptKey,
      createdAt: Date.now(),
      messages: [],
    };
    set({ sessions: [firstSession], activeSessionId: firstId });
  },

  createSession: (promptId, promptKey, title) => {
    const state = get();

    // 1. Check if current active session is already empty -> reuse it!
    const currentActive = state.sessions.find((s) => s.id === state.activeSessionId);
    if (currentActive && currentActive.messages.length === 0) {
      if (promptId !== undefined || promptKey !== undefined) {
        const updated = state.sessions.map((s) =>
          s.id === currentActive.id
            ? { ...s, promptId: promptId || s.promptId, promptKey: promptKey || s.promptKey }
            : s,
        );
        set({ sessions: updated, activeSessionId: currentActive.id, error: null });
      }
      return currentActive.id;
    }

    // 2. Check if any other session in the list is already empty -> reuse it!
    const existingEmpty = state.sessions.find((s) => s.messages.length === 0);
    if (existingEmpty) {
      if (promptId !== undefined || promptKey !== undefined) {
        const updated = state.sessions.map((s) =>
          s.id === existingEmpty.id
            ? { ...s, promptId: promptId || s.promptId, promptKey: promptKey || s.promptKey }
            : s,
        );
        set({ sessions: updated, activeSessionId: existingEmpty.id, error: null });
      } else {
        set({ activeSessionId: existingEmpty.id, error: null });
      }
      return existingEmpty.id;
    }

    // 3. All existing sessions have messages -> create a new blank session
    const id = generateId("session");
    const newSession: ChatSession = {
      id,
      title: title || `Chat ${state.sessions.length + 1}`,
      promptId: promptId || null,
      promptKey: promptKey || null,
      createdAt: Date.now(),
      messages: [],
    };
    const updated = [newSession, ...state.sessions];
    set({ sessions: updated, activeSessionId: id, error: null });
    return id;
  },
  deleteSession: (id) => {
    const updated = get().sessions.filter((s) => s.id !== id);
    const nextActive =
      get().activeSessionId === id
        ? updated.length > 0
          ? updated[0].id
          : null
        : get().activeSessionId;
    saveStoredSessions(updated);
    set({ sessions: updated, activeSessionId: nextActive });
  },

  setActiveSession: (id) => {
    set({ activeSessionId: id, error: null });
  },

  setSessionPrompt: (sessionId, promptId, promptKey) => {
    const updated = get().sessions.map((s) =>
      s.id === sessionId ? { ...s, promptId: promptId || null, promptKey: promptKey || null } : s,
    );
    saveStoredSessions(updated);
    set({ sessions: updated });
  },

  renameSession: (sessionId, title) => {
    const updated = get().sessions.map((s) => (s.id === sessionId ? { ...s, title } : s));
    saveStoredSessions(updated);
    set({ sessions: updated });
  },

  clearSessionMessages: (sessionId) => {
    const updated = get().sessions.map((s) => (s.id === sessionId ? { ...s, messages: [] } : s));
    saveStoredSessions(updated);
    set({ sessions: updated });
  },

  stopStreaming: () => {
    if (activeAbortController) {
      activeAbortController.abort();
      activeAbortController = null;
    }
    set({ isStreaming: false });
  },

  sendMessage: async (sessionId, content, attachments, selectedElement) => {
    const session = get().sessions.find((s) => s.id === sessionId);
    if (!session || (!content.trim() && (!attachments || attachments.length === 0))) return;

    if (get().isStreaming) {
      get().stopStreaming();
    }

    const queryState = useQueryStore.getState();
    const studioState = useStudioStore.getState();
    const serverUrl = (queryState.serverUrl || "").replace(/\/$/, "");
    const token = queryState.token;
    const studioSessionId = queryState.sessionId;
    const appId = studioState.bootstrap?.app.id || "local-test-app";

    const userMessage: ChatMessage = {
      id: generateId("msg_user"),
      role: "user",
      content: content.trim(),
      createdAt: Date.now(),
      attachments: attachments && attachments.length > 0 ? [...attachments] : undefined,
      selectedElement: selectedElement ? { ...selectedElement } : undefined,
    };

    const assistantMessageId = generateId("msg_assistant");
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      createdAt: Date.now(),
    };

    const newMessages = [...session.messages, userMessage, assistantMessage];
    const sessionsWithUser = get().sessions.map((s) =>
      s.id === sessionId
        ? {
            ...s,
            title: s.messages.length === 0 ? content.slice(0, 24) || "New Chat" : s.title,
            messages: newMessages,
          }
        : s,
    );
    saveStoredSessions(sessionsWithUser);
    set({ sessions: sessionsWithUser, isStreaming: true, error: null });

    const abortController = new AbortController();
    activeAbortController = abortController;

    try {
      // Format clean message history (no prompt string pollution on client)
      const history = [...session.messages, userMessage].map((m) => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content || "(attachment)",
      }));

      const endpoint =
        studioSessionId && studioSessionId !== "local-test"
          ? `${serverUrl}/api/v1/studio-sessions/${encodeURIComponent(studioSessionId)}/chat`
          : `${serverUrl}/api/v1/ai/chat`;

      const headers: Record<string, string> = {
        "content-type": "application/json",
      };
      if (token) {
        headers["x-openscene-session-token"] = token;
      }

      const bodyPayload = {
        appId,
        promptId: session.promptId || undefined,
        promptKey: session.promptKey || undefined,
        selectedElement: selectedElement || undefined,
        messages: history,
        format: "stream",
      };

      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(bodyPayload),
        signal: abortController.signal,
      });

      if (!response.ok) {
        let errorMsg = `Chat failed (${response.status})`;
        try {
          const errorData = await response.json();
          if (errorData?.detail) errorMsg = errorData.detail;
          else if (errorData?.title) errorMsg = errorData.title;
        } catch {
          // ignore json parse error
        }
        throw new Error(errorMsg);
      }

      if (!response.body) {
        throw new Error("No response body received from server");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        accumulated += chunk;

        // Stream update into assistant message
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId
              ? {
                  ...s,
                  messages: s.messages.map((m) =>
                    m.id === assistantMessageId ? { ...m, content: accumulated } : m,
                  ),
                }
              : s,
          ),
        }));

        // Live stream parsing: render AI preview canvas in real time
        try {
          const liveActions = extractAgentUiActions(accumulated);
          if (liveActions && liveActions.length > 0) {
            const currentDoc = useStudioStore.getState().document;
            const liveDoc = applyAgentUiActionsToDocument(currentDoc, liveActions);
            set((state) => ({
              aiPreviewDocument: liveDoc,
              aiPreviewRevision: state.aiPreviewRevision + 1,
              aiPreviewActions: liveActions,
            }));
          }
        } catch {
          // ignore live chunk parse errors
        }
      }

      // Final extraction once complete
      const finalActions = extractAgentUiActions(accumulated);
      if (finalActions && finalActions.length > 0) {
        const currentDoc = useStudioStore.getState().document;
        const finalDoc = applyAgentUiActionsToDocument(currentDoc, finalActions);
        set((state) => ({
          aiPreviewDocument: finalDoc,
          aiPreviewRevision: state.aiPreviewRevision + 1,
          aiPreviewActions: finalActions,
        }));
      }
      // Final save
      saveStoredSessions(get().sessions);
      set({ isStreaming: false });
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        set({ isStreaming: false });
        return;
      }
      const errorMessage = err instanceof Error ? err.message : "Chat request failed";
      set((state) => ({
        isStreaming: false,
        error: errorMessage,
        sessions: state.sessions.map((s) =>
          s.id === sessionId
            ? {
                ...s,
                messages: s.messages.map((m) =>
                  m.id === assistantMessageId
                    ? {
                        ...m,
                        content: m.content || `⚠️ Error: ${errorMessage}`,
                      }
                    : m,
                ),
              }
            : s,
        ),
      }));
      saveStoredSessions(get().sessions);
    } finally {
      if (activeAbortController === abortController) {
        activeAbortController = null;
      }
    }
  },
}));
