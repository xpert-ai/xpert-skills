# Plugin Template Contribution Contract

Plugins publish `XpertTemplateContribution` metadata alongside optional YAML `dslContent`. The public fields are:

`key`, `id`, `name`, `title`, `description`, `category`, `copyright`, `privacyPolicy`, `avatar`, `icon`, `type`, `targetApps`, `targetAppMeta`, `dslContent`, `export_data`, `order`, `default`, `startPrompts`, `promptWorkflows`, `releaseNotes`, `xpertName`, and `dependencies`.

The interface is extensible, but application-specific extra fields need an explicit consumer and tests. Do not assume an arbitrary contribution field is copied into the installed Assistant.

## Recommended Single-Source Definition

Keep stable product identity and questions in one code object. Generate both the contribution and DSL from that object. For role catalogs, make the role definition the source. For dedicated Assistants, export constants or a typed definition object from a neutral module used by the builder and template factory.

Required cross-layer assertions for a generated template:

- contribution `key` equals `team.name` and the configured template source key;
- contribution title/description/avatar equal team values;
- when opener is enabled, `startPrompts` equals `team.features.opener.questions`;
- primary Agent key exists exactly once;
- declared target capabilities match DSL/application capability metadata;
- required plugins and Skill owners are consistent;
- every Skill `targetAgentKey` exists and owns the needed middleware;
- `team.version` matches the expected release contract.

## Dependencies

Declare cross-plugin dependencies explicitly. A Skill dependency needs `pluginName`, `componentKey`, and `targetAgentKey`. Required plugin names should agree across contribution dependencies, target-app metadata, and DSL integration options.

## Installation Reality

Template loading, Assistant installation, draft update, and publication are different operations. A loaded contribution can contain current `startPrompts` while an older installed Assistant still has stale or empty `features.opener`. Verify the new draft and published entity after installing or updating.
