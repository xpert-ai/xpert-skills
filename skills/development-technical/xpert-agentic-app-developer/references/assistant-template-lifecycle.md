# Assistant Template Lifecycle

Use the plugin-owned Assistant template for both initial installation and later upgrades. Treat these as two different operations.

## Initial Installation

Create an Assistant from the plugin template only when no installed Assistant exists, or when the user explicitly requests a separate parallel instance. The creation flow establishes the Xpert identity, template provenance, graph, middleware, skills, model settings, starter prompts, and required plugin dependencies.

## Upgrade an Existing Assistant

Do not open the Assistant creation wizard or create a replacement Assistant when an installed Assistant already exists.

Upgrade the existing instance through the digital expert canvas:

1. Deploy or refresh the plugin so the latest Assistant template is available to the platform.
2. Open the existing digital expert/Xpert and enter its canvas.
3. Open `Assistant Settings` from the canvas toolbar.
4. In the Assistant base-properties panel, choose `Update from Template`.
5. Review the template update before accepting it, especially Agent nodes, middleware connections, skill middleware connections, model settings, state variables, starter prompts, and required plugins.
6. Save and publish the updated existing Assistant.
7. Verify that the original Xpert id, slug, public link, conversations, Project Workspace bindings, permissions, and integrations remain attached to the same instance.
8. Run an installed-platform smoke test for the upgraded graph and the plugin's main workflow.

This path is the normal upgrade mechanism for a plugin-managed Assistant. It preserves the installed Assistant's identity and operational history while applying the new template graph.

## Guardrails

- Never use the creation wizard as a fallback merely because the template changed.
- If `Update from Template` is unavailable, first verify that the existing Assistant retains template provenance and that the refreshed plugin template is loaded. Report the mismatch instead of silently creating another Assistant.
- Review template-update conflicts when the installed graph contains manual customizations. Do not overwrite intentional local changes without showing their impact.
- Do not manually redraw the graph to imitate a template upgrade.
- Do not replace the existing Xpert id or slug during an upgrade.
- Create a new Assistant only for first installation, an explicitly requested parallel environment, or an intentional breaking migration with an approved identity and data-transition plan.

## Verification Checklist

- The plugin descriptor exposes the expected new template version.
- The update was initiated from `Assistant Settings` -> `Update from Template` on the existing Xpert.
- The Xpert id and slug did not change.
- Required Agent, middleware, tool, and skill connections match the new template.
- Existing Primary conversations and Project-scoped file spaces still resolve correctly.
- The Assistant was saved/published and the installed workflow passes a smoke test.
