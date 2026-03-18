import type { Rule, RuleViolation, LayerDefinition } from '@vibeguard/shared';

const DEFAULT_LAYERS: LayerDefinition[] = [
  { name: 'ui', patterns: ['components/', 'pages/'], allowedDependencies: ['services', 'data'] },
  { name: 'services', patterns: ['services/', 'api/'], allowedDependencies: ['data'] },
  { name: 'data', patterns: ['db/', 'models/', 'data/'], allowedDependencies: [] },
];

/** Reports imports that cross architectural layer boundaries. */
export const noCrossLayerImports: Rule = {
  name: 'no-cross-layer-imports',
  description: 'Prevent imports that violate layer boundaries',
  severity: 'error',
  async check(context): Promise<RuleViolation[]> {
    const graph = context.dependencyGraph;
    if (!graph) return [];

    if (graph.layerViolations.length > 0) {
      return graph.layerViolations.map(v => ({
        rule: 'no-cross-layer-imports',
        severity: 'error' as const,
        message: `Layer violation: ${v.fromLayer} (${v.from}) imports from ${v.toLayer} (${v.to})`,
        file: v.from,
        suggestion: `Layer "${v.fromLayer}" is not allowed to depend on "${v.toLayer}"`,
      }));
    }

    const violations: RuleViolation[] = [];
    const layers = DEFAULT_LAYERS;

    for (const [filePath, node] of graph.files) {
      const fromLayer = resolveLayer(filePath, layers);
      if (!fromLayer) continue;
      const layerDef = layers.find(l => l.name === fromLayer);
      if (!layerDef) continue;

      for (const imp of node.imports) {
        if (imp.isTypeOnly) continue;
        const toLayer = resolveLayer(imp.source, layers);
        if (!toLayer || toLayer === fromLayer) continue;

        if (!layerDef.allowedDependencies.includes(toLayer)) {
          violations.push({
            rule: 'no-cross-layer-imports',
            severity: 'error',
            message: `Layer violation: ${fromLayer} (${filePath}) imports from ${toLayer} (${imp.source})`,
            file: filePath,
            suggestion: `Layer "${fromLayer}" is not allowed to depend on "${toLayer}"`,
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
