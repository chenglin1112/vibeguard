import type { Rule, RuleViolation } from 'vibeguard-shared';

/** Flags files whose estimated cyclomatic complexity exceeds the configured threshold. */
export const maxComplexity: Rule = {
  name: 'max-complexity',
  description: 'Enforce maximum cyclomatic complexity per file',
  severity: 'warning',
  async check(context): Promise<RuleViolation[]> {
    const graph = context.dependencyGraph;
    if (!graph) return [];

    const threshold = context.config?.health?.complexity_threshold ?? 15;
    const violations: RuleViolation[] = [];

    for (const [filePath, node] of graph.files) {
      if (node.complexity !== undefined && node.complexity > threshold) {
        violations.push({
          rule: 'max-complexity',
          severity: 'warning',
          message: `File complexity ${node.complexity} exceeds threshold ${threshold}`,
          file: filePath,
          suggestion: 'Refactor complex logic into smaller, testable functions',
        });
      }
    }
    return violations;
  },
};
