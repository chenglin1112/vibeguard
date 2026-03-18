#!/usr/bin/env node
import { defineCommand, runMain } from 'citty';
import { initCommand } from './commands/init.js';
import { watchCommand } from './commands/watch.js';
import { snapshotCommand } from './commands/snapshot.js';
import { rollbackCommand } from './commands/rollback.js';
import { diffCommand } from './commands/diff.js';
import { listCommand } from './commands/list.js';
import { checkCommand } from './commands/check.js';
import { rulesCommand } from './commands/rules.js';
import { analyzeCommand } from './commands/analyze.js';
import { rescueCommand } from './commands/rescue.js';
import { dashboardCommand } from './commands/dashboard.js';

const main = defineCommand({
  meta: {
    name: 'vibeguard',
    version: '0.0.1',
    description: 'The safety net for vibe coding. Vibe code fearlessly.',
  },
  subCommands: {
    init: initCommand,
    watch: watchCommand,
    snapshot: snapshotCommand,
    rollback: rollbackCommand,
    diff: diffCommand,
    list: listCommand,
    check: checkCommand,
    rules: rulesCommand,
    analyze: analyzeCommand,
    rescue: rescueCommand,
    dashboard: dashboardCommand,
  },
});

runMain(main);
