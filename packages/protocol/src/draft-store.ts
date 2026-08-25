import { z } from "zod";

import { SceneDocumentSchema, type SceneDocument } from "./document.ts";

/**
 * A locally persisted document draft, keyed by the Studio session id.
 * Studio writes every edit here (local-first) and the live preview in the
 * iframe is kept in sync through the bridge; the record lets a reloaded
 * Studio session restore the latest local state before any server round trip.
 */
export interface DraftRecord {
  /** Studio session this draft belongs to. */
  sessionId: string;
  /** Local edit counter at the time of the last write. */
  revision: number;
  document: SceneDocument;
  /** ISO timestamp of the last write. */
  updatedAt: string;
}

export const DraftRecordSchema = z.object({
  sessionId: z.string().min(1),
  revision: z.number().int().nonnegative(),
  document: SceneDocumentSchema,
  updatedAt: z.string().min(1),
});

/**
 * Storage contract for session-keyed document drafts. The canonical browser
 * implementation is IndexedDB-backed (`@openscene-ai/javascript`), but the
 * interface keeps the core layer framework- and backend-agnostic.
 */
export interface DocumentDraftStore {
  /** Latest locally stored draft for the session, or null. */
  read(sessionId: string): Promise<DraftRecord | null>;
  /** Persists (or overwrites) the session draft. */
  write(record: DraftRecord): Promise<void>;
  /** Removes the session draft (e.g. after a successful server save). */
  clear(sessionId: string): Promise<void>;
}
