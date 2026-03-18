import type { HealthReport, RecoveryPlan, RecoveryStep, Result } from '@vibeguard/shared';
import { ok, err, vibeError, ErrorCodes } from '@vibeguard/shared';

const RISK_ORDER: Record<string, number> = { low: 0, medium: 1, high: 2 };

/**
 * Generates a prioritised recovery plan from a health report,
 * ordering low-risk quick wins first.
 */
export class RecoveryPlanner {
  private projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }

  /** Generate a recovery plan based on a health report. */
  async createPlan(report: HealthReport): Promise<Result<RecoveryPlan>> {
    try {
      const steps: RecoveryStep[] = [];

      for (const issue of report.issues) {
        const step = this.issueToStep(issue);
        if (step) steps.push(step);
      }

      steps.sort((a, b) => (RISK_ORDER[a.risk] ?? 0) - (RISK_ORDER[b.risk] ?? 0));
      for (let i = 0; i < steps.length; i++) {
        steps[i].order = i + 1;
      }

      const estimatedEffort = this.estimateEffort(steps.length);
      const criticalCount = report.issues.filter(i => i.severity === 'critical').length;
      const warningCount = report.issues.filter(i => i.severity === 'warning').length;
      const summary =
        `Found ${report.issues.length} issue(s). ` +
        `${criticalCount} critical, ${warningCount} warning(s). ` +
        `Estimated effort: ${estimatedEffort}`;

      return ok({ projectHealth: report, steps, estimatedEffort, summary });
    } catch (e) {
      return err(vibeError(
        ErrorCodes.RECOVERY_FAILED,
        `Recovery planning failed: ${e instanceof Error ? e.message : String(e)}`,
        'Ensure the health report is valid',
      ));
    }
  }

  private issueToStep(issue: {
    category: string;
    message: string;
    file?: string;
    suggestion: string;
  }): RecoveryStep | null {
    const files = issue.file ? [issue.file] : [];

    switch (issue.category) {
      case 'god-file':
        return {
          order: 0,
          title: `Split oversized file: ${issue.file ?? 'unknown'}`,
          description: issue.suggestion,
          files,
          type: 'extract',
          risk: 'medium',
          automated: false,
        };

      case 'circular-dependency':
        return {
          order: 0,
          title: 'Break circular dependency',
          description: issue.suggestion,
          files,
          type: 'refactor',
          risk: 'high',
          automated: false,
        };

      case 'hardcoded-secret':
        return {
          order: 0,
          title: `Move secret to .env: ${issue.file ?? 'unknown'}`,
          description: 'Move hardcoded secrets to environment variables',
          files,
          type: 'refactor',
          risk: 'low',
          automated: false,
        };

      case 'deep-nesting':
        return {
          order: 0,
          title: `Reduce nesting: ${issue.file ?? 'unknown'}`,
          description: 'Use early returns and guard clauses to reduce nesting depth',
          files,
          type: 'refactor',
          risk: 'low',
          automated: false,
        };

      case 'high-complexity':
        return {
          order: 0,
          title: `Reduce complexity: ${issue.file ?? 'unknown'}`,
          description: issue.suggestion,
          files,
          type: 'extract',
          risk: 'medium',
          automated: false,
        };

      case 'naming-inconsistency':
        return {
          order: 0,
          title: `Standardise naming: ${issue.file ?? 'unknown'}`,
          description: 'Rename to kebab-case for consistency',
          files,
          type: 'rename',
          risk: 'low',
          automated: true,
        };

      case 'layer-violation':
        return {
          order: 0,
          title: `Fix layer violation: ${issue.file ?? 'unknown'}`,
          description: issue.suggestion,
          files,
          type: 'reorganize',
          risk: 'high',
          automated: false,
        };

      default:
        return {
          order: 0,
          title: `Address: ${issue.message}`,
          description: issue.suggestion,
          files,
          type: 'refactor',
          risk: 'medium',
          automated: false,
        };
    }
  }

  private estimateEffort(stepCount: number): string {
    if (stepCount < 5) return '~1 hour';
    if (stepCount < 10) return '~half a day';
    if (stepCount < 20) return '~1 day';
    return '~2-3 days';
  }
}
