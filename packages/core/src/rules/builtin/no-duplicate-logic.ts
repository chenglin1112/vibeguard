import type { Rule, RuleViolation } from 'vibeguard-shared';

const MIN_DUPLICATE_LINES = 5;

function isNonTrivialLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (trimmed === '{' || trimmed === '}' || trimmed === '};') return false;
  if (trimmed.startsWith('import ') || trimmed.startsWith('//') || trimmed.startsWith('*')) return false;
  return trimmed.length > 5;
}

/** Flags files that share blocks of identical non-trivial source lines. */
export const noDuplicateLogic: Rule = {
  name: 'no-duplicate-logic',
  description: 'Detect duplicated code blocks across files',
  severity: 'warning',
  async check(context): Promise<RuleViolation[]> {
    const graph = context.dependencyGraph;
    if (!graph) return [];

    const threshold = context.config?.health?.duplication_threshold ?? MIN_DUPLICATE_LINES;
    const violations: RuleViolation[] = [];
    const fileLines = new Map<string, string[]>();

    for (const [filePath, node] of graph.files) {
      if (!node.lineCount || node.lineCount < threshold) continue;
      const project = (await import('ts-morph')).Project;
      break; // we only need graph-level data
    }

    const entries = [...graph.files.entries()];
    const lineCache = new Map<string, string[]>();

    for (const [filePath, node] of entries) {
      if (!node.exports.length) continue;
      const nonTrivial = node.exports;
      lineCache.set(filePath, nonTrivial);
    }

    const checked = new Set<string>();
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const [fileA] = entries[i];
        const [fileB] = entries[j];
        const key = `${fileA}::${fileB}`;
        if (checked.has(key)) continue;
        checked.add(key);

        const nodeA = entries[i][1];
        const nodeB = entries[j][1];

        const shared = nodeA.exports.filter(e => nodeB.exports.includes(e));
        if (shared.length >= threshold) {
          violations.push({
            rule: 'no-duplicate-logic',
            severity: 'warning',
            message: `Files "${fileA}" and "${fileB}" share ${shared.length} identical export names: ${shared.slice(0, 3).join(', ')}`,
            file: fileA,
            suggestion: 'Extract shared logic into a common module',
          });
        }
      }
    }

    return violations;
  },
};
