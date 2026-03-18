import { defineCommand } from 'citty';
import { resolve } from 'node:path';
import { ConfigLoader, HealthScorer, RecoveryPlanner } from '@vibeguard/core';
import { success, error, info, printTiming, jsonOutput } from '../ui/format.js';

export const rescueCommand = defineCommand({
  meta: { name: 'rescue', description: 'Generate a step-by-step recovery plan for your project' },
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

    if (!args.quiet) info('Analyzing project...');
    const reportResult = await scorer.generateReport(config);
    if (!reportResult.ok) { error(reportResult.error); return; }

    const planner = new RecoveryPlanner(projectRoot);
    const planResult = await planner.createPlan(reportResult.data);
    if (!planResult.ok) { error(planResult.error); return; }

    if (args.json) { jsonOutput(planResult.data); return; }

    const plan = planResult.data;

    if (plan.steps.length === 0) {
      success('No recovery needed — your project is healthy!');
      printTiming(start);
      return;
    }

    console.log('');
    console.log(`  🔧 Recovery Plan — ${plan.summary}`);
    console.log('');

    for (const step of plan.steps) {
      const riskIcon = step.risk === 'high' ? '🔴' : step.risk === 'medium' ? '🟡' : '🟢';
      console.log(`  Step ${step.order}: ${step.title}`);
      console.log(`    ${step.description}`);
      console.log(`    Risk: ${riskIcon} ${step.risk}  |  Type: ${step.type}  |  Auto: ${step.automated ? 'yes' : 'no'}`);
      if (step.files.length > 0) {
        console.log(`    Files: ${step.files.join(', ')}`);
      }
      console.log('');
    }

    console.log(`  ⏱  Estimated effort: ${plan.estimatedEffort}`);
    console.log('');
    info('Tip: Create a snapshot before starting repairs: vibeguard snapshot "before rescue"');
    printTiming(start);
  },
});
