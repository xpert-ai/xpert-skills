# SKILL.md Format

Each skill must contain a `SKILL.md` file with two parts:

1. YAML frontmatter
2. Markdown instructions

## Required Frontmatter

```yaml
---
name: my-skill-name
description: A clear description of what this skill does and when to use it
---
```

## Rules
- `name` must be unique across the repository.
- Use lowercase letters and hyphens in `name`.
- The `name` value should match the skill folder name.
- `description` should explain both the task and the trigger for using the skill.
- Keep instructions concrete and action-oriented.
- The markdown body below the frontmatter must not be empty.

## Validation

Run the repository validator from the project root:

```bash
node scripts/validate-skills.mjs
```

This script validates all skills under `skills/` and exits with a non-zero status when any rule is violated.

## Recommended Sections
- Title
- When to use
- Workflow or steps
- Output format
- Guidelines
- Examples

## Minimal Example

```markdown
---
name: my-skill-name
description: A clear description of what this skill does and when to use it
---

# My Skill Name

Use this skill when the user needs help with a repeatable task.

## Workflow
- Gather missing context.
- Perform the task.
- Return output in the requested format.
```