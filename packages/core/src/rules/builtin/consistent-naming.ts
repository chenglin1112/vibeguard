import { basename, dirname } from 'node:path';
import type { Rule, RuleViolation } from '@vibeguard/shared';

const KEBAB = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const CAMEL = /^[a-z][a-zA-Z0-9]*$/;
const PASCAL = /^[A-Z][a-zA-Z0-9]*$/;

function detectStyle(name: string): 'kebab' | 'camel' | 'pascal' | 'unknown' {
  if (KEBAB.test(name)) return 'kebab';
  if (CAMEL.test(name)) return 'camel';
  if (PASCAL.test(name)) return 'pascal';
  return 'unknown';
}

/** Flags directories that mix file naming conventions (kebab, camel, pascal). */
export const consistentNaming: Rule = {
  name: 'consistent-naming',
  description: 'Ensure consistent file naming conventions per directory',
  severity: 'info',
  async check(context): Promise<RuleViolation[]> {
    const graph = context.dependencyGraph;
    if (!graph) return [];

    const dirStyles = new Map<string, Map<string, string[]>>();

    for (const filePath of graph.files.keys()) {
      const dir = dirname(filePath);
      const name = basename(filePath).replace(/\.[^.]+$/, '');
      if (name === 'index') continue;

      const style = detectStyle(name);
      if (style === 'unknown') continue;

      if (!dirStyles.has(dir)) dirStyles.set(dir, new Map());
      const styles = dirStyles.get(dir)!;
      if (!styles.has(style)) styles.set(style, []);
      styles.get(style)!.push(filePath);
    }

    const violations: RuleViolation[] = [];
    for (const [dir, styles] of dirStyles) {
      if (styles.size <= 1) continue;
      const styleNames = [...styles.keys()].join(', ');
      const examples = [...styles.entries()]
        .map(([s, files]) => `${s}: ${basename(files[0])}`)
        .join('; ');

      violations.push({
        rule: 'consistent-naming',
        severity: 'info',
        message: `Mixed naming styles in ${dir}: ${styleNames} (${examples})`,
        file: dir,
        suggestion: 'Pick one naming convention (kebab-case recommended) and apply it consistently',
      });
    }
    return violations;
  },
};
