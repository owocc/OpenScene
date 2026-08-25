# OpenScene React + Vite integration example

`examples/react-vite` is a complete React application integrated with OpenScene and `@json-render/react`. The browser uses the framework-neutral `@openscene/javascript` client and renders through `@openscene/react`.

This example deliberately contains **no hardcoded page JSON**. Admin is the source of published page documents, and Studio sends draft documents to the preview iframe over the OpenScene bridge protocol. The app source declares the component/action catalog and the manifest used by both runtime and build tooling.

## Source layout

```text
src/
├── openscene.tsx  # component/action declarations and the shared manifest
├── App.tsx        # Provider + Renderer shell
├── main.tsx       # installOpenScene, then mount the shell
├── index.css      # app-wide styles
└── App.css        # component-level styles
```

## Component and action declarations

`src/openscene.tsx` calls `defineOpenSceneReactApp()` with `baseReactComponents` (`View`, `Text`, `Button`) and custom extensions:

- `Image`: Image component supporting `src`, `alt`, `fit`, `loading`, and visual style editor.
- `ReactViteCallout`: Composes the shared `View` primitive with tone variants (`info`, `success`, `warning`).
- `ReactViteStatusCard`: Uses `useOpenSceneNode()` and spreads `nodeAttrs` onto its semantic `<article>` root.
- `ReactViteOpenApiProvider`: Requests an OpenAPI operation and renders JSON response.
- `reactViteSetNotice`: Action for storing runtime notice without altering the canonical page document.

Both definitions keep their Zod props schema, editor metadata, and renderer together. `reactApp.manifest` is converted with `defineAppManifest()` and exported as the manifest consumed by the browser client and Vite manifest plugin.

## Runtime and editor behavior

`src/main.tsx` installs `installOpenScene()` once and checks that the returned client is `window.OpenScene` before mounting `OpenSceneProvider` and `OpenSceneRenderer`.

- A normal browser visit requests the published runtime delivery using `VITE_OPENSCENE_ADMIN_URL` and the application identity in `VITE_OPENSCENE_APP_KEY`. The browser path selects the page key: `/` resolves to `home`; `/pricing` resolves to `pricing`.
- An editor iframe URL containing the OpenScene editor query contract skips the release fetch and connects with Studio's Protocol v2 bridge.
- The client owns fetch, MessagePort, immutable document snapshots, runtime state, and error reporting. The React adapter subscribes and renders with `@json-render/react`.

## Development and build

```bash
vp install
vp dev
vp build
```
