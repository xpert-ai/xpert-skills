# Plugin Application `appConfig`

Use this reference when a plugin should appear as a visually presented Agentic App in Xpert Explore and should support a host-governed, one-click setup flow. `appConfig` is a declarative application contribution: it links marketplace presentation metadata to one Assistant template and tells the host which dedicated Workspace and optional Knowledge bases to initialize.

## Choose the Correct Contract

Do not use these similarly named surfaces interchangeably:

| Need | Contract |
| --- | --- |
| Show an App card/detail page and let an administrator initialize its Workspace, Knowledge bases, and Assistant | `PluginMarketplaceContribution.appConfig` |
| Configure deployment values, endpoints, feature flags, or credentials for the plugin runtime | `XpertPlugin.config` with `schema`, `defaults`, or `formSchema` |
| Register connector or MCP App resources | bundle manifest `apps` / `connectors` and plugin-resource contracts |
| Implement the installed application's operational UI | Workbench or Extension View manifests and remote components |
| Upgrade an already installed Assistant from a newer template | Assistant template update lifecycle |

`appConfig.presentation` describes a host-rendered marketplace and setup experience. It does not replace the application's Workbench UI, define runtime secrets, or execute arbitrary provisioning code.

Use `appConfig` when all of the following are true:

- the plugin represents a product-level Agentic App rather than only a tool, middleware, View, or template;
- one plugin-contributed Assistant template is the application's entry Assistant;
- first-time setup can be expressed as a dedicated host Workspace, optional host-managed Knowledge bases, model prerequisites, and installation of that Assistant template;
- the desired entry is the published Assistant chat, from which Workbench Views can be opened.

If setup needs additional domain records or migrations, keep those operations in an explicit, idempotent plugin bootstrap or migration path. Do not misrepresent them with `presentation.initializationSteps`, which is explanatory copy only.

## Declaration and Identity

Declare the authoritative App contribution in the loaded plugin's runtime metadata at:

```text
XpertPlugin.meta
  -> targetAppMeta.xpert
    -> marketplace.contents[]
      -> { type: 'app', name, appConfig }
```

The host resolves initialization only from effective loaded plugin metadata in the current request scope. A registry item, localized title, similarly named Assistant, or portable manifest by itself is not an initialization authority.

Identity and linkage rules:

- `name` is the stable App key. The installation identity is `<normalized-plugin-name>:<app-name>`; renaming it creates a different identity.
- `assistantTemplateKey` is the exact raw `templates[].key` contributed by the same plugin. Do not use the namespaced `<plugin-name>:<template-key>` value in `appConfig`.
- Link one App to one Assistant template, and do not link several Apps to the same template. Ambiguous links fail closed when templates are materialized.
- Do not infer linkage from display name, description, order, capability, or marketplace contribution names.
- Keep App keys, template keys, Knowledge-base keys, and declared Knowledge-base order stable after release. `appConfig` is not a resource-migration engine.

Use compile-time contract checking instead of broad casts:

```ts
import type { PluginMarketplaceContribution } from '@xpert-ai/contracts'
import type { XpertPlugin } from '@xpert-ai/plugin-sdk'

const assistantTemplateKey = 'contract-review-assistant' as const

const contractReviewApp = {
  type: 'app',
  name: 'contract-review',
  displayName: {
    en_US: 'Contract Review',
    zh_Hans: '合同审核'
  },
  description: {
    en_US: 'Review contracts with an evidence-preserving Assistant and Workbench.',
    zh_Hans: '通过保留证据的智能助理与工作台审核合同。'
  },
  icon: { type: 'emoji', value: '📄' },
  color: '#2563eb',
  appConfig: {
    scope: 'organization',
    assistantTemplateKey,
    workspace: {
      mode: 'dedicated',
      name: {
        en_US: 'Contract Review Workspace',
        zh_Hans: '合同审核工作空间'
      },
      description: {
        en_US: 'Organization workspace managed for Contract Review.',
        zh_Hans: '由合同审核应用管理的组织工作空间。'
      },
      sharing: 'organization'
    },
    knowledgebases: [
      {
        key: 'contract-library',
        name: {
          en_US: 'Contract Library',
          zh_Hans: '合同资料库'
        },
        description: {
          en_US: 'Source contracts and supporting policies.',
          zh_Hans: '源合同及相关制度材料。'
        },
        permission: 'organization',
        applicationTags: ['contract-review.primary'],
        graphRag: { enabled: false }
      }
    ],
    modelRequirements: {
      primary: true,
      embedding: true,
      vision: true,
      embeddingLabel: {
        en_US: 'Contract search embedding model',
        zh_Hans: '合同检索嵌入模型'
      },
      visionLabel: {
        en_US: 'Scanned contract vision model',
        zh_Hans: '扫描合同视觉模型'
      }
    },
    presentation: {
      tagline: {
        en_US: 'Evidence-first contract review for your organization',
        zh_Hans: '面向组织、证据优先的合同审核'
      },
      longDescription: {
        en_US: 'Extract clauses, preserve citations, coordinate review, and publish decisions.',
        zh_Hans: '提取条款、保留引用、协同复核并发布审核结论。'
      },
      developer: 'Acme',
      screenshots: ['./assets/contract-review-overview.webp'],
      features: [
        {
          key: 'evidence-review',
          title: { en_US: 'Evidence review', zh_Hans: '证据复核' },
          description: {
            en_US: 'Trace every finding to the source contract.',
            zh_Hans: '将每项发现追溯到源合同。'
          }
        }
      ],
      useCases: [
        { en_US: 'Clause risk review', zh_Hans: '条款风险审核' },
        { en_US: 'Policy compliance', zh_Hans: '制度合规检查' }
      ],
      dataScope: {
        en_US: 'Shared only inside the current organization.',
        zh_Hans: '仅在当前组织内共享。'
      },
      initializationSummary: {
        en_US: 'Xpert will prepare the application resources and publish its Assistant.',
        zh_Hans: 'Xpert 将准备应用资源并发布其智能助理。'
      },
      initializationSteps: [
        { en_US: 'Create the dedicated Workspace', zh_Hans: '创建专用工作空间' },
        { en_US: 'Create the Contract Library', zh_Hans: '创建合同资料库' },
        { en_US: 'Install and publish the Assistant', zh_Hans: '安装并发布智能助理' }
      ]
    },
    entry: { type: 'assistant-chat' }
  }
} satisfies PluginMarketplaceContribution

const plugin: XpertPlugin = {
  meta: {
    name: '@acme/plugin-contract-review',
    version: '0.1.0',
    level: 'system',
    artifactNamespace: 'contract_review',
    category: 'middleware',
    targetApps: ['xpert'],
    targetAppMeta: {
      xpert: {
        types: ['business-app', 'assistant-template', 'workbench-view'],
        capabilities: ['contract-review', 'review-workbench'],
        marketplace: {
          category: 'business-operations',
          contents: [contractReviewApp]
        }
      }
    },
    displayName: 'Contract Review',
    description: 'Contract Review Agentic App',
    author: 'Acme'
  },
  templates: [
    {
      key: assistantTemplateKey,
      title: { en_US: 'Contract Review Assistant', zh_Hans: '合同审核助理' },
      dslContent: contractReviewAssistantDsl
    }
  ],
  register() {
    return { module: ContractReviewPluginModule, global: true }
  }
}
```

Keep the full declaration in source control. Generate or test duplicated portable-manifest metadata rather than allowing the runtime `meta` and `.xpertai-plugin/plugin.json` to drift.

## Field Semantics

### Scope and Workspace

- Declare `scope: 'organization'` for an application that should initialize today. `tenant` and `personal` are stable discovery values, but the current host initializer rejects them as unsupported.
- `workspace.mode` is currently `dedicated` and `workspace.sharing` is currently `organization`.
- The host creates an `organization-shared` Workspace and marks `settings.system.kind` as `plugin-app` with the plugin and App names.
- The browser must never submit tenant, organization, Workspace, or target resource IDs. The server derives authority and scope from the authenticated request context.

### Knowledge Bases

- Each declaration creates a standard, organization-permission Knowledge base inside the App Workspace.
- `key` is a stable machine identifier. Use `applicationTags` for exact application-owned discovery; do not use localized names as lookup keys.
- `graphRag.enabled` controls whether the created Knowledge base starts with graph RAG enabled.
- `embedding` and `vision` model selections are applied to the created Knowledge bases. Require them only when the declared resources and application behavior need them.
- Keep the array order stable because repair resumes persisted resources positionally before rebuilding keyed resource references.

### Model Requirements

- `primary: true` requires at least one organization-visible LLM before setup; the normal template installation path resolves the Assistant model.
- `embedding: true` shows a required embedding-model selector and binds the selected model to managed Knowledge bases.
- `vision: true` shows a required vision-capable LLM selector and binds it to managed Knowledge bases.
- `embeddingLabel` and `visionLabel` customize the user-facing selector labels.
- Clients may submit only opaque option IDs returned by preflight. Never accept raw provider credentials, tenant scope, or arbitrary model configuration through a custom setup form.

### Presentation and Entry

- Top-level contribution fields (`displayName`, `description`, `icon`, `color`) identify the App in marketplace and template surfaces.
- `presentation` supplies the host-rendered detail and setup content: tagline, long description, screenshots, feature descriptions, use cases, data-scope explanation, initialization summary, and visible steps.
- Presentation text should use localized objects. `developer` is a plain string in the current contract.
- `dataScope` and `initializationSteps` explain behavior; they do not grant access or add initialization operations.
- The current entry contract is `entry.type: 'assistant-chat'`. After successful initialization, the host opens the published Assistant by slug. Operational dashboards and editors remain Workbench or Extension Views attached to that Assistant.

Current host rendering maps the fields as follows:

| Surface | Fields and behavior |
| --- | --- |
| Explore card and selected preview | App identity, status/action, and the first screenshot when present |
| App detail header | icon, display name, scope, status, tagline, and primary setup/open action |
| App detail media area | all screenshots when present; otherwise an icon-led fallback with `longDescription` and `useCases` |
| App detail feature area and sidebar | feature titles/descriptions, data scope, and developer |
| Setup drawer | initialization summary, first screenshot, visible initialization steps, required model selectors, preflight reason, and data scope |
| Ready action | published Assistant chat resolved from the installation's Assistant slug |

Choose the media strategy deliberately: in the current detail layout, `longDescription` and `useCases` belong to the no-screenshot fallback rather than appearing beside screenshots. Feature `icon` is part of the contract, but the current host uses a generic feature glyph; do not make comprehension depend on a custom feature icon. Populate the other presentation fields instead of assuming the host will synthesize product copy.

## Screenshot Assets

### Marketplace Card and Cover Design

For Xpert Explore and Desktop discovery App cards, design the card and its first screenshot as one composition. Both clients use the same cover, app Logo, and collapsed/expanded information hierarchy. Preserve `application.icon` across the Desktop catalog boundary rather than substituting a generic app glyph; render SVG as an isolated image, not inline untrusted markup. The first `presentation.screenshots` entry is the marketplace cover; subsequent entries may show detailed product screens. This convention is specific to the marketplace card, not a required aspect ratio for operational Workbench views or full-size detail screenshots.

| Element | Size and layout contract |
| --- | --- |
| Marketplace card and loading placeholder | `16:9`; height derives from the available card width, with no separate media/body heights. Example: 384 × 216 CSS px. |
| Responsive grid | Size columns from the actual content container, including the space left by the host sidebar. Use `repeat(auto-fill, minmax(min(100%, 22rem), 1fr))` with theme spacing; a narrow container gets one full-width card. Avoid viewport breakpoints that squeeze several tiny cards beside an expanded sidebar. |
| Cover asset | Recommended 1600 × 900 px; at least 1280 × 720 px for a new raster cover. Export an opaque, edge-to-edge 16:9 composition without baked-in outer padding, letterbox bars, rounded card frames, or a surrounding page/browser screenshot. |
| Cover rendering | Absolute full-card media, 100% width and height, `object-fit: cover`, centered by default. Clip at the card's border radius. Do not use `contain`, stretch the image, reserve a blank image band, or add image-container padding. |
| Logo | Separate square identity asset; render in the compact information header using host/theme sizing. Use a compact, solid light neutral tile (baseline 2.25rem with 0.125rem padding), theme-derived medium radius, and no extra outer ring or shadow. Keep the artwork large within the tile and suppress inherited text shadows; avoid a thick translucent plate that picks up cover details. Keep it independent of the background image so identity remains clear when the image is obscured. |

Composition and interaction:

- Keep essential cover content at least 5% inward from the top and side edges. Reserve the bottom 30% as a quiet visual area beneath the collapsed information layer; on a 1600 × 900 cover this means an 80 px side margin, a 45 px top margin, and a 270 px bottom overlay area. Do not put essential text or controls there. Scale these guides proportionally and inspect at the smallest rendered card size, especially with a two-line name.
- Place the information layer absolutely at the bottom, overlapping the image. Make the information treatment follow the host theme: white/light gray glass with dark text in light mode, dark gray glass with light text in dark mode. Use the theme background for glass and foreground for ink without inverting them in dark mode. Keep the compact Logo tile light in both modes so transparent black artwork stays legible; derive its light surface from background in light mode and foreground in dark mode. Keep a soft, image-visible vignette concentrated around the information rather than an opaque footer: the light-mode baseline is 90% opacity at the bottom and 75% through the text area; use a lighter overlay in dark mode with 60% at the bottom and 50% through the text area. Both fade to fully transparent at the top. Position the intermediate gradient stop near the content top (65% from the bottom when collapsed, 85% when expanded) so text stays readable against covers of the opposite brightness in either theme. Limit the extra fade above the content to about 0.75rem; do not dim a large band of the cover above the text. Keep the rest of the transition inside the information area without growing the card or adding content padding, and avoid a narrow bright strip. Give collapsed and expanded states correctly sized, fixed gradient surfaces and blend them with opacity. Use only subtle image blur (about 0.25rem at 25% layer opacity), masked gradually to transparent, so cover details remain visible. Remove a hard top border, keep text crisp without an inherited text shadow, and keep solid primary-button labels unshadowed. Derive radius, spacing, density and fade lengths from theme variables/rem units. Give secondary copy and badges quieter ink, and verify collapsed and expanded names, descriptions, status badges, Logo tiles and actions against bright and dark covers in both themes. Test a real theme switch and restore the original preference after verification.
- In marketplace cards, apply ordinary `filter: blur(...)` to a copy of the card's own cover instead of `backdrop-filter` on the moving information panel. Keep the filtered copy full-card sized and aligned with the original cover throughout expansion (counter-translate it when its parent moves), then clip it within the information region and the card radius. Use the same fallback composition when no cover loads. Native macOS Electron testing reproduced local glass flicker with the translated backdrop-filter panel and confirmed that the aligned image-filter implementation preserves the effect without flicker. Verify rapid enter/leave, keyboard focus and narrow layouts in native Electron; browser previews alone do not establish absence of this symptom. For fullscreen Desktop Dialog blur, filter the background content separately from the portaled Dialog.
- At rest, show only the Logo, App name, and compact status. On hover or keyboard focus within the card, expand developer, summary, tags/scope, and the primary action upward without changing the card dimensions or moving adjacent cards. Expanded content can obscure most of the cover, so the image must not be the only source of product identity or required information.
- Keep focus and primary actions reachable. On touch devices without hover, expose the details and action directly. Keep the expanded card compact without an internal vertical scrollbar: place the developer beneath the name within the identity row, limit the summary to two lines, and share one compact footer between tags and actions. Collapse excess tags into a count; expose complete text and tags in App details. Bound text rather than clipping actions or making the card taller. Respect reduced motion.
- When a screenshot is absent, use a full-card, theme-derived background composition and centered identity icon. Do not allocate an empty preview compartment. A supplied cover with baked-in blank borders must be recomposed or replaced; `cover` cannot remove padding inside the asset without also cropping its content.
- For legacy image ratios, centered `cover` is the fallback. Inspect the crop: if essential copy or UI is lost, produce a dedicated 16:9 first cover rather than restoring letterboxing. Use the original screenshot later in the detail gallery where users can inspect it fully.

Validate the installed gallery at wide desktop and narrow content widths with the sidebar present. Check identical card proportions, full image coverage on all four sides, no padding bands or horizontal overflow, safe title placement, readable gradient text, and default/hover/keyboard/touch states. Capture default and expanded evidence; a cover asset viewed by itself is not sufficient validation.

### Packaging

Remote HTTP(S), root-relative host URLs, and existing data URLs pass through. For a bundle-local screenshot:

1. Put the file inside the plugin bundle.
2. Use the same relative path in `appConfig.presentation.screenshots`.
3. Declare that path in `.xpertai-plugin/plugin.json` under `assets.screenshots`.
4. Ensure the build/package step includes the file.

```json
{
  "name": "@acme/plugin-contract-review",
  "assets": {
    "screenshots": ["./assets/contract-review-overview.webp"]
  }
}
```

The host reads only manifest-declared files that resolve inside the loaded bundle. Current supported local formats are GIF, JPEG, PNG, SVG, and WebP, with a maximum of 5 MiB per inlined screenshot. An undeclared, missing, unsupported, oversized, absolute, or traversal path is not read from the filesystem. Never use screenshots to expose secrets or tenant data.

## Host-Governed Initialization Lifecycle

The normal user flow is:

1. The loaded plugin exposes the App contribution and matching Assistant template.
2. Explore renders the App card and detail page from trusted metadata and retrieves scoped status/preflight data.
3. An organization administrator selects required models and applies the App to the current organization.
4. The server claims the unique `<tenant, plugin, app, organization-scope>` installation record.
5. The server creates or resumes the dedicated Workspace and persists its ID.
6. The server creates or resumes each declared Knowledge base, persisting IDs after each resource.
7. The server installs the namespaced Assistant template into that Workspace, installs its declared runtime dependencies, runs template Workspace initialization, and publishes the Assistant.
8. The installation becomes `ready`, stores keyed resource references, and the UI opens the Assistant chat.

Only organization `SUPER_ADMIN`, `ADMIN`, and `TRIAL` roles can initialize the current organization-scoped implementation. Other users may inspect presentation metadata but receive a role, organization, model, or unsupported-scope preflight reason without model IDs leaking across the boundary.

Status behavior:

- `not_installed`: no scoped installation record exists;
- `initializing`: another request owns or is resuming the initialization claim;
- `ready`: Workspace, Assistant, and expected Knowledge bases pass health checks;
- `failed`: initialization failed and the current attempt compensated resources it created;
- `degraded`: a previously ready definition or managed resource is missing and the App can be repaired.

Initialization and repair are idempotent around persisted resource IDs and a caller-generated `operationId`; they must not be reimplemented as an unscoped plugin endpoint. A healthy retry returns the existing installation without revalidating now-unneeded model choices. Repair reuses healthy resources and must not duplicate the Assistant.

## Installation Is Not Upgrade

Keep these lifecycles separate:

- plugin deployment makes new runtime metadata and templates available;
- App initialization creates or repairs the first scoped resource set;
- template update upgrades an existing Assistant in place;
- plugin/domain migrations evolve plugin-owned persisted data.

A newer plugin version or changed `appConfig` does not automatically update a healthy installed Assistant or migrate its managed resources. Preserve stable keys and plan explicit compatible migrations. Use the Assistant template lifecycle for graph/template changes rather than creating a second Assistant through a wizard.

## Validation

Before release, verify:

- the active host contracts expose `PluginMarketplaceContribution.appConfig` and the plugin compiles without compatibility casts;
- the authoritative App contribution is present in the loaded descriptor after API restart, not only in registry JSON;
- `assistantTemplateKey` matches exactly one same-plugin `templates[].key`, and one App owns that template link;
- App name, template key, Knowledge-base keys, and Knowledge-base order remain stable across the release;
- the Explore card/detail surface renders localized identity, scope, status, features, data scope, and setup copy as intended, and the chosen media strategy is verified: screenshots or the no-screenshot `longDescription`/`useCases` fallback;
- local screenshots are packaged, manifest-declared, within format/size limits, and resolve in the installed plugin rather than only the source tree;
- the first cover follows the [marketplace card and cover design](#marketplace-card-and-cover-design) contract: 16:9, full bleed with no letterboxing, crop-safe artwork, and a gray glass information layer with verified collapsed and expanded states;
- preflight covers no organization, insufficient role, missing primary model, missing embedding model, missing vision model, and supported setup;
- initialization creates one organization-shared `plugin-app` Workspace, the expected tagged Knowledge bases with selected models, and one published Assistant from the declared template;
- repeated initialize requests do not duplicate resources, and a missing managed resource produces `degraded` before repair;
- repair preserves a healthy Assistant and returns the App to `ready`;
- the installed Assistant opens by slug and its Workbench or Extension Views still pass their own functional, security, and visual acceptance tests;
- runtime metadata and any duplicated portable manifest/marketplace metadata stay aligned;
- no client request or plugin-defined presentation field can choose tenant, organization, Workspace, actor, or persisted resource IDs.
