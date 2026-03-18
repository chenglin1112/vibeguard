import { defineCommand } from 'citty';
import { resolve } from 'node:path';
import { SnapshotEngine, SimpleGitAdapter, ConfigLoader } from '@vibeguard/core';
import { success, error, printTiming, jsonOutput } from '../ui/format.js';

export const snapshotCommand = defineCommand({
  meta: {
    name: 'snapshot',
    description: 'Create a manual snapshot of your project',
  },
  args: {
    message: { type: 'positional', description: 'Snapshot description', required: false },
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

    const result = await engine.createSnapshot(args.message as string | undefined);

    if (!result.ok) {
      if (args.json) { jsonOutput({ error: result.error }); return; }
      error(result.error);
      return;
    }

    if (args.json) { jsonOutput(result.data); return; }
    if (!args.quiet) {
      success(`Snapshot [${result.data.id}] created — ${result.data.message}`);
      printTiming(start);
    }
  },
});
