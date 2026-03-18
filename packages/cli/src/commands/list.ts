import { defineCommand } from 'citty';
import { resolve } from 'node:path';
import { SnapshotEngine, SimpleGitAdapter, ConfigLoader } from 'vibeguard-core';
import { error, info, printTiming, jsonOutput } from '../ui/format.js';

export const listCommand = defineCommand({
  meta: {
    name: 'list',
    description: 'List all snapshots',
  },
  args: {
    limit: { type: 'string', description: 'Max number of snapshots to show', default: '10' },
    json: { type: 'boolean', description: 'Output as JSON', default: false },
    quiet: { type: 'boolean', description: 'Minimal output', default: false },
  },
  async run({ args }) {
    const start = Date.now();
    const projectRoot = resolve('.');
    const loadResult = await ConfigLoader.load(projectRoot);
    if (!loadResult.ok) { error(loadResult.error); return; }

    const config = loadResult.data;
    const gitAdapter = new SimpleGitAdapter(projectRoot);
    const engine = new SnapshotEngine({ gitAdapter, config: config.snapshot, projectRoot });

    const limit = parseInt(args.limit, 10) || 10;
    const result = await engine.listSnapshots({ limit });

    if (!result.ok) {
      if (args.json) { jsonOutput({ error: result.error }); return; }
      error(result.error);
      return;
    }

    if (args.json) { jsonOutput(result.data); return; }

    if (result.data.length === 0) {
      info('No snapshots yet. Create one with: vibeguard snapshot');
      return;
    }

    console.log('');
    console.log(`  📸 Snapshot history (showing ${result.data.length}):`);
    console.log('');
    console.log('  Time            ID         Description');
    console.log('  ───────────────────────────────────────────');

    for (const s of result.data) {
      const time = new Date(s.timestamp).toLocaleString();
      console.log(`  ${time}  [${s.id}]  ${s.message}`);
    }

    console.log('');
    info('Use: vibeguard diff <ID> to see details');
    info('Use: vibeguard rollback <ID> to restore');
    printTiming(start);
  },
});
