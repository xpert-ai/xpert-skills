# React Project Development

Use this reference when building or debugging React code for Xpert Agentic App plugins, especially Workbench remote components rendered in iframes.

## Remote Component Type Boundaries

Separate the source typing model from the runtime loading model. Source files should normally import React and ReactDOM from the standard packages:

```ts
import * as React from 'react'
import { createRoot } from 'react-dom/client'
```

This lets TypeScript and the editor use the official React declaration overloads. If the iframe runtime receives React from the host through `window.React` / `window.ReactDOM`, keep that behavior in esbuild aliases or shim modules during bundling instead of importing a locally exported `React` object from a `vendor.ts` file.

Do not write this in source-facing modules:

```ts
export const React = (window as any).React
```

That pattern makes `React.useState`, `useRef`, JSX factories, and downstream state variables collapse to `any`, even when a generic such as `React.useState<Editor | null>(null)` is present.

At the runtime boundary, keep host globals behind a tiny typed helper instead of exporting values through `any` or `as unknown as`:

```ts
import type * as ReactNamespace from 'react'

function readWindowGlobal<T>(key: 'React'): T {
  return window[key as keyof Window] as T
}

const ReactGlobal = readWindowGlobal<typeof ReactNamespace>('React')
```

Export typed shim members only. If a compatibility assertion is unavoidable because the host runtime injects a value that TypeScript cannot see, keep it inside one named helper at the runtime bridge or bundler shim and do not let the assertion type flow into source-facing React code.

## Local Type Dependencies

Every React remote component package must declare local React type dependencies when its source imports React directly:

```json
{
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0"
  }
}
```

Do this even if React itself is a peer dependency or supplied by the host at runtime. Without these local type packages, TypeScript may resolve `react` to `react/index.js` and treat the whole React namespace as `any`.

## Remote Typecheck Configuration

For custom remote bundling, add a dedicated remote typecheck config, such as `tsconfig.remote.json`, using the same semantics as the bundler:

- `moduleResolution: "Bundler"` when esbuild accepts extensionless source imports.
- The same JSX factory and fragment settings used by esbuild, such as `jsxFactory: "h"` and `jsxFragmentFactory: "React.Fragment"` for classic JSX output.
- Workspace source aliases used by the remote bundle, such as `@xpert-ai/plugin-shadcn-ui`.
- `strictNullChecks: true` so state like `Editor | null` remains visible instead of being displayed as just `Editor`.

Include this config in package `test` / `typecheck`. Place a thin `tsconfig.json` inside the remote component folder that extends the remote config so TS Server uses the same settings in the editor.

Example:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react",
    "jsxFactory": "h",
    "jsxFragmentFactory": "React.Fragment",
    "strictNullChecks": true,
    "noEmit": true
  },
  "include": ["src/lib/remote-components/<entry>/src/**/*.ts", "src/lib/remote-components/<entry>/src/**/*.tsx"]
}
```

## Domain Library Types

When a React remote component uses a domain library such as tldraw, import concrete types from that library and let its real schema drive code changes.

For tldraw:

- Use `Editor` for `Tldraw` `onMount` callbacks.
- Use concrete shape types or type guards, such as `TLFrameShape`, before calling shape-specific update APIs.
- Use the current schema fields and helpers, such as rich text helpers/fields, instead of guessing legacy shape props.

## Type Escape Hatches

Treat `as any`, `as unknown as`, `: any`, `: unknown`, `Record<string, any>`, broad event callback parameters, and untyped mocks as bugs to investigate, not as convenient fixes. First inspect library declarations and actual callback signatures; derive types with `Parameters<>` / `ReturnType<>` when a library does not export a named event type. For JSON-like bridge payloads, define explicit serializable value/object types and parse with guards at the boundary. Tests should use typed fixtures or local helpers rather than reintroducing `any`.

## Debugging `any`

If a hover shows `any` after adding explicit generics, first assume the imported namespace is already `any`. The generic annotation is often not the failing part.

Check module resolution:

```bash
pnpm exec tsc -p tsconfig.remote.json --noEmit --traceResolution
```

For a precise answer, use the TypeScript compiler API to inspect the symbol/type of the binding shown by the editor. Confirm that `react` resolves to `@types/react/index.d.ts`, not to an untyped `react/index.js`.
