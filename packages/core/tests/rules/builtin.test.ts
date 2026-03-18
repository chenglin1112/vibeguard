import { describe, it, expect } from 'vitest';
import { allBuiltinRules } from '../../src/rules/builtin/index.js';
import type {
  RuleContext,
  DependencyGraph,
  FileNode,
  CircularDependency,
} from '@vibeguard/shared';
import { DEFAULT_CONFIG } from '@vibeguard/shared';

function makeContext(overrides: Partial<RuleContext> = {}): RuleContext {
  return {
    projectRoot: '/tmp/test',
    config: DEFAULT_CONFIG as any,
    ...overrides,
  };
}

function makeGraph(
  files: Record<string, Partial<FileNode>>,
  circularDependencies: CircularDependency[] = [],
): DependencyGraph {
  const fileMap = new Map<string, FileNode>();
  for (const [filePath, partial] of Object.entries(files)) {
    fileMap.set(filePath, {
      path: filePath,
      imports: [],
      exports: [],
      ...partial,
    });
  }
  return { files: fileMap, circularDependencies, layerViolations: [] };
}

function findRule(name: string) {
  const rule = allBuiltinRules.find(r => r.name === name);
  if (!rule) throw new Error(`Rule "${name}" not found`);
  return rule;
}

describe('Builtin Rules', () => {
  it('should have exactly 10 rules', () => {
    expect(allBuiltinRules).toHaveLength(10);
  });

  it('all rules should have required properties', () => {
    for (const rule of allBuiltinRules) {
      expect(rule.name).toBeTruthy();
      expect(rule.description).toBeTruthy();
      expect(['error', 'warning', 'info']).toContain(rule.severity);
      expect(typeof rule.check).toBe('function');
    }
  });

  describe('no-hardcoded-secrets', () => {
    const rule = findRule('no-hardcoded-secrets');

    it('should detect API key patterns', async () => {
      const ctx = makeContext({
        filePath: 'src/config.ts',
        fileContent: `const apiKey = "sk-12345abcdef";\n`,
      });
      const violations = await rule.check(ctx);

      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0].rule).toBe('no-hardcoded-secrets');
      expect(violations[0].severity).toBe('error');
    });

    it('should ignore test files', async () => {
      const ctx = makeContext({
        filePath: 'src/config.test.ts',
        fileContent: `const apiKey = "sk-12345abcdef";\n`,
      });
      const violations = await rule.check(ctx);

      expect(violations).toHaveLength(0);
    });
  });

  describe('no-god-file', () => {
    const rule = findRule('no-god-file');

    it('should detect files exceeding line threshold', async () => {
      const graph = makeGraph({
        'src/huge.ts': { lineCount: 400 },
      });
      const ctx = makeContext({ dependencyGraph: graph });
      const violations = await rule.check(ctx);

      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0].rule).toBe('no-god-file');
      expect(violations[0].severity).toBe('warning');
    });

    it('should pass files under threshold', async () => {
      const graph = makeGraph({
        'src/small.ts': { lineCount: 50 },
      });
      const ctx = makeContext({ dependencyGraph: graph });
      const violations = await rule.check(ctx);

      expect(violations).toHaveLength(0);
    });
  });

  describe('no-deep-nesting', () => {
    const rule = findRule('no-deep-nesting');

    it('should detect deeply nested code', async () => {
      const deepCode = [
        'function deep() {',
        '  if (true) {',
        '    if (true) {',
        '      if (true) {',
        '        if (true) {',
        '          console.log("too deep");',
        '        }',
        '      }',
        '    }',
        '  }',
        '}',
      ].join('\n');

      const ctx = makeContext({
        filePath: 'src/deep.ts',
        fileContent: deepCode,
      });
      const violations = await rule.check(ctx);

      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0].rule).toBe('no-deep-nesting');
      expect(violations[0].severity).toBe('warning');
    });

    it('should pass shallow code', async () => {
      const shallowCode = [
        'function simple() {',
        '  if (true) {',
        '    return 1;',
        '  }',
        '  return 0;',
        '}',
      ].join('\n');

      const ctx = makeContext({
        filePath: 'src/simple.ts',
        fileContent: shallowCode,
      });
      const violations = await rule.check(ctx);

      expect(violations).toHaveLength(0);
    });
  });

  describe('max-complexity', () => {
    const rule = findRule('max-complexity');

    it('should detect files exceeding complexity threshold', async () => {
      const graph = makeGraph({
        'src/complex.ts': { complexity: 20 },
      });
      const ctx = makeContext({ dependencyGraph: graph });
      const violations = await rule.check(ctx);

      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0].rule).toBe('max-complexity');
      expect(violations[0].severity).toBe('warning');
    });

    it('should pass files under complexity threshold', async () => {
      const graph = makeGraph({
        'src/simple.ts': { complexity: 3 },
      });
      const ctx = makeContext({ dependencyGraph: graph });
      const violations = await rule.check(ctx);

      expect(violations).toHaveLength(0);
    });
  });

  describe('consistent-naming', () => {
    const rule = findRule('consistent-naming');

    it('should detect mixed naming styles in same directory', async () => {
      const graph = makeGraph({
        'src/myComponent.ts': {},
        'src/other-util.ts': {},
      });
      const ctx = makeContext({ dependencyGraph: graph });
      const violations = await rule.check(ctx);

      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0].rule).toBe('consistent-naming');
      expect(violations[0].severity).toBe('info');
    });

    it('should pass when all files use consistent naming', async () => {
      const graph = makeGraph({
        'src/user-list.ts': {},
        'src/data-table.ts': {},
      });
      const ctx = makeContext({ dependencyGraph: graph });
      const violations = await rule.check(ctx);

      expect(violations).toHaveLength(0);
    });
  });

  describe('no-circular-deps', () => {
    const rule = findRule('no-circular-deps');

    it('should report cycles from dependency graph', async () => {
      const graph = makeGraph(
        { 'src/a.ts': {}, 'src/b.ts': {} },
        [{ cycle: ['src/a.ts', 'src/b.ts', 'src/a.ts'] }],
      );
      const ctx = makeContext({ dependencyGraph: graph });
      const violations = await rule.check(ctx);

      expect(violations).toHaveLength(1);
      expect(violations[0].rule).toBe('no-circular-deps');
      expect(violations[0].severity).toBe('error');
      expect(violations[0].message).toContain('src/a.ts');
    });
  });
});
