import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { HealthScorer } from '../../src/health/scorer.js';
import { DEFAULT_CONFIG } from 'vibeguard-shared';
import type { VibeGuardConfig } from 'vibeguard-shared';

const config = DEFAULT_CONFIG as VibeGuardConfig;
const healthConfig = config.health;

describe('HealthScorer', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'vg-health-'));
    await mkdir(join(tmpDir, 'src'), { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('should score a healthy project >= 70 with grade A or B', async () => {
    await writeFile(
      join(tmpDir, 'src', 'utils.ts'),
      'export function add(a: number, b: number): number { return a + b; }\n',
    );
    await writeFile(
      join(tmpDir, 'src', 'math.ts'),
      'export function multiply(a: number, b: number): number { return a * b; }\n',
    );
    await writeFile(
      join(tmpDir, 'src', 'format.ts'),
      'export function greet(name: string): string { return `Hello ${name}`; }\n',
    );

    const scorer = new HealthScorer(healthConfig, tmpDir);
    const result = await scorer.generateReport(config);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.score).toBeGreaterThanOrEqual(70);
    expect(['A', 'B']).toContain(result.data.grade);
  });

  it('should lower fileOrganization score for a god file', async () => {
    const longContent = Array.from(
      { length: 400 },
      (_, i) => `export const val${i} = ${i};`,
    ).join('\n');
    await writeFile(join(tmpDir, 'src', 'god.ts'), longContent);

    const scorer = new HealthScorer(healthConfig, tmpDir);
    const result = await scorer.generateReport(config);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.metrics.fileOrganization.score).toBeLessThan(25);
  });

  it('should lower dependencies score for circular deps', async () => {
    await writeFile(
      join(tmpDir, 'src', 'a.ts'),
      'import { b } from "./b";\nexport const a = 1;\n',
    );
    await writeFile(
      join(tmpDir, 'src', 'b.ts'),
      'import { a } from "./a";\nexport const b = 2;\n',
    );

    const scorer = new HealthScorer(healthConfig, tmpDir);
    const result = await scorer.generateReport(config);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.metrics.dependencies.score).toBeLessThan(25);
  });

  it('should lower complexity score for a highly complex file', async () => {
    const lines = ['export function process(x: number) {'];
    for (let i = 0; i < 20; i++) {
      lines.push(`  if (x > ${i}) { x += ${i}; }`);
    }
    lines.push('  return x;', '}');
    await writeFile(join(tmpDir, 'src', 'complex.ts'), lines.join('\n'));

    const scorer = new HealthScorer(healthConfig, tmpDir);
    const result = await scorer.generateReport(config);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.metrics.complexity.score).toBeLessThan(25);
  });

  it('should return grade A for a minimal clean project', async () => {
    await writeFile(
      join(tmpDir, 'src', 'index.ts'),
      'export const version = 1;\n',
    );

    const scorer = new HealthScorer(healthConfig, tmpDir);
    const result = await scorer.generateReport(config);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(['A', 'B']).toContain(result.data.grade);
  });

  it('should return grade D or F for a terrible project', async () => {
    function makeBigComplexFile(importStmt: string, exportName: string): string {
      const fileLines = [
        importStmt,
        `export const ${exportName} = 1;`,
        'export function process(x: number) {',
      ];
      for (let i = 0; i < 30; i++) {
        fileLines.push(`  if (x > ${i}) { x += ${i}; }`);
      }
      fileLines.push('  return x;', '}');
      while (fileLines.length < 400) {
        fileLines.push(`export const pad${fileLines.length} = ${fileLines.length};`);
      }
      return fileLines.join('\n');
    }

    await writeFile(
      join(tmpDir, 'src', 'a.ts'),
      makeBigComplexFile('import { bVal } from "./b";', 'aVal'),
    );
    await writeFile(
      join(tmpDir, 'src', 'b.ts'),
      makeBigComplexFile('import { aVal } from "./a";', 'bVal'),
    );

    const scorer = new HealthScorer(healthConfig, tmpDir);
    const result = await scorer.generateReport(config);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(['D', 'F']).toContain(result.data.grade);
  });

  it('should populate issues for a messy project', async () => {
    const longContent = Array.from(
      { length: 400 },
      (_, i) => `export const val${i} = ${i};`,
    ).join('\n');
    await writeFile(join(tmpDir, 'src', 'god.ts'), longContent);

    const scorer = new HealthScorer(healthConfig, tmpDir);
    const result = await scorer.generateReport(config);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.issues.length).toBeGreaterThan(0);
  });

  it('should include required fields on every issue', async () => {
    await writeFile(
      join(tmpDir, 'src', 'a.ts'),
      'import { b } from "./b";\nexport const a = 1;\n',
    );
    await writeFile(
      join(tmpDir, 'src', 'b.ts'),
      'import { a } from "./a";\nexport const b = 2;\n',
    );

    const scorer = new HealthScorer(healthConfig, tmpDir);
    const result = await scorer.generateReport(config);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.issues.length).toBeGreaterThan(0);

    for (const issue of result.data.issues) {
      expect(issue).toHaveProperty('severity');
      expect(issue).toHaveProperty('category');
      expect(issue).toHaveProperty('message');
      expect(issue).toHaveProperty('suggestion');
    }
  });

  it('should handle an empty project gracefully', async () => {
    const scorer = new HealthScorer(healthConfig, tmpDir);
    const result = await scorer.generateReport(config);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data).toHaveProperty('score');
    expect(result.data).toHaveProperty('grade');
    expect(result.data).toHaveProperty('metrics');
    expect(result.data).toHaveProperty('issues');
  });

  it('should return a Result with ok: true and data', async () => {
    await writeFile(
      join(tmpDir, 'src', 'index.ts'),
      'export const x = 1;\n',
    );

    const scorer = new HealthScorer(healthConfig, tmpDir);
    const result = await scorer.generateReport(config);

    expect(result).toHaveProperty('ok', true);
    if (!result.ok) return;

    expect(result).toHaveProperty('data');
    expect(result.data).toHaveProperty('score');
    expect(result.data).toHaveProperty('grade');
    expect(result.data).toHaveProperty('metrics');
    expect(result.data).toHaveProperty('issues');
    expect(result.data).toHaveProperty('trend');
  });
});
