# OpenScene Studio

Studio is a headless document editor. It does not ship a component catalog or render a UI library inside its own React tree.

At runtime, Studio is opened by an OpenScene `StudioSession`:

1. Studio bootstraps the target App draft, material manifest and preview profile from the Admin API.
2. The target App owns and publishes its material `ComponentMeta`; Studio keeps it in memory only for the current session.
3. The node tree and property editor operate on the portable `AppDocument` JSON.
4. The preview is the target App's iframe. Studio communicates with it through the Admin-compatible `cms-preview` v2 `postMessage` handshake and dedicated `MessagePort`.

The editor core follows the React migration boundary from the original Admin editor:

- `editor-state.ts` is the reducer for immutable document edits, selection, undo/redo, locale, tools and viewport state.
- `slot-tree.ts` converts flat `spec.elements` into an outline tree and preserves stable named-slot nodes such as `parent:slot:footer`.
- `material-manifest.ts` adapts only the current App manifest in memory, including `anyOf`/`oneOf`, enum and `x-editor` metadata; it is not a Studio catalog.
- `canvas-viewport.tsx` owns device size, rotation, zoom and pan around the target App iframe.

Studio drafts are currently session-local. The Admin document draft/version APIs remain the persistence boundary; a session-scoped save command can be added once that API is exposed to the Studio session token.

An empty draft is supported: `spec.root` may be an empty string while `spec.elements` is empty. A template or the first App-provided component creates the root; Studio never inserts a hidden root node.

Configure the Admin API origin when Studio and Admin are deployed separately:

```bash
VITE_OPENSCENE_ADMIN_API_BASE_URL=https://admin.example.com
```

Launch Studio using the `launchUrl` returned by `POST /api/v1/apps/{appId}/studio-sessions`.
