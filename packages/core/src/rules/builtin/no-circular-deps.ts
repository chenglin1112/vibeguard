import type { Rule, RuleViolation } from '@vibeguard/shared';

/** Reports circular dependency chains found in the dependency graph. */
export const noCircularDeps: Rule = {
  name: 'no-circular-deps',
  description: 'Detect circular dependencies between modules',
  severity: 'error',
  async check(context): Promise<RuleViolation[]> {
    const graph = context.dependencyGraph;
    if (!graph) return [];

    return graph.circularDependencies.map(cd => ({
      rule: 'no-circular-deps',
      severity: 'error' as const,
      message: `Circular dependency detected: ${cd.cycle.join(' → ')}`,
      file: cd.cycle[0],
      suggestion: 'Break the cycle by extracting shared logic into a separate module',
    }));
  },
};
