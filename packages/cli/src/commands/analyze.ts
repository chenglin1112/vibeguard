import { defineCommand } from 'citty';
import { resolve } from 'node:path';
import { ConfigLoader, HealthScorer } from 'vibeguard-core';
import { success, error, info, printTiming, jsonOutput } from '../ui/format.js';

export const analyzeCommand = defineCommand({
  meta: { name: 'analyze', description: 'Analyze your project\'s health and get a score' },
  args: {
    json: { type: 'boolean', description: 'Output as JSON', default: false },
    quiet: { type: 'boolean', description: 'Minimal output', default: false },
  },
  async run({ args }) {
    const start = Date.now();
    const projectRoot = resolve('.');
    const loadResult = await ConfigLoader.load(projectRoot);
    if (!loadResult.ok) { error(loadResult.error); return; }

    const config = loadResult.data;
    const scorer = new HealthScorer(config.health, projectRoot);

    if (!args.quiet) info('Analyzing project health...');

    const result = await scorer.generateReport(config);
    if (!result.ok) {
      if (args.json) { jsonOutput({ error: result.error }); return; }
      error(result.error);
      return;
    }

    if (args.json) { jsonOutput(result.data); return; }

    const report = result.data;

    const gradeColors: Record<string, string> = { A: '🟢', B: '🔵', C: '🟡', D: '🟠', F: '🔴' };
    const gradeIcon = gradeColors[report.grade] || '⚪';

    console.log('');
    console.log(`  ${gradeIcon} Project Health: ${report.grade} (${report.score}/100)`);
    console.log('');

    console.log('  Metrics:');
    for (const [, detail] of Object.entries(report.metrics)) {
      const bar = '█'.repeat(Math.round(detail.score)) + '░'.repeat(25 - Math.round(detail.score));
      console.log(`    ${detail.label}: ${bar} ${detail.score.toFixed(0)}/25`);
      if (detail.details) console.log(`      ${detail.details}`);
    }

    if (report.issues.length > 0) {
      console.log('');
      console.log(`  Issues (${report.issues.length}):`);
      for (const issue of report.issues) {
        const icon = issue.severity === 'critical' ? '🔴' : issue.severity === 'warning' ? '🟡' : '🔵';
        console.log(`    ${icon} [${issue.category}] ${issue.message}`);
        if (issue.file) console.log(`      at ${issue.file}`);
        console.log(`      💡 ${issue.suggestion}`);
      }
    } else {
      console.log('');
      success('No issues found! Your project is in great shape.');
    }

    console.log('');
    printTiming(start);
  },
});
