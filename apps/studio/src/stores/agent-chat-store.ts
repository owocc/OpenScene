import { create } from "zustand";
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

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: number;
  attachments?: ChatAttachment[];
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

  createSession: (promptId?: string | null, promptKey?: string | null, title?: string) => string;
  deleteSession: (id: string) => void;
  setActiveSession: (id: string) => void;
  setSessionPrompt: (sessionId: string, promptId: string | null, promptKey?: string | null) => void;
  renameSession: (sessionId: string, title: string) => void;
  clearSessionMessages: (sessionId: string) => void;
  sendMessage: (
    sessionId: string,
    content: string,
    attachments?: ChatAttachment[],
  ) => Promise<void>;
  stopStreaming: () => void;
}

const STORAGE_KEY = "openscene_studio_agent_sessions";

function loadStoredSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveStoredSessions(sessions: ChatSession[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    // Ignore storage quota errors
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

  createSession: (promptId, promptKey, title) => {
    const id = generateId("session");
    const newSession: ChatSession = {
      id,
      title: title || `Session ${get().sessions.length + 1}`,
      promptId: promptId || null,
      promptKey: promptKey || null,
      createdAt: Date.now(),
      messages: [],
    };
    const updated = [newSession, ...get().sessions];
    saveStoredSessions(updated);
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

  sendMessage: async (sessionId, content, attachments) => {
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
      // Format messages for AI completion
      const history = [...session.messages, userMessage].map((m) => {
        let textContent = m.content;
        if (m.attachments && m.attachments.length > 0) {
          const filesSummary = m.attachments.map((a) => `[Attachment: ${a.name}]`).join(" ");
          textContent = `${textContent}\n\n${filesSummary}`.trim();
        }
        return {
          role: m.role as "user" | "assistant" | "system",
          content: textContent || "(attachment)",
        };
      });

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
