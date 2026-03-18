import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { RulesEngine } from '../../src/rules/engine.js';
import type { SnapshotDiff } from 'vibeguard-shared';

describe('RulesEngine', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'vibeguard-rules-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('loadRules', () => {
    it('should load all 10 rules for generic preset', async () => {
      const engine = new RulesEngine({ preset: 'generic', custom: [] }, tempDir);
      const result = await engine.loadRules();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toHaveLength(10);
      }
    });

    it('should load 3 rules for minimal preset', async () => {
      const engine = new RulesEngine({ preset: 'minimal', custom: [] }, tempDir);
      const result = await engine.loadRules();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toHaveLength(3);
        const names = result.data.map(r => r.name);
        expect(names).toContain('no-circular-deps');
        expect(names).toContain('no-hardcoded-secrets');
        expect(names).toContain('no-god-file');
      }
    });

    it('should fall back to generic for unknown preset', async () => {
      const engine = new RulesEngine(
        { preset: 'nonexistent-preset', custom: [] },
        tempDir,
      );
      const result = await engine.loadRules();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toHaveLength(10);
      }
    });
  });

  describe('checkProject', () => {
    it('should pass on clean project with no violations', async () => {
      const srcDir = join(tempDir, 'src');
      await mkdir(srcDir, { recursive: true });

      await writeFile(
        join(srcDir, 'math.ts'),
        `export function add(a: number, b: number): number { return a + b; }\n`,
      );
      await writeFile(
        join(srcDir, 'text.ts'),
        `export function trim(s: string): string { return s.trim(); }\n`,
      );

      const engine = new RulesEngine({ preset: 'generic', custom: [] }, tempDir);
      const result = await engine.checkProject();

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.data.passed).toBe(true);
      expect(
        result.data.violations.filter(v => v.severity === 'error'),
      ).toHaveLength(0);
    });

    it('should detect god file exceeding line threshold', async () => {
      const srcDir = join(tempDir, 'src');
      await mkdir(srcDir, { recursive: true });

      const lines = Array.from({ length: 400 }, (_, i) => `const v${i} = ${i};`);
      await writeFile(join(srcDir, 'huge.ts'), lines.join('\n') + '\n');

      const engine = new RulesEngine({ preset: 'minimal', custom: [] }, tempDir);
      const result = await engine.checkProject();

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const godFileViolation = result.data.violations.find(
        v => v.rule === 'no-god-file',
      );
      expect(godFileViolation).toBeDefined();
      expect(godFileViolation!.severity).toBe('warning');
    });

    it('should detect circular dependencies', async () => {
      const srcDir = join(tempDir, 'src');
      await mkdir(srcDir, { recursive: true });

      await writeFile(
        join(srcDir, 'a.ts'),
        `import { bVal } from './b';\nexport const aVal = 1;\n`,
      );
      await writeFile(
        join(srcDir, 'b.ts'),
        `import { cVal } from './c';\nexport const bVal = 2;\n`,
      );
      await writeFile(
        join(srcDir, 'c.ts'),
        `import { aVal } from './a';\nexport const cVal = 3;\n`,
      );

      const engine = new RulesEngine({ preset: 'minimal', custom: [] }, tempDir);
      const result = await engine.checkProject();

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const circularViolation = result.data.violations.find(
        v => v.rule === 'no-circular-deps',
      );
      expect(circularViolation).toBeDefined();
      expect(circularViolation!.severity).toBe('error');
      expect(result.data.passed).toBe(false);
    });

    it('should return a summary string with counts', async () => {
      const srcDir = join(tempDir, 'src');
      await mkdir(srcDir, { recursive: true });

      await writeFile(
        join(srcDir, 'a.ts'),
        `import { bVal } from './b';\nexport const aVal = 1;\n`,
      );
      await writeFile(
        join(srcDir, 'b.ts'),
        `import { aVal } from './a';\nexport const bVal = 2;\n`,
      );

      const engine = new RulesEngine({ preset: 'minimal', custom: [] }, tempDir);
      const result = await engine.checkProject();

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(typeof result.data.summary).toBe('string');
      expect(result.data.summary.length).toBeGreaterThan(0);
      if (!result.data.passed) {
        expect(result.data.summary).toContain('error');
      }
    });
  });

  describe('checkFile', () => {
    it('should detect hardcoded secrets in a single file', async () => {
      const srcDir = join(tempDir, 'src');
      await mkdir(srcDir, { recursive: true });

      await writeFile(
        join(srcDir, 'config.ts'),
        `const apiKey = "sk-abc123def456";\nexport default apiKey;\n`,
      );

      const engine = new RulesEngine({ preset: 'generic', custom: [] }, tempDir);
      const result = await engine.checkFile('src/config.ts');

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const secretViolation = result.data.find(
        v => v.rule === 'no-hardcoded-secrets',
      );
      expect(secretViolation).toBeDefined();
    });

    it('should return empty violations for clean file', async () => {
      const srcDir = join(tempDir, 'src');
      await mkdir(srcDir, { recursive: true });

      await writeFile(
        join(srcDir, 'clean.ts'),
        `export function greet(name: string): string {\n  return 'Hello ' + name;\n}\n`,
      );

      const engine = new RulesEngine({ preset: 'generic', custom: [] }, tempDir);
      const result = await engine.checkFile('src/clean.ts');

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.data).toHaveLength(0);
    });
  });

  describe('checkDiff', () => {
    it('should only check non-deleted changed files', async () => {
      const srcDir = join(tempDir, 'src');
      await mkdir(srcDir, { recursive: true });

      await writeFile(
        join(srcDir, 'secrets.ts'),
        `const token = "sk-secret123456";\nexport default token;\n`,
      );

      const diff: SnapshotDiff = {
        snapshot: {
          id: 'abc1234',
          timestamp: Date.now(),
          message: 'test diff',
          filesChanged: ['src/secrets.ts'],
          linesAdded: 2,
          linesDeleted: 0,
          parent: null,
        },
        changes: [
          {
            path: 'src/secrets.ts',
            type: 'added',
            additions: 2,
            deletions: 0,
            hunks: [],
          },
          {
            path: 'src/deleted.ts',
            type: 'deleted',
            additions: 0,
            deletions: 5,
            hunks: [],
          },
        ],
      };

      const engine = new RulesEngine({ preset: 'generic', custom: [] }, tempDir);
      const result = await engine.checkDiff(diff);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const secretViolation = result.data.find(
        v => v.rule === 'no-hardcoded-secrets',
      );
      expect(secretViolation).toBeDefined();
    });
  });
});
