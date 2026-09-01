# Product Functional Design Documentation

Read this reference before declaring a product-visible feature complete. Product design documentation is part of the feature, not an optional release note or an after-the-fact summary.

## Completion Contract

A feature is complete only when its implemented and verified behavior is represented in the target application's `docs` tree. Apply this rule to new or changed user capabilities, Case/process behavior, roles and authority, state transitions, business rules, Assistants, human gates, integrations, and Views.

Pure refactors, dependency maintenance, formatting, or mechanical test changes need no new product document when they provably leave product behavior unchanged. They still must update existing documentation if names, links, constraints, or described behavior become stale.

Write documentation in the same change as the feature. Do not defer it to a future cleanup task, and do not describe intended behavior as shipped before it has acceptance evidence.

## Choose the Documentation Home

Inspect the target repository before writing:

1. Follow an existing `docs` root, navigation system, naming convention, language, frontmatter, and ownership pattern when present.
2. Place product functional design within the repository that owns the delivered behavior; do not write generated application documentation into this skill.
3. Extend an established taxonomy instead of creating a competing `product-design` hierarchy.
4. If no applicable convention exists, use the default structure below.

```text
docs/product-design/
├── index.md
├── overview/
│   └── product-scope.md
├── features/
│   └── <feature-key>.md
├── processes/
│   └── <case-or-flow-key>.md
├── views/
│   └── <view-key>.md
├── roles-and-permissions/
│   └── <role-or-policy-key>.md
└── decisions/
    └── <decision-key>.md
```

Create only categories the product currently needs. `index.md` is mandatory under the default structure and must group and link the documents by subject. Avoid grouping primarily by sprint, completion date, developer, or file type; those dimensions make current product behavior hard to find.

Use stable, lowercase, language-neutral keys for filenames where practical. Localize titles in document content. Keep one canonical home for each rule and cross-link it from related feature, flow, and View documents instead of copying it.

## Classification Rules

Use these boundaries when choosing where information belongs:

| Category | Owns |
|---|---|
| `overview` | Product purpose, scope, core concepts, boundaries, and top-level capability map |
| `features` | One independently understandable user or business capability and its acceptance contract |
| `processes` | Case lifecycle, stages, nodes, routes, state transitions, blockers, retries, and completion |
| `views` | User goals, information hierarchy, interactions, navigation, empty/error/loading states, and accessibility |
| `roles-and-permissions` | Human/Assistant roles, responsibility, authority, scope, and segregation of duties |
| `decisions` | Material product choices, alternatives, rationale, consequences, and supersession |

A completed feature normally updates its `features` document and any affected canonical process, View, or role/permission documents. Create a decision record only for a material choice whose rationale should survive the implementation. Do not turn the documentation tree into a code module mirror.

## Feature Document Contract

Each feature document should answer the following, omitting sections that genuinely do not apply:

```markdown
# <Feature title>

## Summary
<!-- Stable key, current status, user/business outcome, and scope boundary. -->

## Actors and Authority
<!-- Human roles, independent Assistants, Orchestrator/External Xpert relationships,
     system actors, and who may read, propose, approve, execute, or remediate. -->

## Trigger and Preconditions
<!-- How the feature starts and the persisted facts required before it is executable. -->

## Product Flow
<!-- Main flow plus meaningful branches, blockers, rejection, retry, cancellation,
     stale-state handling, and terminal outcomes. -->

## State, Rules, and Artifacts
<!-- Source-of-truth artifacts, state transitions, completion predicates,
     business rules, evidence, and version/revision behavior. -->

## Experience and Interactions
<!-- Views, information hierarchy, user actions, Dialog/View/component openings,
     ChatKit handoff, progressive disclosure, and loading/empty/error states. -->

## Permissions and Safety
<!-- Tenant/organization scope, least privilege, human gates, consequential actions,
     privacy, audit, and failure containment. -->

## Acceptance Examples
<!-- Observable happy path and high-value branch/failure/authorization examples. -->

## Related Documents
<!-- Canonical process, View, role/permission, decision, API, or technical links. -->

## Known Limitations and Unverified Behavior
<!-- State these explicitly; never silently present them as completed behavior. -->
```

Describe what users and business roles can observe and rely on. Link to API, schema, architecture, or operations documents for implementation detail; do not replace product behavior with class names, source file inventories, or commit logs.

## Per-Feature Update Procedure

Before completion:

1. Identify the stable feature key and all affected product concepts.
2. Inspect the documentation index and existing canonical documents.
3. Create or update the feature document.
4. Update affected process documents when nodes, routes, status, blockers, artifacts, or completion rules changed.
5. Update affected View documents when layout, information priority, interactions, navigation, or UI states changed.
6. Update role/permission documents when responsibility, Assistant topology, tool access, approval, or scope changed.
7. Add or repair category/index links and remove references to retired behavior.
8. Compare the documents with the approved blueprint, implementation, and acceptance evidence.
9. Check internal links and scan for secrets, customer data, private source references, machine-specific paths, and speculative claims.
10. Include the changed documentation paths and any deliberately unverified behavior in the completion receipt.

When a feature is removed, update or retire its document, affected canonical documents, and index in the same change. Preserve historical design only when the repository has an explicit archival policy; otherwise prioritize an accurate description of the current product.

## Quality Gate

Reject feature completion when any of these is true:

- there is no discoverable product document for the completed feature;
- the index or category grouping is missing or broken;
- the document is only a release note, task log, screenshot, API inventory, or code walkthrough;
- main behavior is documented but branches, authority, blockers, failure, or completion rules are materially absent;
- process, View, or role documents contradict the feature document;
- documentation claims behavior that was not implemented or exercised;
- current behavior is buried in chronological duplicates rather than a canonical document;
- private source, customer data, secrets, or local absolute paths appear in distributable documentation.

Diagrams are optional. Use Mermaid or the repository's established diagram format only when a state model, role handoff, or branch structure is materially clearer visually, and accompany it with accessible text.
