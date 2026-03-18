import { defineCommand } from 'citty';
import { resolve } from 'node:path';
import { SnapshotEngine, SimpleGitAdapter, FileWatcher, ConfigLoader, RulesEngine } from '@vibeguard/core';
import { success, error, warn, info } from '../ui/format.js';

export const watchCommand = defineCommand({
  meta: {
    name: 'watch',
    description: 'Start real-time protection — auto-snapshot on file changes',
  },
  args: {
    quiet: { type: 'boolean', description: 'Minimal output', default: false },
    check: { type: 'boolean', description: 'Run architecture checks after each snapshot', default: false },
  },
  async run({ args }) {
    const projectRoot = resolve('.');
    const loadResult = await ConfigLoader.load(projectRoot);
    if (!loadResult.ok) { error(loadResult.error); return; }

    const config = loadResult.data;
    const gitAdapter = new SimpleGitAdapter(projectRoot);
    const engine = new SnapshotEngine({ gitAdapter, config: config.snapshot, projectRoot });

    if (!args.quiet) {
      console.log('');
      console.log('  🛡️  VibeGuard is protecting your project...  (Ctrl+C to exit)');
      console.log('');
    }

    const watcher = new FileWatcher({
      projectRoot,
      config: config.snapshot,
      onFilesChanged: async (files) => {
        const result = await engine.createSnapshot();
        if (result.ok) {
          const time = new Date().toLocaleTimeString();
          const s = result.data;
          info(`${time}  📸 Snapshot [${s.id}] — ${s.message}`);
        }

        if (args.check) {
          const rulesEngine = new RulesEngine(config.rules, projectRoot);
          const checkResult = await rulesEngine.checkProject();
          if (checkResult.ok && !checkResult.data.passed) {
            const errorCount = checkResult.data.violations.filter(v => v.severity === 'error').length;
            const warnCount = checkResult.data.violations.filter(v => v.severity === 'warning').length;
            warn(`Architecture: ${errorCount} errors, ${warnCount} warnings`);
          }
        }
      },
    });

    watcher.start();

    process.on('SIGINT', () => {
      watcher.stop();
      if (!args.quiet) {
        console.log('');
        success('Stopped watching. Your snapshots are safe.');
      }
      process.exit(0);
    });
  },
});
