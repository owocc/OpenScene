# OpenScene Solid integration example

`examples/solid-vite` is a real two-package OpenScene app. The browser uses the framework-neutral `@openscene-ai/javascript` client and renders through `@openscene-ai/solid`.

This example deliberately contains **no page JSON**. Admin is the source of published page documents, and Studio sends a draft document to an editor iframe over the OpenScene bridge. The app source only declares the component/action catalog and the manifest used by both runtime and build tooling.

## Source layout

```text
src/
├── openscene.tsx  # component/action declarations and the shared manifest
├── App.tsx        # Provider + Renderer shell
├── index.tsx      # installOpenScene, then mount the shell
├── vite-env.d.ts  # public Vite environment types
└── index.css      # app-wide styles
```

## Component and action declarations

`src/openscene.tsx` calls `defineOpenSceneSolidApp()` with `baseSolidComponents` and two small extensions:

- `SolidV1Callout` composes the shared `View` primitive.
- `SolidV1StatusCard` uses `useOpenSceneNode()` and spreads `nodeAttrs` onto its semantic `<article>` root.

Both definitions keep their Zod props schema, editor metadata, and renderer together. The `solidV1SetNotice` action follows the same pattern. `solidApp.manifest` is converted with `defineAppManifest()` and exported as the one manifest consumed by the browser client and Vite manifest plugin. Renderer functions never enter that serializable manifest.

The first Solid adapter does not support non-empty named slots. Use the flat `children` capability and the `View`/`Text`/`Button` primitives instead. Rendered nodes receive `data-node-id` for Studio selection and outlines; the identity comes from the flat `spec.elements` key, not from persisted props.

## Runtime and editor behavior

`src/index.tsx` installs `installOpenScene()` once and checks that the returned client is `window.OpenScene` before mounting `OpenSceneProvider` and `OpenSceneRenderer`.

- A normal browser visit requests the published runtime delivery using `VITE_OPENSCENE_ADMIN_URL` and the application identity in `VITE_OPENSCENE_APP_KEY`. The browser path selects the page key: `/` resolves to `home`; `/pricing` resolves to `pricing`. One application can therefore serve every Admin page without a per-build page setting.
- An editor iframe URL containing the OpenScene editor query contract skips the release fetch and waits for Studio's Protocol v2 `DOCUMENT_SET` message.
- The client owns fetch, MessagePort, immutable document snapshots, runtime state, and error reporting. The Solid adapter only subscribes and renders.

No runtime key or page fallback belongs in this bundle. If runtime delivery must be private, point the public client URL at an application-owned same-origin proxy instead of exposing a secret to Vite.

## Development and build

```bash
vp install
vp dev
vp build
```

Copy `.env.example` to a local env file. `VITE_OPENSCENE_ADMIN_URL` and `VITE_OPENSCENE_APP_KEY` are browser-visible configuration and may be included in client assets; the app key is an identity, not a credential. The separate build-only `OPENSCENE_ADMIN_URL`, `OPENSCENE_APP_ID`, and `OPENSCENE_APP_KEY` values are read by `openSceneManifestPlugin({ manifest })` during Vite `closeBundle`; they publish the central manifest with the server-side app key and are never referenced by client source or injected into generated assets. If all three build values are absent, publishing is skipped; a partial set fails the build.
