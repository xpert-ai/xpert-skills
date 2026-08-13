# Skills

Public repository for Skills of Xpert platform.
Skills are folders of instructions, scripts, and resources that Xpert loads dynamically to improve performance on specialized tasks. Skills teach Xpert how to complete specific tasks in a repeatable way, whether that's creating documents with your company's brand guidelines, analyzing data using your organization's specific workflows, or automating personal tasks.

For more information, check out:
- [What are skills?](https://support.claude.com/en/articles/12512176-what-are-skills)
- [Using skills in Claude](https://support.claude.com/en/articles/12512180-using-skills-in-claude)
- [How to create custom skills](https://support.claude.com/en/articles/12512198-creating-custom-skills)
- [Equipping agents for the real world with Agent Skills](https://anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills)

# About This Repository

This repository contains skills that demonstrate what's possible with Xpert's skills system. These skills range from creative applications (art, music, design) to technical tasks (testing web apps, MCP server generation) to enterprise workflows (communications, branding, etc.).

Each skill is self-contained in its own folder with a `SKILL.md` file containing the instructions and metadata that Xpert uses. Browse through these skills to get inspiration for your own skills or to understand different patterns and approaches.

## Disclaimer

**These skills are provided for demonstration and educational purposes only.** While some of these capabilities may be available in Xpert, the implementations and behaviors you receive from Xpert may differ from what is shown in these skills. These skills are meant to illustrate patterns and possibilities. Always test skills thoroughly in your own environment before relying on them for critical tasks.

# Skill Sets
- [./skills](./skills): Skill examples for Creative & Design, Development & Technical, Enterprise & Communication, and Document Skills
- [./spec](./spec): The Agent Skills specification
- [./template](./template): Skill template

# Installing Skills

## Install with the Skills CLI (Recommended)

With Node.js installed, use the [`skills`](https://github.com/vercel-labs/skills) CLI to discover and install skills from this repository. The CLI supports Codex, Claude Code, Cursor, and many other agents.

List the available skills without installing them:

```bash
npx skills add xpert-ai/xpert-skills --list
```

Start an interactive installation and select the skills and target agents:

```bash
npx skills add xpert-ai/xpert-skills
```

Install a specific skill for Codex in the current project:

```bash
npx skills add xpert-ai/xpert-skills \
  --skill xpert-plugin-development \
  --agent codex
```

Install a specific skill globally so it is available in every project:

```bash
npx skills add xpert-ai/xpert-skills \
  --skill xpert-plugin-development \
  --agent codex \
  --global
```

Install all skills for a specific agent:

```bash
npx skills add xpert-ai/xpert-skills \
  --skill '*' \
  --agent codex
```

Replace `codex` with another supported agent identifier, such as `claude-code` or `cursor`. Project installation is the default; use `--global` (or `-g`) for a user-level installation. Add `--yes` (or `-y`) for non-interactive environments, and add `--copy` when symbolic links are not supported.

To install from a local clone while developing or testing a skill:

```bash
git clone https://github.com/xpert-ai/xpert-skills.git
cd xpert-skills
npx skills add . --skill xpert-plugin-development --agent codex
```

## Install Manually

Clone this repository, then copy the complete skill directory into the target agent's skills directory. Keep `SKILL.md` together with any referenced `scripts/`, `references/`, and `assets/` directories.

Common installation locations are:

| Agent | Project installation | Global installation |
| --- | --- | --- |
| Codex | `.agents/skills/<skill-name>/` | `~/.codex/skills/<skill-name>/` |
| Claude Code | `.claude/skills/<skill-name>/` | `~/.claude/skills/<skill-name>/` |
| Cursor | `.agents/skills/<skill-name>/` | `~/.cursor/skills/<skill-name>/` |

For example, to install `xpert-plugin-development` globally for Codex:

```bash
git clone https://github.com/xpert-ai/xpert-skills.git
mkdir -p ~/.codex/skills
cp -R \
  xpert-skills/skills/development-technical/xpert-plugin-development \
  ~/.codex/skills/
```

Restart the agent or start a new session if the newly installed skill is not discovered immediately.

# Creating a Basic Skill

Skills are simple to create - just a folder with a `SKILL.md` file containing YAML frontmatter and instructions. You can use the **template-skill** in this repository as a starting point:

```markdown
---
name: my-skill-name
description: A clear description of what this skill does and when to use it
---

# My Skill Name

[Add your instructions here that Xpert will follow when this skill is active]

## Examples
- Example usage 1
- Example usage 2

## Guidelines
- Guideline 1
- Guideline 2
```

The frontmatter requires only two fields:
- `name` - A unique identifier for your skill (lowercase, hyphens for spaces)
- `description` - A complete description of what the skill does and when to use it

The markdown content below contains the instructions, examples, and guidelines that Xpert will follow. For more details, see [How to create custom skills](https://support.claude.com/en/articles/12512198-creating-custom-skills).

# Validate Skills

Use the repository validator before committing new skills:

```bash
node scripts/validate-skills.mjs
```

The validator checks that each skill under `skills/`:
- contains a `SKILL.md` file
- has valid YAML frontmatter
- defines unique `name` and `description` fields
- uses kebab-case for `name`
- matches the skill folder name
- contains non-empty instructions below the frontmatter

# Partner Skills

Skills are a great way to teach Xpert how to get better at using specific pieces of software. As we see awesome example skills from partners, we may highlight some of them here:

- **Notion** - [Notion Skills for Claude](https://www.notion.so/notiondevs/Notion-Skills-for-Claude-28da4445d27180c7af1df7d8615723d0)
