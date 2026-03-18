import { defineCommand } from 'citty';
import { resolve } from 'node:path';
import { ConfigLoader, RulesEngine } from '@vibeguard/core';
import { success, error, info, printTiming, jsonOutput } from '../ui/format.js';

export const checkCommand = defineCommand({
  meta: { name: 'check', description: 'Check your project against architecture rules' },
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
    const engine = new RulesEngine(config.rules, projectRoot);
    const result = await engine.checkProject();

    if (!result.ok) {
      if (args.json) { jsonOutput({ error: result.error }); return; }
      error(result.error);
      return;
    }

    if (args.json) { jsonOutput(result.data); return; }

    const { violations, passed, summary } = result.data;

    if (passed) {
      success('All architecture checks passed!');
      if (!args.quiet) printTiming(start);
      return;
    }

    const errors = violations.filter(v => v.severity === 'error');
    const warnings = violations.filter(v => v.severity === 'warning');
    const infos = violations.filter(v => v.severity === 'info');

    console.log('');
    console.log('  \u{1F3D7}\uFE0F  Architecture Check Results:');
    console.log('');

    for (const v of errors) {
      console.log(`  \u2717 [${v.rule}] ${v.message}`);
      if (v.file) console.log(`    at ${v.file}${v.line ? `:${v.line}` : ''}`);
      if (v.suggestion) console.log(`    \u{1F4A1} ${v.suggestion}`);
    }
    for (const v of warnings) {
      console.log(`  \u26A0 [${v.rule}] ${v.message}`);
      if (v.file) console.log(`    at ${v.file}${v.line ? `:${v.line}` : ''}`);
      if (v.suggestion) console.log(`    \u{1F4A1} ${v.suggestion}`);
    }
    for (const v of infos) {
      console.log(`  \u2139 [${v.rule}] ${v.message}`);
      if (v.file) console.log(`    at ${v.file}${v.line ? `:${v.line}` : ''}`);
    }

    console.log('');
    console.log(`  ${summary}`);

    if (!args.quiet) printTiming(start);
  },
});
