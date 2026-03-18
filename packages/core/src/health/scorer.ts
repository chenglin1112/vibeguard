import type {
  HealthReport, HealthMetrics, MetricDetail, HealthGrade,
  HealthIssue, HealthConfig, VibeGuardConfig, Result, DependencyGraph, FileNode,
} from '@vibeguard/shared';
import { ok, err, vibeError, ErrorCodes } from '@vibeguard/shared';
import { ArchitectureAnalyzer } from '../analyzer/architecture.js';

/**
 * Scores project health across four dimensions (complexity, duplication,
 * file organisation, dependencies) and surfaces actionable issues.
 */
export class HealthScorer {
  private config: HealthConfig;
  private projectRoot: string;

  constructor(config: HealthConfig, projectRoot: string) {
    this.config = config;
    this.projectRoot = projectRoot;
  }

  /** Generate a full health report for the project. */
  async generateReport(fullConfig: VibeGuardConfig): Promise<Result<HealthReport>> {
    try {
      const analyzer = new ArchitectureAnalyzer(this.projectRoot);
      const graphResult = await analyzer.buildDependencyGraph();
      if (!graphResult.ok) {
        return err(vibeError(
          ErrorCodes.HEALTH_CHECK_FAILED,
          `Health check failed: ${graphResult.error.message}`,
          graphResult.error.suggestion,
        ));
      }

      const graph = graphResult.data;

      const complexity = this.scoreComplexity(graph);
      const duplication = this.scoreDuplication(graph);
      const fileOrganization = this.scoreFileOrganization(graph);
      const dependencies = this.scoreDependencies(graph);

      const metrics: HealthMetrics = { complexity, duplication, fileOrganization, dependencies };
      const score = Math.round(
        complexity.score + duplication.score + fileOrganization.score + dependencies.score,
      );
      const grade = this.toGrade(score);
      const issues = this.collectIssues(metrics, graph);

      return ok({ score, grade, metrics, issues, trend: null });
    } catch (e) {
      return err(vibeError(
        ErrorCodes.HEALTH_CHECK_FAILED,
        `Health check failed: ${e instanceof Error ? e.message : String(e)}`,
        'Ensure the project has valid source files',
      ));
    }
  }

  private scoreComplexity(graph: DependencyGraph): MetricDetail {
    const files = Array.from(graph.files.values());
    if (files.length === 0) {
      return { score: 25, label: 'Complexity', details: 'No source files found' };
    }

    const avg =
      files.reduce((sum, f) => sum + (f.complexity ?? 1), 0) / files.length;
    const threshold = this.config.complexity_threshold;

    const score = avg <= threshold
      ? 25
      : Math.max(0, Math.round(25 * (1 - (avg - threshold) / threshold)));

    return {
      score,
      label: 'Complexity',
      details: `Average complexity ${avg.toFixed(1)} (threshold: ${threshold})`,
    };
  }

  private scoreDuplication(graph: DependencyGraph): MetricDetail {
    const files = Array.from(graph.files.values());
    if (files.length === 0) {
      return { score: 25, label: 'Duplication', details: 'No source files found' };
    }

    const exportCounts = new Map<string, number>();
    for (const file of files) {
      for (const name of file.exports) {
        exportCounts.set(name, (exportCounts.get(name) ?? 0) + 1);
      }
    }

    const threshold = this.config.duplication_threshold;
    let duplicateFileCount = 0;
    for (const file of files) {
      const sharedExports = file.exports.filter(
        name => (exportCounts.get(name) ?? 0) > threshold,
      );
      if (sharedExports.length > 3) duplicateFileCount++;
    }

    const ratio = files.length > 0 ? duplicateFileCount / files.length : 0;
    const score = Math.max(0, Math.round(25 * (1 - ratio)));

    return {
      score,
      label: 'Duplication',
      details: `${duplicateFileCount} file(s) with heavily duplicated exports`,
    };
  }

  private scoreFileOrganization(graph: DependencyGraph): MetricDetail {
    const files = Array.from(graph.files.values());
    if (files.length === 0) {
      return { score: 25, label: 'File Organization', details: 'No source files found' };
    }

    const threshold = this.config.file_length_threshold;
    const oversized = files.filter(f => (f.lineCount ?? 0) > threshold);
    const ratio = files.length > 0 ? oversized.length / files.length : 0;
    const score = Math.max(0, Math.round(25 * (1 - ratio)));

    return {
      score,
      label: 'File Organization',
      details: `${oversized.length} file(s) exceed ${threshold} lines`,
    };
  }

  private scoreDependencies(graph: DependencyGraph): MetricDetail {
    const circCount = graph.circularDependencies.length;
    const layerCount = graph.layerViolations.length;
    const issueCount = circCount + layerCount;

    const score = Math.max(0, Math.round(25 * Math.max(0, 1 - issueCount / 10)));

    const parts: string[] = [];
    if (circCount > 0) parts.push(`${circCount} circular dep(s)`);
    if (layerCount > 0) parts.push(`${layerCount} layer violation(s)`);

    return {
      score,
      label: 'Dependencies',
      details: parts.length > 0 ? parts.join(', ') : 'No dependency issues',
    };
  }

  private toGrade(score: number): HealthGrade {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  private collectIssues(metrics: HealthMetrics, graph: DependencyGraph): HealthIssue[] {
    const issues: HealthIssue[] = [];
    const threshold = this.config.file_length_threshold;

    for (const file of graph.files.values()) {
      if ((file.lineCount ?? 0) > threshold) {
        issues.push({
          severity: (file.lineCount ?? 0) > threshold * 2 ? 'critical' : 'warning',
          category: 'god-file',
          message: `${file.path} is ${file.lineCount} lines (limit: ${threshold})`,
          file: file.path,
          suggestion: 'Split into smaller, focused modules',
        });
      }

      if ((file.complexity ?? 0) > this.config.complexity_threshold) {
        issues.push({
          severity:
            (file.complexity ?? 0) > this.config.complexity_threshold * 2
              ? 'critical'
              : 'warning',
          category: 'high-complexity',
          message: `${file.path} has complexity ${file.complexity} (limit: ${this.config.complexity_threshold})`,
          file: file.path,
          suggestion: 'Extract helper functions or simplify control flow',
        });
      }
    }

    for (const circ of graph.circularDependencies) {
      issues.push({
        severity: 'critical',
        category: 'circular-dependency',
        message: `Circular dependency: ${circ.cycle.join(' → ')}`,
        file: circ.cycle[0],
        suggestion: 'Break the cycle by introducing an interface or shared module',
      });
    }

    for (const lv of graph.layerViolations) {
      issues.push({
        severity: 'warning',
        category: 'layer-violation',
        message: `${lv.fromLayer} → ${lv.toLayer} import violates layer boundaries (${lv.from} → ${lv.to})`,
        file: lv.from,
        suggestion: 'Introduce a service or adapter layer to mediate the dependency',
      });
    }

    return issues;
  }
}
