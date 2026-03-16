# Integration And Middleware Plugins

## What makes them different

Compared with standard tool plugins, integration and middleware plugins usually have:

1. inbound callback or webhook paths
2. outbound messaging or notification logic
3. binding or routing state
4. third-party auth, signature, or encryption requirements

## Recommended module split

A maintainable integration or middleware plugin usually separates:

1. `strategy` for registration
2. `controller` for inbound requests
3. `service` for business logic
4. `client` for third-party API calls
5. `handoff` for session or event dispatch
6. `middlewares` for reusable runtime tools
7. `types` for normalized payloads and state

## Recommended runtime split

Split the workflow into:

1. inbound
2. in-platform routing
3. outbound

Inbound:

1. validate headers
2. verify signatures
3. decrypt when needed
4. normalize payloads

In-platform routing:

1. trigger binding
2. conversation binding
3. handoff or dispatch

Outbound:

1. send
2. update
3. recall
4. recipient lookup

## Configuration design

Keep config grouped by purpose:

1. third-party app credentials
2. callback security values
3. platform routing defaults

Avoid collecting duplicate fields that mean the same thing under different names.

## Trigger and conversation binding

Message-oriented integrations usually need both:

1. trigger binding for first-time routing
2. conversation binding for continuity

Keep them separate conceptually and in storage.

## Outbound tool design

Only expose outbound tools that are truly supported by upstream APIs.

Before exposing a tool, confirm:

1. the API exists
2. the required identifiers are available
3. the permission model is understood
4. failure handling is defined

For update or recall actions, decide explicitly:

1. fail fast
2. degrade to resend
3. mark degraded in the result

## Callback validation

Validate callback behavior in stages:

1. platform route is reachable
2. third-party callback test succeeds
3. real inbound event succeeds
4. outbound follow-up succeeds
5. error paths return useful logs and status codes

## Message loop protection

Common failures:

1. the bot processes its own messages
2. group chat logic handles irrelevant messages
3. stream or patch updates create duplicate or half-finished messages

Always consider:

1. self-message filtering
2. mention or target filtering
3. terminal vs non-terminal update behavior
4. noise control on fallback paths

## Notification middleware design

Common fields:

1. `integrationId`
2. `recipient_type`
3. `recipient_id`
4. runtime template variables

Recommendations:

1. keep schema style aligned with existing platform middleware conventions
2. support runtime variables for recipient IDs
3. if recipient type can be dynamic, model it clearly in schema instead of leaving it implicit
4. always return debug-friendly result objects with success counts, failure counts, targets, and errors

## End-to-end validation

Recommended order:

1. install plugin locally
2. configure integration or middleware instance
3. verify third-party callback test path
4. verify real inbound events
5. verify outbound actions
6. verify failures: bad signatures, missing config, permission denial, missing bindings

## Common mistakes

1. exposing tools before upstream APIs are confirmed
2. leaking raw third-party payloads through the whole code path without normalization
3. mixing inbound, outbound, bindings, and middleware tool logic in one large file
4. validating only the success path and skipping signature, permission, and routing failures
