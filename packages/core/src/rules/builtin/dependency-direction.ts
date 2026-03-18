import type { Rule, RuleViolation, LayerDefinition } from '@vibeguard/shared';

const DEFAULT_LAYER_ORDER: LayerDefinition[] = [
  { name: 'ui', patterns: ['components/', 'pages/'], allowedDependencies: ['services', 'data'] },
  { name: 'services', patterns: ['services/', 'api/'], allowedDependencies: ['data'] },
  { name: 'data', patterns: ['db/', 'models/', 'data/'], allowedDependencies: [] },
];

const LAYER_RANK: Record<string, number> = { ui: 0, services: 1, data: 2 };

/** Ensures dependencies flow downward: ui → services → data, never upward. */
export const dependencyDirection: Rule = {
  name: 'dependency-direction',
  description: 'Enforce one-directional dependency flow between layers',
  severity: 'error',
  async check(context): Promise<RuleViolation[]> {
    const graph = context.dependencyGraph;
    if (!graph) return [];

    const layers = DEFAULT_LAYER_ORDER;
    const violations: RuleViolation[] = [];

    for (const [filePath, node] of graph.files) {
      const fromLayer = resolveLayer(filePath, layers);
      if (!fromLayer) continue;
      const fromRank = LAYER_RANK[fromLayer];
      if (fromRank === undefined) continue;

      for (const imp of node.imports) {
        if (imp.isTypeOnly) continue;
        const toLayer = resolveLayer(imp.source, layers);
        if (!toLayer || toLayer === fromLayer) continue;
        const toRank = LAYER_RANK[toLayer];
        if (toRank === undefined) continue;

        if (toRank < fromRank) {
          violations.push({
            rule: 'dependency-direction',
            severity: 'error',
            message: `Upward dependency: ${fromLayer} (${filePath}) imports from higher layer ${toLayer} (${imp.source})`,
            file: filePath,
            suggestion: `Lower layers should not import from higher layers. Use dependency inversion.`,
          });
        }
      }
    }
    return violations;
  },
};

function resolveLayer(filePath: string, layers: LayerDefinition[]): string | undefined {
  const normalized = filePath.replace(/\\/g, '/');
  for (const layer of layers) {
    for (const pattern of layer.patterns) {
      if (normalized.includes(pattern.replace(/\/$/, ''))) return layer.name;
    }
  }
  return undefined;
}
