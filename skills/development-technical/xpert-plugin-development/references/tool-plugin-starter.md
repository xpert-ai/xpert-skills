# Host-native tool plugin starter

For a new decorated tool plugin, use the bundled starter to avoid rediscovering registration and packaging. It supplies a typed server module/provider, strict input/output schemas, a domain-error envelope, docs and deterministic build/test/package commands. It supplies **no business implementation**: the feature throws `NOT_IMPLEMENTED` and its business test deliberately fails. Adapt both to the requested behavior.

Run the generator in the selected environment (through process-mode `exec` when applicable). Discover the paths; these variables are examples, not machine defaults:

```sh
python3 "$PLUGIN_SKILL/scripts/scaffold-tool-plugin.py" \
  --platform "$PLATFORM" --dest "$PROJECT/plugins/my-tool" \
  --name @acme/plugin-my-tool --tool my_tool --namespace my_tool --level tenant
```

The target must not exist. The selected platform's SDK must already be built. The generator discovers exact local SDK, TypeScript, esbuild and Zod versions; this is a paired-source development setup, not proof that those versions are published to npm. Choose installation level for the intended scope, following `general.md`.

Choose a namespace and tool names that are unique among plugins in the intended installation scope. The starter derives the provider from the namespace, such as `my_tool_tools`, and converts underscores to hyphens for the component key, `my-tool-tools`. Component keys must use lowercase kebab-case and be unique among providers within the same plugin. Different plugins may reuse a component key such as `tools`; public provider and tool names still require scope-wide uniqueness. Retain a stable component key and use the plugin name plus its actual descriptor key for live verification.

After generation, read each actual destination file with the Coding CLI's file-reading tool before overwriting it. Reading the starter template or inspecting a file through a shell may not satisfy that CLI's read-before-write guard. If a write is rejected for this reason, read the named generated file and retry the intended edit; this is a local editing prerequisite, not a reason to investigate more host internals.

Implement `src/lib/feature.ts`, its business tests and schemas; update the provider description, package metadata and docs. Keep the small registration wrapper unless the feature needs different capabilities. Expected domain errors use `XpertToolResult`, `resultFormat: 'tool_result'`, `isError: true` and the declared error branch of `structuredContent`. Unexpected failures remain errors. The sample error code is not a product requirement.

Start with these generated files and the public interfaces they already use. For
additional tools in the same plugin, extend the existing decorated-method and
schema pattern while retaining one provider/component identity. Implement and run
the business tests before investigating installation state. You do not need to
reverse-engineer the host's MCP publication, tool runtime, dependency injection or
uninstall implementation to fill in this starter. Use a concrete compiler,
descriptor-validation or live-call failure to select any deeper inspection.

From the generated plugin directory, run in the selected Node environment:

```sh
node scripts/workflow.mjs test --platform "$PLATFORM"
node scripts/workflow.mjs pack --platform "$PLATFORM"
node scripts/workflow.mjs verify-archive artifacts/<package>-<version>.tgz --platform "$PLATFORM"
```

`pack` includes one build. Reuse its successful output instead of rebuilding solely for a report. The scripts compile only this plugin, using the selected platform's existing build tools and SDK declarations. They do not rebuild platform libraries. Development tests may use the platform's module resolution; archive verification uses a fresh npm installation with `NODE_PATH` removed and supplies only the target loader's supported SDK/contracts peers. Runtime libraries such as Zod remain declared plugin dependencies. Do not optimize for zero dependencies at the expense of a working contract.

Archive verification checks package import, version, scope, namespace, server-module registration and the SDK's decorated tool descriptor validation. Keep output branches strict; the target SDK accepts a `z.union` of strict objects but does not accept `z.discriminatedUnion` here. The descriptor check uses decorator metadata without constructing injected services; it does not establish host lifecycle behavior.

Verification intentionally reports `livePlatformAcceptance: false`. The CLI must still install this exact archive into the authorized Xpert instance, honor restart requirements, verify loaded identity/version and execute the actual exposed tool. Use the deployment references and save those real receipts for the coordinating Agent to review.

For starter maintenance, run `python3 scripts/test-scaffold-tool-plugin.py --platform "$PLATFORM"`. It builds two unimplemented fixtures and registers their providers together with the real SDK, then confirms component keys can be reused across plugins while a deliberate same-plugin collision is rejected. It does not install plugins or verify business behavior.
