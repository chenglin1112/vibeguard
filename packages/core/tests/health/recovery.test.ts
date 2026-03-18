import { describe, it, expect } from 'vitest';
import { RecoveryPlanner } from '../../src/health/recovery.js';
import type { HealthReport, HealthIssue } from '@vibeguard/shared';

function makeReport(overrides: Partial<HealthReport> = {}): HealthReport {
  return {
    score: 50,
    grade: 'D',
    metrics: {
      complexity: { score: 12, label: 'Complexity', details: '' },
      duplication: { score: 13, label: 'Duplication', details: '' },
      fileOrganization: { score: 12, label: 'File Organization', details: '' },
      dependencies: { score: 13, label: 'Dependencies', details: '' },
    },
    issues: [],
    trend: null,
    ...overrides,
  };
}

function makeIssue(overrides: Partial<HealthIssue> = {}): HealthIssue {
  return {
    severity: 'warning',
    category: 'god-file',
    message: 'File is too large',
    suggestion: 'Split into smaller modules',
    ...overrides,
  };
}

describe('RecoveryPlanner', () => {
  const planner = new RecoveryPlanner('/tmp/fake-project');

  it('should produce an empty plan for a healthy report', async () => {
    const report = makeReport({ score: 95, grade: 'A', issues: [] });
    const result = await planner.createPlan(report);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.steps).toHaveLength(0);
  });

  it('should produce one step per issue', async () => {
    const report = makeReport({
      issues: [
        makeIssue({ category: 'god-file', file: 'a.ts' }),
        makeIssue({ category: 'circular-dependency', severity: 'critical', file: 'b.ts' }),
        makeIssue({ category: 'high-complexity', file: 'c.ts' }),
      ],
    });
    const result = await planner.createPlan(report);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.steps).toHaveLength(3);
  });

  it('should order steps by risk: low → medium → high', async () => {
    const report = makeReport({
      issues: [
        makeIssue({ category: 'circular-dependency', severity: 'critical', file: 'cycle.ts' }),
        makeIssue({ category: 'hardcoded-secret', file: 'env.ts' }),
        makeIssue({ category: 'god-file', file: 'big.ts' }),
      ],
    });
    const result = await planner.createPlan(report);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const risks = result.data.steps.map(s => s.risk);
    expect(risks).toEqual(['low', 'medium', 'high']);
  });

  it('should create an extract step for a god-file issue', async () => {
    const report = makeReport({
      issues: [makeIssue({ category: 'god-file', file: 'big.ts' })],
    });
    const result = await planner.createPlan(report);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.steps[0].type).toBe('extract');
  });

  it('should create a refactor step for a circular-dependency issue', async () => {
    const report = makeReport({
      issues: [
        makeIssue({ category: 'circular-dependency', severity: 'critical', file: 'loop.ts' }),
      ],
    });
    const result = await planner.createPlan(report);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.steps[0].type).toBe('refactor');
  });

  it('should include a non-empty summary', async () => {
    const report = makeReport({ issues: [makeIssue()] });
    const result = await planner.createPlan(report);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(typeof result.data.summary).toBe('string');
    expect(result.data.summary.length).toBeGreaterThan(0);
  });

  it('should set estimatedEffort to a known bucket', async () => {
    const report = makeReport({
      issues: [makeIssue(), makeIssue({ category: 'high-complexity', file: 'x.ts' })],
    });
    const result = await planner.createPlan(report);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(['~1 hour', '~half a day', '~1 day', '~2-3 days']).toContain(
      result.data.estimatedEffort,
    );
  });

  it('should include all required fields on every step', async () => {
    const report = makeReport({
      issues: [
        makeIssue({ category: 'god-file', file: 'a.ts' }),
        makeIssue({ category: 'circular-dependency', severity: 'critical', file: 'b.ts' }),
      ],
    });
    const result = await planner.createPlan(report);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    for (const step of result.data.steps) {
      expect(step).toHaveProperty('order');
      expect(step).toHaveProperty('title');
      expect(step).toHaveProperty('description');
      expect(step).toHaveProperty('files');
      expect(step).toHaveProperty('type');
      expect(step).toHaveProperty('risk');
      expect(step).toHaveProperty('automated');
      expect(typeof step.order).toBe('number');
      expect(step.order).toBeGreaterThan(0);
    }
  });
});
