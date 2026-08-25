# OpenScene Studio

Studio is a headless document editor. It does not ship a component catalog or render a UI library inside its own React tree.

At runtime, Studio is opened by an OpenScene `StudioSession`:

1. Studio bootstraps the target App's canonical Protocol `SceneDocument`, manifest and preview profile from the Admin API.
2. The target App owns and publishes its component manifest; Studio adapts it in memory for the current session only.
3. The node tree and property editor edit the json-render flat `spec.elements` map.
4. The preview is the target App's iframe. Studio uses the Protocol bridge v2 window handshake and dedicated `MessagePort`.
5. Saving uses the session-scoped draft endpoint and its optimistic server revision; a conflict never overwrites local edits.

The editor core follows the React migration boundary:

- `editor-state.ts` is the reducer for immutable canonical document edits, normalized multi-selection, undo/redo, locale, tools and viewport state.
- `slot-tree.ts` converts flat `spec.elements` into an outline tree and preserves stable named-slot nodes such as `parent:slot:footer`.
- `material-manifest.ts` adapts only the current App manifest in memory, including schema and editor metadata; it is not a Studio catalog.
- `canvas-viewport.tsx` owns device size, rotation, zoom and pan around the target App iframe.

The desktop workspace has three surfaces: developer mode keeps the node tree and property inspector as floating panels around the iframe canvas, preview mode clears those editor panels, and text mode shows canonical page information.

Configure the Admin API origin when Studio and Admin are deployed separately. Studio launch URLs include the encoded `server-url` and `sessionId`; session tokens remain in the URL fragment.

For local UI and iframe bridge testing, use the development-only session fixture:

```text
http://127.0.0.1:5173/?sessionId=local-test
```

The fixture uses `createEmptySceneDocument()` and points at the running `examples/solid-vite` development server. It has no Admin persistence or session token and uses the same Protocol bridge v2 as a production preview.
