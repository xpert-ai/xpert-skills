# Model Plugins

## Typical structure

Model plugins usually live under:

```text
xpertai/models/<provider>/
├── package.json
├── scripts/
│   └── copy-assets.mjs
└── src/
    ├── index.ts
    ├── <provider>.yaml
    ├── _assets/
    ├── llm/
    ├── text-embedding/
    └── ...
```

## What changes most often

Model plugin work is usually centered on:

1. provider yaml
2. model yaml files
3. `_assets`
4. ordering files such as `_position.yaml`

Most updates do not require TypeScript changes unless runtime behavior changed.

## Recommended change order

1. sync `_assets`
2. update provider yaml
3. add or update model yaml files
4. update ordering files
5. only then decide whether TypeScript changes are required

## Build and packaging

Model plugins often need more than `tsc`.  
If yaml or assets must be copied into `dist`, also run:

```bash
npm run prepack
```

Validate packaged content:

1. `dist/index.js`
2. `dist/_assets/*`
3. `dist/<provider>.yaml`
4. `dist/llm/*.yaml`
5. `dist/text-embedding/*.yaml`

## Local and npm-based validation

Common validation paths:

1. local install via `source=code + workspacePath`
2. publish to a personal npm scope, then install through the platform UI or npm install path

If using npm for testing:

1. change package name to a publishable personal scope
2. bump version
3. build and publish
4. install by package name and version as separate values

## Frequent mistakes

1. model does not appear because ordering files were not updated
2. icon does not appear because `_assets` were not copied to `dist`
3. package installs but runtime is old because `prepack` was skipped
4. version was not bumped before npm-based testing
