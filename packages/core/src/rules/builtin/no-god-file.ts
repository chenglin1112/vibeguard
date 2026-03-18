import type { Rule, RuleViolation } from 'vibeguard-shared';

/** Flags files that exceed the configured line-count threshold. */
export const noGodFile: Rule = {
  name: 'no-god-file',
  description: 'Prevent overly large files',
  severity: 'warning',
  async check(context): Promise<RuleViolation[]> {
    const graph = context.dependencyGraph;
    if (!graph) return [];

    const threshold = context.config?.health?.file_length_threshold ?? 300;
    const violations: RuleViolation[] = [];

    for (const [filePath, node] of graph.files) {
      if (node.lineCount !== undefined && node.lineCount > threshold) {
        violations.push({
          rule: 'no-god-file',
          severity: 'warning',
          message: `File has ${node.lineCount} lines, exceeding threshold of ${threshold}`,
          file: filePath,
          suggestion: 'Break this file into smaller, focused modules',
        });
      }
    }
    return violations;
  },
};
