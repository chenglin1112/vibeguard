import { defineCommand } from 'citty';
import { resolve } from 'node:path';
import { SnapshotEngine, SimpleGitAdapter, ConfigLoader } from '@vibeguard/core';
import { success, error, info, printTiming, jsonOutput } from '../ui/format.js';

export const rollbackCommand = defineCommand({
  meta: {
    name: 'rollback',
    description: 'Rollback to a previous snapshot',
  },
  args: {
    snapshotId: { type: 'positional', description: 'Snapshot ID to rollback to', required: false },
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

    let targetId = args.snapshotId as string | undefined;

    if (!targetId) {
      const listResult = await engine.listSnapshots({ limit: 10 });
      if (!listResult.ok) { error(listResult.error); return; }
      if (listResult.data.length === 0) {
        info('No snapshots found. Create one with: vibeguard snapshot');
        return;
      }
      console.log('');
      console.log('  Recent snapshots:');
      for (const s of listResult.data) {
        const time = new Date(s.timestamp).toLocaleTimeString();
        console.log(`    [${s.id}] ${time}  ${s.message}`);
      }
      console.log('');
      info('Run: vibeguard rollback <snapshot-id>');
      return;
    }

    const result = await engine.rollbackTo(targetId);

    if (!result.ok) {
      if (args.json) { jsonOutput({ error: result.error }); return; }
      error(result.error);
      return;
    }

    if (args.json) { jsonOutput(result.data); return; }
    if (!args.quiet) {
      success(`Rolled back to [${targetId}]`);
      info(`Safety snapshot [${result.data.id}] created (use this to undo the rollback)`);
      printTiming(start);
    }
  },
});
