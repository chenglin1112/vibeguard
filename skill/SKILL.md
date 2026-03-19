---
name: vibeguard
description: >-
  Auto-snapshot, architecture guard, and smart recovery for AI-assisted coding.
  Use this skill whenever you are about to make code changes in a project —
  it ensures you can always roll back, checks architecture rules, and analyzes
  project health.
version: 0.1.0
author: chenglin1112
tags:
  - vibecoding
  - snapshot
  - architecture
  - code-quality
  - mcp
  - safety
prerequisites:
  - node >= 20
  - git
---

# VibeGuard — Safety Net for Vibe Coding

Automatically protect projects during AI-assisted coding sessions.

## When to Use This Skill

Use VibeGuard in ANY of these situations:

- **Before making code changes** — create a snapshot first
- **After AI generates code** — check architecture rules
- **When a project feels messy** — analyze health and generate a recovery plan
- **When the user asks to undo/rollback** — restore a previous snapshot
- **At the start of any coding session** — initialize VibeGuard if not already set up

## Setup (One-Time)

If the project does not have a `vibeguard.yml` file:

```bash
npx @jason_yang0316/vibeguard init
```

This creates `vibeguard.yml`, sets up git if needed, and takes an initial snapshot.

## Core Workflow

### Before making changes — Snapshot

```bash
npx @jason_yang0316/vibeguard snapshot "before refactoring auth module"
```

### After making changes — Check rules

```bash
npx @jason_yang0316/vibeguard check
```

If violations are found, fix them before proceeding.

### Something went wrong — Rollback

```bash
npx @jason_yang0316/vibeguard rollback
```

### Continuous protection — Watch mode

```bash
npx @jason_yang0316/vibeguard watch
```

Auto-snapshots on every file change. Add `--check` to also run architecture rules.

## Architecture Rules

10 built-in rules catch common problems:

| Rule | What it catches |
|------|----------------|
| no-circular-deps | Circular import chains (A → B → C → A) |
| no-cross-layer-imports | UI importing directly from DB layer |
| single-responsibility | Files with too many exports/concerns |
| no-hardcoded-secrets | API keys, passwords, tokens in source code |
| no-duplicate-logic | Repeated code across files |
| max-complexity | Functions that are too complex |
| no-deep-nesting | Code nested more than 4 levels deep |
| consistent-naming | Mixed naming conventions in same directory |
| no-god-file | Files exceeding 300 lines |
| dependency-direction | Lower layers importing from higher layers |

4 presets available: `generic`, `react-app`, `api-server`, `minimal`

## Health Analysis

```bash
npx @jason_yang0316/vibeguard analyze   # Score 0-100, grade A-F
npx @jason_yang0316/vibeguard rescue    # Step-by-step recovery plan
npx @jason_yang0316/vibeguard dashboard # Compact health overview
```

## MCP Integration (Preferred)

If your environment supports MCP, use the MCP server instead of CLI commands. Add to MCP config:

```json
{
  "mcpServers": {
    "vibeguard": {
      "command": "npx",
      "args": ["vibeguard-mcp-server"]
    }
  }
}
```

### MCP Tools

| Tool | When to call |
|------|-------------|
| `vibeguard_snapshot` | Before making significant code changes |
| `vibeguard_rollback` | When changes caused problems |
| `vibeguard_diff` | To review what changed in a snapshot |
| `vibeguard_list_snapshots` | To find a snapshot to compare or roll back to |
| `vibeguard_check` | After making changes, to verify architecture rules |
| `vibeguard_rules` | To understand what rules are enforced |
| `vibeguard_analyze` | To assess overall project health |
| `vibeguard_rescue` | To generate a prioritized recovery plan |

### Safe Edit Workflow (MCP)

When editing code through MCP, always follow this pattern:

1. Call `vibeguard_snapshot` with a descriptive message
2. Make your code changes
3. Call `vibeguard_check` to verify no rules were violated
4. If violations found, fix them
5. Call `vibeguard_snapshot` to save the good state

## All Commands Reference

```bash
npx @jason_yang0316/vibeguard init          # Initialize project protection
npx @jason_yang0316/vibeguard watch         # Auto-snapshot on file changes
npx @jason_yang0316/vibeguard watch --check # Auto-snapshot + architecture checks
npx @jason_yang0316/vibeguard snapshot      # Manual snapshot
npx @jason_yang0316/vibeguard list          # List snapshots
npx @jason_yang0316/vibeguard diff [id]     # Show changes since a snapshot
npx @jason_yang0316/vibeguard rollback [id] # Roll back to a snapshot
npx @jason_yang0316/vibeguard check         # Run architecture rules
npx @jason_yang0316/vibeguard rules         # List active rules
npx @jason_yang0316/vibeguard analyze       # Health score (0-100, A-F)
npx @jason_yang0316/vibeguard rescue        # Recovery plan
npx @jason_yang0316/vibeguard dashboard     # Compact health dashboard
```

All commands support `--json` for structured output and `--quiet` for minimal output.

## Installation

```bash
# Install from GitHub (for Codex / Cursor skill system)
# scripts/install-skill-from-github.py --repo chenglin1112/vibeguard --path skill

# Or install the npm packages directly
npm install -g @jason_yang0316/vibeguard    # CLI
npm install -g vibeguard-mcp-server         # MCP Server
```

## Source

- GitHub: https://github.com/chenglin1112/vibeguard
- npm: https://www.npmjs.com/package/vibeguard-core
- License: MIT
