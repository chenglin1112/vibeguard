import { defineCommand } from 'citty';
import { resolve } from 'node:path';
import { ConfigLoader, HealthScorer, SnapshotEngine, SimpleGitAdapter } from 'vibeguard-core';
import { error, printTiming, jsonOutput } from '../ui/format.js';

export const dashboardCommand = defineCommand({
  meta: { name: 'dashboard', description: 'Show a compact project health dashboard' },
  args: {
    json: { type: 'boolean', description: 'Output as JSON', default: false },
  },
  async run({ args }) {
    const start = Date.now();
    const projectRoot = resolve('.');
    const loadResult = await ConfigLoader.load(projectRoot);
    if (!loadResult.ok) { error(loadResult.error); return; }

    const config = loadResult.data;

    const scorer = new HealthScorer(config.health, projectRoot);
    const reportResult = await scorer.generateReport(config);

    const gitAdapter = new SimpleGitAdapter(projectRoot);
    const engine = new SnapshotEngine({ gitAdapter, config: config.snapshot, projectRoot });
    const snapshotsResult = await engine.listSnapshots({ limit: 5 });

    if (args.json) {
      jsonOutput({
        health: reportResult.ok ? reportResult.data : null,
        recentSnapshots: snapshotsResult.ok ? snapshotsResult.data : [],
      });
      return;
    }

    console.log('');
    console.log('  ┌─────────────────────────────────────────┐');
    console.log('  │         🛡️  VibeGuard Dashboard          │');
    console.log('  ├─────────────────────────────────────────┤');

    if (reportResult.ok) {
      const r = reportResult.data;
      const gradeColors: Record<string, string> = { A: '🟢', B: '🔵', C: '🟡', D: '🟠', F: '🔴' };
      console.log(`  │  Health: ${gradeColors[r.grade] || '⚪'} ${r.grade} (${r.score}/100)               │`);
      const m = r.metrics;
      console.log(`  │    Complexity:    ${padScore(m.complexity.score)}  │`);
      console.log(`  │    Duplication:   ${padScore(m.duplication.score)}  │`);
      console.log(`  │    Organization:  ${padScore(m.fileOrganization.score)}  │`);
      console.log(`  │    Dependencies:  ${padScore(m.dependencies.score)}  │`);
      if (r.issues.length > 0) {
        console.log(`  │  Issues: ${r.issues.length}                           │`);
      }
    } else {
      console.log('  │  Health: ⚠ Unable to analyze            │');
    }

    console.log('  ├─────────────────────────────────────────┤');

    if (snapshotsResult.ok && snapshotsResult.data.length > 0) {
      console.log('  │  Recent Snapshots:                       │');
      for (const s of snapshotsResult.data.slice(0, 3)) {
        const time = new Date(s.timestamp).toLocaleTimeString();
        const msg = s.message.length > 20 ? s.message.slice(0, 20) + '...' : s.message;
        console.log(`  │    [${s.id}] ${time} ${msg}  │`);
      }
    } else {
      console.log('  │  No snapshots yet                        │');
    }

    console.log('  └─────────────────────────────────────────┘');
    console.log('');

    printTiming(start);
  },
});

function padScore(score: number): string {
  const bar = '█'.repeat(Math.round(score)) + '░'.repeat(25 - Math.round(score));
  return `${bar} ${score.toFixed(0).padStart(2)}/25`;
}
