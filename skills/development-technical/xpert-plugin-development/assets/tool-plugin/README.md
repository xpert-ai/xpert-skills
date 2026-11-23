# Xpert tool plugin

This scaffold has **no business implementation**. Its initial functional test fails deliberately.
Replace `src/lib/feature.ts`, schemas, tests, descriptions and localized labels for the requested feature.
See [the plugin documentation](docs/overview.mdx).

Build tooling is in `scripts/workflow.mjs`. Pass `--platform /absolute/selected/platform`
to reuse its already built SDK and TypeScript/esbuild tools without rebuilding the platform.
Without that option, install the declared development dependencies first.

```sh
node scripts/workflow.mjs test --platform /selected/platform
node scripts/workflow.mjs build --platform /selected/platform
node scripts/workflow.mjs pack --platform /selected/platform
node scripts/workflow.mjs verify-archive artifacts/package.tgz --platform /selected/platform
```

In a process-mode Computer, run these finite commands through the environment CLI's `exec`.
Local SDK validation proves compatibility with that checkout, not npm publication availability.
The clean archive check uses declared production dependencies and only SDK/contracts host peers;
it does not install into Xpert or prove real tool execution. Deployment and live checks remain required.
