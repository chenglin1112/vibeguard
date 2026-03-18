# VibeGuard

> The safety net for vibe coding. Vibe code fearlessly.

[![npm version](https://img.shields.io/npm/v/vibeguard)](https://www.npmjs.com/package/vibeguard)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-passing-brightgreen)]()

Auto-snapshot your project before AI changes break things. Enforce architecture rules. Rescue messy codebases.

## Why VibeGuard?

AI coding tools generate code fast, but they also break things fast. One bad prompt can silently introduce circular dependencies, god files, or hardcoded secrets. Non-developers building with AI don't know git. Even experienced developers lose track of what changed three prompts ago. Projects built with vibe coding spiral into unmaintainable messes with no easy way back.

VibeGuard sits between you and disaster. It automatically snapshots your project before every AI change, enforces architecture rules in real time, and when things do go wrong, it analyzes the damage and generates a step-by-step recovery plan.

## Quick Start

```bash
npx vibeguard init
npx vibeguard watch

# AI breaks something?
npx vibeguard rollback
```

## Features

### Auto Snapshots

Automatic, git-backed checkpoints every time your files change. No git knowledge required. VibeGuard watches your project directory, creates snapshots at configurable intervals, and lets you roll back to any previous state with a single command.

**Key commands:** `init`, `watch`, `snapshot`, `list`, `diff`, `rollback`

### Architecture Guard

10 built-in rules that catch structural problems before they compound. Detects circular dependencies, god files, hardcoded secrets, excessive complexity, deep nesting, naming inconsistencies, cross-layer imports, duplicate logic, single-responsibility violations, and incorrect dependency direction.

Choose from 4 presets (`generic`, `react-app`, `api-server`, `minimal`) or define custom rules in your config.

**Key commands:** `check`, `rules`

### Smart Recovery

Health scoring from 0 to 100 across four dimensions: complexity, duplication, file organization, and dependencies. Projects receive a letter grade (A through F) with specific, actionable issues. When your codebase needs help, VibeGuard generates a prioritized recovery plan with steps sorted by risk level -- quick wins first, high-risk refactors last.

**Key commands:** `analyze`, `rescue`, `dashboard`

### AI Tool Integration (MCP)

Works with Cursor, Claude Code, Windsurf, and any MCP-compatible AI coding tool. The MCP server exposes 8 tools that let AI assistants create snapshots, check rules, analyze health, and generate recovery plans without leaving the coding flow.

## Commands

| Command | Description |
|---------|-------------|
| `vibeguard init` | Initialize VibeGuard in your project |
| `vibeguard watch` | Start real-time file watching with auto-snapshots |
| `vibeguard snapshot [msg]` | Create a manual snapshot with an optional message |
| `vibeguard list` | List all snapshots |
| `vibeguard diff [id]` | Show changes since a snapshot |
| `vibeguard rollback [id]` | Roll back to a previous snapshot |
| `vibeguard check` | Run architecture rules against the project |
| `vibeguard rules` | List active rules and available presets |
| `vibeguard analyze` | Generate a health report with score and grade |
| `vibeguard rescue` | Generate a prioritized recovery plan |
| `vibeguard dashboard` | Interactive health dashboard |

All commands support `--json` for machine-readable output and `--quiet` for minimal output.

## MCP Setup

### Cursor

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "vibeguard": {
      "command": "npx",
      "args": ["@vibeguard/mcp-server"]
    }
  }
}
```

### Claude Code

```bash
claude mcp add vibeguard -- npx @vibeguard/mcp-server
```

### Windsurf

Add to your MCP configuration following the Windsurf docs, using `npx @vibeguard/mcp-server` as the command.

### MCP Tools

| Tool | Description |
|------|-------------|
| `vibeguard_snapshot` | Create a checkpoint before making changes |
| `vibeguard_rollback` | Revert to a previous snapshot |
| `vibeguard_diff` | Show what changed since a snapshot |
| `vibeguard_list_snapshots` | List recent snapshots |
| `vibeguard_check` | Run architecture rule checks on the project |
| `vibeguard_rules` | List available rules and presets |
| `vibeguard_analyze` | Analyze project health (score 0-100, grade A-F) |
| `vibeguard_rescue` | Generate a step-by-step recovery plan |

## Configuration

VibeGuard uses a `vibeguard.yml` file in your project root:

```yaml
version: 1

snapshot:
  enabled: true
  auto: true
  interval: 30
  max_snapshots: 500
  ignore:
    - node_modules
    - .git
    - dist
    - "*.log"
    - .vibeguard

rules:
  preset: generic    # generic | react-app | api-server | minimal
  custom:
    - name: no-console-log
      description: Disallow console.log in production code
      severity: warning

health:
  complexity_threshold: 15
  duplication_threshold: 5
  file_length_threshold: 300
  dependency_depth_threshold: 5

mcp:
  enabled: true
  port: 3777
  mode: stdio
```

## Architecture

VibeGuard is a pnpm monorepo with 4 packages:

| Package | Description |
|---------|-------------|
| `@vibeguard/shared` | TypeScript types, constants, error codes, and utilities |
| `@vibeguard/core` | Core engine: snapshots, file watcher, rule engine, health scorer, recovery planner, architecture analyzer |
| `@vibeguard/cli` | Command-line interface built with citty |
| `@vibeguard/mcp-server` | MCP server for AI tool integration (tools, resources, prompts) |

## Development

```bash
git clone https://github.com/chenglin1112/vibeguard.git
cd vibeguard
pnpm install

pnpm build        # Build all packages
pnpm test         # Run tests
pnpm lint         # Lint with Biome
pnpm lint:fix     # Auto-fix lint issues
```

Requires Node.js >= 20.

## Contributing

Contributions are welcome. Please open an issue to discuss significant changes before submitting a pull request. See the [issues page](https://github.com/chenglin1112/vibeguard/issues) for open tasks.

## License

MIT
