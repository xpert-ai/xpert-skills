# Plugin-owned Ontology Bootstrap

Read this reference when a plugin ships the initial ontology required by its business application and offers an explicit way to import or upgrade it in data-xpert. This is a controlled bootstrap lifecycle, not a general-purpose ontology editor.

## Keep a versioned, code-owned bundle

Store the ontology in a dedicated domain module, normally split into:

- `types.ts`: portable bundle and initialization DTOs;
- `manifest.ts`: stable adapter ID, resource ID, base IRI, semantic version, release notes, and exact machine codes;
- `definition.ts`: the data-xpert draft adapter containing Schema, Actions, optional bounded demo instances and relations, provenance, and layout;
- `index.ts`: the public exports used by the server-side initialization service and tests.

Keep connection settings, tenant or organization identity, Actor Tokens, data bindings, and external-system credentials out of the bundle. Demo data must be neutral, bounded, identifiable as demonstration content, and safe to publish. Validate relation endpoints, instance types, required attributes, Action targets, risk and approval rules, and machine-code uniqueness before packaging.

Ontology Actions in the bundle are governed contracts, not executable implementations. Keep Action codes stable and align them with plugin-side preflight and execution adapters. A model change that affects the published contract requires a new semantic version; never silently replace an already published version with different content.

## Separate installation from initialization

Plugin deployment, runtime activation, ontology initialization, and Assistant provisioning are separate lifecycle operations. Installing or starting the plugin must not write to data-xpert.

After an administrator configures the data-xpert connection, expose a visible initialization status and an explicit action such as **Initialize ontology** or **Update ontology**. Explain the target resource ID, semantic version, imported content, validation, and publication effect before the final confirmation.

The Remote View may submit only narrow intent such as `{ confirmOverwrite: boolean }`. It must not submit the ontology draft, resource ID, semantic version, API URL, tenant, organization, or actor identity. Resolve all of these from the server-owned bundle, trusted plugin configuration, and current runtime scope.

## Status and initialization lifecycle

Use a compact status model such as:

```text
unconfigured | missing | draft | outdated | publishing | failed | current
```

Implement initialization server-side with the current data-xpert definition APIs:

1. Require an enabled connection, current Actor Token, and trusted organization scope.
2. Resolve the fixed resource and target semantic version. If that exact published version exists, return `already_current` without writing.
3. Query the fixed definition resource ID; create a blank definition only when it is missing.
4. Before replacing an existing unpublished draft, require explicit overwrite confirmation. Published history must remain intact.
5. Write the complete code-owned draft with the definition's current `expectedRevision`.
6. Run data-xpert validation and stop before publication when any error remains. Return stable, redacted issue codes and leave the draft recoverable.
7. Publish with the updated draft revision, target semantic version, and release notes.
8. Return the definition ID, version number, semantic version, `snapshotId`, `graphVersion`, and ontology ID, then refresh the Workbench resource list.

Whole-draft replacement is acceptable only for this fixed, plugin-owned bootstrap resource. Interactive model changes must continue to use item-level authoring, fingerprints, revision control, idempotent operations, deletion preview, and the normal authoring boundaries.

On revision conflict, re-read status and the current definition before deciding whether to retry. Do not overwrite a concurrently changed draft silently. If the target semantic version already exists in `publishing` or `failed` state, surface that state for recovery rather than creating another version with the same identifier.

## UI and authorization

Show the initialization control only to roles authorized to create and publish ontology definitions. The confirmation dialog should distinguish:

- first import, which creates and publishes the fixed resource;
- upgrade, which publishes a new semantic version;
- draft overwrite, which requires explicit warning and confirmation.

Do not claim that a staged or installed plugin has initialized data-xpert. Display success only after publication returns a snapshot identity. Normal business reads must continue to select active, `ready` resources and exact root entity type codes.

## Verification

Verify at least:

- the bundle passes the actual data-xpert domain validator;
- create -> draft update -> validate -> publish uses the expected revisions;
- the exact published semantic version is a no-op;
- unpublished draft replacement is rejected without confirmation;
- revision conflicts, validation failures, and duplicate versions do not cause silent overwrites;
- Actor Token and organization scope are server-derived and cross-organization access is rejected;
- the View can request status and targetless initialization without supplying trusted identifiers;
- plugin installation and runtime startup produce no ontology mutation;
- after publication, the resource is `ready`, contains the exact root type and Action codes, and is usable by the Workbench and Assistant.
