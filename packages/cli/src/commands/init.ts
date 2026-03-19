import { defineCommand } from 'citty';
import { resolve } from 'node:path';
import { readFile, writeFile, appendFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { SnapshotEngine, SimpleGitAdapter, ConfigLoader } from 'vibeguard-core';
import { VIBEGUARD_DATA_DIR } from 'vibeguard-shared';
import { success, error, info, printTiming, jsonOutput } from '../ui/format.js';

const AGENTS_MD_CONTENT = `# AI Agent Instructions

This project is protected by **VibeGuard**.

## Rules for AI Agents

### Before Making Changes
1. Call \`vibeguard_snapshot\` (MCP) or run \`npx @jason_yang0316/vibeguard snapshot "description"\` to create a checkpoint.

### After Making Changes
2. Call \`vibeguard_check\` (MCP) or run \`npx @jason_yang0316/vibeguard check\` to verify architecture rules.
3. If violations are found, fix them before proceeding.
4. Call \`vibeguard_snapshot\` again to save the clean state.

### If Something Breaks
- Call \`vibeguard_rollback\` to restore the last working state.

### MCP Server
If MCP is available, prefer using MCP tools over CLI commands:
- \`vibeguard_snapshot\` — create checkpoint
- \`vibeguard_rollback\` — undo changes
- \`vibeguard_check\` — verify architecture rules
- \`vibeguard_analyze\` — check project health
- \`vibeguard_rescue\` — get recovery plan

### Architecture Rules
This project enforces these rules (see vibeguard.yml for config):
- No circular dependencies
- No cross-layer imports
- No hardcoded secrets
- No god files (>300 lines)
- Maximum function complexity threshold

Always run \`vibeguard check\` after significant changes.
`;

export const initCommand = defineCommand({
  meta: {
    name: 'init',
    description: 'Initialize VibeGuard protection for your project',
  },
  args: {
    json: { type: 'boolean', description: 'Output as JSON', default: false },
    quiet: { type: 'boolean', description: 'Minimal output', default: false },
  },
  async run({ args }) {
    const start = Date.now();
    const projectRoot = resolve('.');

    const gitAdapter = new SimpleGitAdapter(projectRoot);
    const isRepo = await gitAdapter.isRepo();

    if (!isRepo) {
      const initResult = await gitAdapter.init();
      if (!initResult.ok) { error(initResult.error); return; }
      if (!args.quiet) success('Git repository initialized');
    } else {
      if (!args.quiet) success('Git repository detected');
    }

    const configResult = await ConfigLoader.createDefault(projectRoot);
    if (!configResult.ok) { error(configResult.error); return; }
    if (!args.quiet) success('Created vibeguard.yml');

    try {
      const gitignorePath = resolve(projectRoot, '.gitignore');
      let content = '';
      try { content = await readFile(gitignorePath, 'utf-8'); } catch {}
      if (!content.includes(VIBEGUARD_DATA_DIR)) {
        await appendFile(gitignorePath, `\n# VibeGuard\n${VIBEGUARD_DATA_DIR}\n`);
        if (!args.quiet) success('.gitignore updated');
      }
    } catch {}

    try {
      const agentsPath = resolve(projectRoot, 'AGENTS.md');
      if (!existsSync(agentsPath)) {
        await writeFile(agentsPath, AGENTS_MD_CONTENT, 'utf-8');
        if (!args.quiet) success('Created AGENTS.md (AI agent instructions)');
      }
    } catch {}

    const loadResult = await ConfigLoader.load(projectRoot);
    if (!loadResult.ok) { error(loadResult.error); return; }
    const config = loadResult.data;

    const engine = new SnapshotEngine({ gitAdapter, config: config.snapshot, projectRoot });
    const snapshotResult = await engine.createSnapshot('VibeGuard initialized');

    if (snapshotResult.ok) {
      if (!args.quiet) success(`Initial snapshot created [${snapshotResult.data.id}]`);
    }

    if (args.json) {
      jsonOutput({ initialized: true, snapshot: snapshotResult.ok ? snapshotResult.data : null });
      return;
    }

    if (!args.quiet) {
      console.log('');
      console.log('  🛡️  VibeGuard activated!');
      console.log('');
      console.log('  Quick start:');
      console.log('    vibeguard watch    Start real-time protection');
      console.log('    vibeguard snapshot Create a manual snapshot');
      console.log('    vibeguard diff     See what AI changed');
      console.log('    vibeguard rollback Go back to a previous version');
      console.log('');
      printTiming(start);
    }
  },
});
