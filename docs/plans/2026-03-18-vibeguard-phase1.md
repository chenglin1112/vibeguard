# VibeGuard Phase 1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build VibeGuard Phase 1 — auto-snapshot engine with CLI and MCP Server integration

**Architecture:** pnpm monorepo with 4 packages (shared, core, cli, mcp-server). Core is pure logic layer with injected adapters. CLI and MCP Server are thin wrappers that call core APIs.

**Tech Stack:** TypeScript 5.x strict, Node.js >= 20, tsup, pnpm workspace, Vitest, Biome, simple-git, chokidar, consola, yaml, @modelcontextprotocol/sdk

---

## Task 0: Project Scaffolding

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `package.json` (root)
- Create: `tsconfig.json` (root)
- Create: `tsconfig.base.json`
- Create: `biome.json`
- Create: `vitest.config.ts`
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/cli/package.json`
- Create: `packages/cli/tsconfig.json`
- Create: `packages/mcp-server/package.json`
- Create: `packages/mcp-server/tsconfig.json`
- Create: `vibeguard.yml.example`

**Step 1:** Create all directory structures and config files
**Step 2:** Run `pnpm install`
**Step 3:** Verify `pnpm build` scaffolding compiles (empty index.ts files)
**Step 4:** Commit: `chore(all): scaffold monorepo structure`

---

## Task 1: Shared Types (packages/shared)

**Files:**
- Create: `packages/shared/src/types.ts`
- Create: `packages/shared/src/constants.ts`
- Create: `packages/shared/src/errors.ts`
- Create: `packages/shared/src/utils.ts`
- Create: `packages/shared/src/index.ts`

Core types: Snapshot, SnapshotDiff, FileChange, DiffHunk, VibeGuardConfig, Result<T,E>, VibeGuardError, GitAdapter interface, all sub-config types.

---

## Task 2: Core Engine (packages/core)

**Files:**
- Create: `packages/core/src/snapshot/engine.ts`
- Create: `packages/core/src/snapshot/git-adapter.ts`
- Create: `packages/core/src/watcher/file-watcher.ts`
- Create: `packages/core/src/config/loader.ts`
- Create: `packages/core/src/index.ts`

Implements: SnapshotEngine, SimpleGitAdapter, FileWatcher, ConfigLoader

---

## Task 3: CLI (packages/cli)

**Files:**
- Create: `packages/cli/src/commands/init.ts`
- Create: `packages/cli/src/commands/watch.ts`
- Create: `packages/cli/src/commands/snapshot.ts`
- Create: `packages/cli/src/commands/rollback.ts`
- Create: `packages/cli/src/commands/diff.ts`
- Create: `packages/cli/src/commands/list.ts`
- Create: `packages/cli/src/ui/format.ts`
- Create: `packages/cli/src/index.ts`

All commands are thin wrappers around @vibeguard/core.

---

## Task 4: MCP Server (packages/mcp-server)

**Files:**
- Create: `packages/mcp-server/src/tools/snapshot.ts`
- Create: `packages/mcp-server/src/tools/rollback.ts`
- Create: `packages/mcp-server/src/tools/diff.ts`
- Create: `packages/mcp-server/src/tools/list-snapshots.ts`
- Create: `packages/mcp-server/src/resources/config.ts`
- Create: `packages/mcp-server/src/resources/snapshots.ts`
- Create: `packages/mcp-server/src/prompts/safe-edit.ts`
- Create: `packages/mcp-server/src/index.ts`

---

## Task 5: Tests

**Files:**
- Create: `packages/core/tests/snapshot/engine.test.ts`
- Create: `packages/core/tests/watcher/file-watcher.test.ts`
- Create: `packages/core/tests/config/loader.test.ts`
- Create: `packages/cli/tests/commands/init.test.ts`
- Create: `packages/mcp-server/tests/tools.test.ts`
- Create: `tests/fixtures/` directories

---

## Task 6: Integration & Polish

- Verify `pnpm build` all packages
- Verify `pnpm test` all pass
- Verify `pnpm lint` clean
- Create README.md
- Final commit
