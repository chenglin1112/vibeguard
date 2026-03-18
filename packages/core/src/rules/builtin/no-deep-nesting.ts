import type { Rule, RuleViolation } from '@vibeguard/shared';

const MAX_NESTING = 4;

/** Flags files with control-flow nesting deeper than 4 levels. */
export const noDeepNesting: Rule = {
  name: 'no-deep-nesting',
  description: 'Prevent deeply nested code blocks',
  severity: 'warning',
  async check(context): Promise<RuleViolation[]> {
    if (!context.filePath || !context.fileContent) return [];

    const violations: RuleViolation[] = [];
    const lines = context.fileContent.split('\n');
    let depth = 0;
    let maxDepth = 0;
    let maxDepthLine = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const ch of line) {
        if (ch === '{') {
          depth++;
          if (depth > maxDepth) {
            maxDepth = depth;
            maxDepthLine = i + 1;
          }
        } else if (ch === '}') {
          depth = Math.max(0, depth - 1);
        }
      }
    }

    if (maxDepth > MAX_NESTING) {
      violations.push({
        rule: 'no-deep-nesting',
        severity: 'warning',
        message: `Nesting depth ${maxDepth} exceeds maximum of ${MAX_NESTING}`,
        file: context.filePath,
        line: maxDepthLine,
        suggestion: 'Use early returns, extract helper functions, or flatten conditionals',
      });
    }
    return violations;
  },
};
