import { defineCommand } from 'citty';
import { resolve } from 'node:path';
import { SnapshotEngine, SimpleGitAdapter, ConfigLoader } from '@vibeguard/core';
import { error, info, printTiming, jsonOutput } from '../ui/format.js';

export const diffCommand = defineCommand({
  meta: {
    name: 'diff',
    description: 'Show changes since a snapshot',
  },
  args: {
    snapshotId: { type: 'positional', description: 'Snapshot ID to compare against', required: false },
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

    let snapshotId = args.snapshotId as string | undefined;

    if (!snapshotId) {
      const listResult = await engine.listSnapshots({ limit: 1 });
      if (!listResult.ok) { error(listResult.error); return; }
      if (listResult.data.length === 0) {
        info('No snapshots found. Create one with: vibeguard snapshot');
        return;
      }
      snapshotId = listResult.data[0].id;
    }

    const result = await engine.getSnapshotDiff(snapshotId);

    if (!result.ok) {
      if (args.json) { jsonOutput({ error: result.error }); return; }
      error(result.error);
      return;
    }

    if (args.json) { jsonOutput(result.data); return; }

    const { snapshot, changes } = result.data;
    const totalAdded = changes.reduce((s, c) => s + c.additions, 0);
    const totalDeleted = changes.reduce((s, c) => s + c.deletions, 0);

    console.log('');
    console.log(`  📊 Diff against snapshot [${snapshot.id}]:`);
    console.log(`  ${changes.length} file(s) changed  +${totalAdded}  -${totalDeleted}`);
    console.log('');

    for (const change of changes) {
      console.log(`  ── ${change.path} ──`);
      for (const hunk of change.hunks) {
        console.log(hunk.content);
      }
      console.log('');
    }

    printTiming(start);
  },
});
