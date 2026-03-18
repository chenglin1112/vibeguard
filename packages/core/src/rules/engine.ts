import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ok, err, vibeError, ErrorCodes, RULE_PRESETS } from 'vibeguard-shared';
import type {
  Result, Rule, RuleViolation, RuleContext, RulesConfig,
  VibeGuardConfig, ProjectCheckResult, SnapshotDiff,
} from 'vibeguard-shared';
import { allBuiltinRules } from './builtin/index.js';
import { ArchitectureAnalyzer } from '../analyzer/architecture.js';
import { ConfigLoader } from '../config/loader.js';

/**
 * Orchestrates rule loading and execution against files or an entire project.
 */
export class RulesEngine {
  private config: RulesConfig;
  private projectRoot: string;
  private fullConfig: VibeGuardConfig | null = null;

  constructor(config: RulesConfig, projectRoot: string) {
    this.config = config;
    this.projectRoot = resolve(projectRoot);
  }

  /** Load all applicable rules: builtins filtered by preset plus custom rules. */
  async loadRules(): Promise<Result<Rule[]>> {
    try {
      const preset = this.config.preset ?? 'generic';
      const allowedNames = RULE_PRESETS[preset] ?? RULE_PRESETS['generic'];

      const rules: Rule[] = allBuiltinRules.filter(r =>
        allowedNames.includes(r.name),
      );

      for (const custom of this.config.custom ?? []) {
        rules.push({
          name: custom.name,
          description: custom.description,
          severity: custom.severity,
          async check(): Promise<RuleViolation[]> { return []; },
        });
      }

      return ok(rules);
    } catch (e) {
      return err(vibeError(
        ErrorCodes.RULE_CHECK_FAILED,
        `Failed to load rules: ${e instanceof Error ? e.message : String(e)}`,
      ));
    }
  }

  /** Check a single file against all loaded rules. */
  async checkFile(filePath: string): Promise<Result<RuleViolation[]>> {
    try {
      const rulesResult = await this.loadRules();
      if (!rulesResult.ok) return rulesResult;

      const absPath = resolve(this.projectRoot, filePath);
      let fileContent: string;
      try {
        fileContent = await readFile(absPath, 'utf-8');
      } catch {
        return ok([]);
      }

      const config = await this.getFullConfig();
      const context: RuleContext = {
        projectRoot: this.projectRoot,
        config,
        filePath,
        fileContent,
      };

      const violations: RuleViolation[] = [];
      for (const rule of rulesResult.data) {
        const results = await rule.check(context);
        violations.push(...results);
      }
      return ok(violations);
    } catch (e) {
      return err(vibeError(
        ErrorCodes.RULE_CHECK_FAILED,
        `Failed to check file ${filePath}: ${e instanceof Error ? e.message : String(e)}`,
      ));
    }
  }

  /** Check entire project against all loaded rules. */
  async checkProject(): Promise<Result<ProjectCheckResult>> {
    try {
      const rulesResult = await this.loadRules();
      if (!rulesResult.ok) return rulesResult;

      const analyzer = new ArchitectureAnalyzer(this.projectRoot);
      const graphResult = await analyzer.buildDependencyGraph();
      if (!graphResult.ok) return graphResult;

      const config = await this.getFullConfig();
      const context: RuleContext = {
        projectRoot: this.projectRoot,
        config,
        dependencyGraph: graphResult.data,
      };

      const violations: RuleViolation[] = [];
      for (const rule of rulesResult.data) {
        const results = await rule.check(context);
        violations.push(...results);
      }

      const errors = violations.filter(v => v.severity === 'error').length;
      const warnings = violations.filter(v => v.severity === 'warning').length;
      const infos = violations.filter(v => v.severity === 'info').length;
      const passed = errors === 0;

      const parts: string[] = [];
      if (errors > 0) parts.push(`${errors} error${errors > 1 ? 's' : ''}`);
      if (warnings > 0) parts.push(`${warnings} warning${warnings > 1 ? 's' : ''}`);
      if (infos > 0) parts.push(`${infos} info`);
      const summary = passed
        ? `All checks passed${parts.length ? ` (${parts.join(', ')})` : ''}`
        : `Check failed: ${parts.join(', ')}`;

      return ok({ violations, passed, summary });
    } catch (e) {
      return err(vibeError(
        ErrorCodes.RULE_CHECK_FAILED,
        `Failed to check project: ${e instanceof Error ? e.message : String(e)}`,
      ));
    }
  }

  /** Check only changed files from a diff (incremental). */
  async checkDiff(diff: SnapshotDiff): Promise<Result<RuleViolation[]>> {
    try {
      const changedPaths = diff.changes
        .filter(c => c.type !== 'deleted')
        .map(c => c.path);

      const violations: RuleViolation[] = [];
      for (const filePath of changedPaths) {
        const result = await this.checkFile(filePath);
        if (result.ok) {
          violations.push(...result.data);
        }
      }
      return ok(violations);
    } catch (e) {
      return err(vibeError(
        ErrorCodes.RULE_CHECK_FAILED,
        `Failed to check diff: ${e instanceof Error ? e.message : String(e)}`,
      ));
    }
  }

  private async getFullConfig(): Promise<VibeGuardConfig> {
    if (this.fullConfig) return this.fullConfig;
    const configResult = await ConfigLoader.load(this.projectRoot);
    if (configResult.ok) {
      this.fullConfig = configResult.data;
      return this.fullConfig;
    }
    const { DEFAULT_CONFIG } = await import('vibeguard-shared');
    this.fullConfig = DEFAULT_CONFIG as VibeGuardConfig;
    return this.fullConfig;
  }
}
