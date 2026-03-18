import type { Rule, RuleViolation } from '@vibeguard/shared';

const MAX_EXPORTS = 3;

/** Flags files that export too many public symbols, suggesting mixed concerns. */
export const singleResponsibility: Rule = {
  name: 'single-responsibility',
  description: 'Check that files have a single, focused responsibility',
  severity: 'warning',
  async check(context): Promise<RuleViolation[]> {
    const graph = context.dependencyGraph;
    if (!graph) return [];

    const violations: RuleViolation[] = [];
    for (const [filePath, node] of graph.files) {
      if (filePath.includes('/index.') || filePath.endsWith('index.ts')) continue;

      if (node.exports.length > MAX_EXPORTS) {
        violations.push({
          rule: 'single-responsibility',
          severity: 'warning',
          message: `File has ${node.exports.length} exports (max ${MAX_EXPORTS}), suggesting multiple responsibilities`,
          file: filePath,
          suggestion: 'Split this file into smaller, focused modules',
        });
      }
    }
    return violations;
  },
};
