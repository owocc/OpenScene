# OpenScene React + Vite integration example

This example keeps the host application in control. It defines React component and action extensions, then mounts one query-driven `<OpenScene />` renderer. OpenScene does not create or inject a host application identity.

## Source layout

```text
src/
├── openscene.tsx              # component/action definitions and build manifest
├── lib/render/renderer.tsx    # the single OpenScene runtime integration
├── App.tsx                    # host application shell
├── main.tsx                   # normal React entrypoint
└── index.css                  # app-wide styles
```

## Runtime integration

`src/lib/render/renderer.tsx` is the only integration point:

```tsx
<OpenScene
  baseUrl={import.meta.env.VITE_OPENSCENE_BASE_URL}
  components={reactComponents}
  actions={reactActions}
/>
```

The renderer derives the page key from the browser pathname and loads public JSON from:

```text
{VITE_OPENSCENE_BASE_URL}/{page-key}.json
```

The root path maps to `home.json`. No App ID, App Key, Runtime Key, or Admin request is sent by the browser.

When Studio adds the editor query parameters, the same component skips static loading and connects to Studio through the Protocol v2 bridge. The query contract is parsed by the framework-neutral JavaScript package.

## Build and manifest publishing

The Vite plugin publishes the component catalog to an existing Admin App. App ID identifies the destination; a Better Auth Publish Key authorizes only manifest writes:

```text
OPENSCENE_ADMIN_URL=https://admin.example.com
OPENSCENE_APP_ID=app_...
OPENSCENE_PUBLISH_KEY=osc_publish_...
```

These values are build-time variables and must not use the `VITE_` prefix. The Publish Key is never included in browser assets.

## Development and build

```bash
vp install
vp dev
vp build
```
