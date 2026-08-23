import { createIndexedDbDraftStore } from "@openscene/javascript";
import type { DraftRecord } from "@openscene/protocol";
import type { SceneDocument } from "@openscene/protocol";

/**
 * Session-keyed local draft storage for Studio. Every edit is persisted here
 * (local-first) so a reloaded session restores the latest document, and the
 * live preview iframe is kept in sync through the bridge while editing.
 */
const store = createIndexedDbDraftStore();

export async function readLocalDraft(sessionId: string): Promise<DraftRecord | null> {
  return store.read(sessionId);
}

export async function writeLocalDraft(
  sessionId: string,
  revision: number,
  document: SceneDocument,
): Promise<void> {
  await store.write({
    sessionId,
    revision,
    document,
    updatedAt: new Date().toISOString(),
  });
}

export async function clearLocalDraft(sessionId: string): Promise<void> {
  await store.clear(sessionId);
}
