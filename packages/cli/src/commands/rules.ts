import { defineCommand } from 'citty';
import { resolve } from 'node:path';
import { ConfigLoader, RulesEngine } from 'vibeguard-core';
import { success, error, info, jsonOutput } from '../ui/format.js';
import { RULE_PRESETS } from 'vibeguard-shared';

export const rulesCommand = defineCommand({
  meta: { name: 'rules', description: 'Manage architecture rules' },
  args: {
    action: { type: 'positional', description: 'Action: list | presets', required: false, default: 'list' },
    json: { type: 'boolean', description: 'Output as JSON', default: false },
  },
  async run({ args }) {
    const action = args.action as string;

    if (action === 'presets') {
      if (args.json) {
        jsonOutput(RULE_PRESETS);
        return;
      }
      console.log('');
      console.log('  \u{1F4CB} Available rule presets:');
      console.log('');
      for (const [name, rules] of Object.entries(RULE_PRESETS)) {
        console.log(`  ${name} (${rules.length} rules)`);
        for (const rule of rules) {
          console.log(`    - ${rule}`);
        }
        console.log('');
      }
      info('Set a preset in vibeguard.yml: rules.preset: <name>');
      return;
    }

    const projectRoot = resolve('.');
    const loadResult = await ConfigLoader.load(projectRoot);
    if (!loadResult.ok) { error(loadResult.error); return; }

    const config = loadResult.data;
    const engine = new RulesEngine(config.rules, projectRoot);
    const rulesResult = await engine.loadRules();

    if (!rulesResult.ok) { error(rulesResult.error); return; }

    if (args.json) {
      jsonOutput(rulesResult.data.map(r => ({ name: r.name, description: r.description, severity: r.severity })));
      return;
    }

    console.log('');
    console.log(`  \u{1F3D7}\uFE0F  Active rules (preset: ${config.rules.preset}):`);
    console.log('');
    for (const rule of rulesResult.data) {
      const icon = rule.severity === 'error' ? '\u2717' : rule.severity === 'warning' ? '\u26A0' : '\u2139';
      console.log(`  ${icon} ${rule.name} \u2014 ${rule.description}`);
    }
    console.log('');
    console.log(`  Total: ${rulesResult.data.length} rules`);
  },
});
