/** Short hash identifier, e.g. "a3f7b2c" */
export type SnapshotId = string;

export interface Snapshot {
	id: SnapshotId;
	timestamp: number;
	message: string;
	filesChanged: string[];
	linesAdded: number;
	linesDeleted: number;
	parent: SnapshotId | null;
}

export interface SnapshotDiff {
	snapshot: Snapshot;
	changes: FileChange[];
}

export interface FileChange {
	path: string;
	type: "added" | "modified" | "deleted" | "renamed";
	additions: number;
	deletions: number;
	hunks: DiffHunk[];
}

export interface DiffHunk {
	oldStart: number;
	oldLines: number;
	newStart: number;
	newLines: number;
	content: string;
}

export type Result<T, E = VibeGuardError> =
	| { ok: true; data: T }
	| { ok: false; error: E };

export interface VibeGuardError {
	code: string;
	message: string;
	suggestion?: string;
}

export interface VibeGuardConfig {
	version: number;
	snapshot: SnapshotConfig;
	rules: RulesConfig;
	health: HealthConfig;
	mcp: McpConfig;
}

export interface SnapshotConfig {
	enabled: boolean;
	auto: boolean;
	interval: number;
	max_snapshots: number;
	ignore: string[];
}

export interface RulesConfig {
	preset: string;
	custom: CustomRule[];
}

export interface CustomRule {
	name: string;
	description: string;
	severity: "error" | "warning" | "info";
}

export interface HealthConfig {
	complexity_threshold: number;
	duplication_threshold: number;
	file_length_threshold: number;
	dependency_depth_threshold: number;
}

export interface McpConfig {
	enabled: boolean;
	port: number;
	mode: "stdio" | "http";
}

export interface GitLogOptions {
	maxCount?: number;
	from?: string;
	to?: string;
}

export interface GitCommit {
	hash: string;
	message: string;
	date: string;
	author: string;
}

export interface GitFileStatus {
	path: string;
	index: string;
	working_dir: string;
}

export interface GitAdapter {
	init(): Promise<Result<void>>;
	isRepo(): Promise<boolean>;
	add(files: string[]): Promise<Result<void>>;
	commit(message: string): Promise<Result<string>>;
	log(options?: GitLogOptions): Promise<Result<GitCommit[]>>;
	diff(from?: string, to?: string): Promise<Result<string>>;
	show(ref: string, path: string): Promise<Result<string>>;
	checkout(ref: string, paths?: string[]): Promise<Result<void>>;
	stash(): Promise<Result<void>>;
	stashPop(): Promise<Result<void>>;
	getCurrentBranch(): Promise<Result<string>>;
	getStatus(): Promise<Result<GitFileStatus[]>>;
}

export interface SnapshotListOptions {
	limit?: number;
	offset?: number;
	since?: number;
}

// ─── Phase 2: Architecture Guard ───

export type RuleSeverity = "error" | "warning" | "info";

export interface RuleContext {
	projectRoot: string;
	config: VibeGuardConfig;
	filePath?: string;
	fileContent?: string;
	dependencyGraph?: DependencyGraph;
}

export interface Rule {
	name: string;
	description: string;
	severity: RuleSeverity;
	check(context: RuleContext): Promise<RuleViolation[]>;
}

export interface RuleViolation {
	rule: string;
	severity: RuleSeverity;
	message: string;
	file?: string;
	line?: number;
	suggestion?: string;
}

export interface ProjectCheckResult {
	violations: RuleViolation[];
	passed: boolean;
	summary: string;
}

export interface DependencyGraph {
	files: Map<string, FileNode>;
	circularDependencies: CircularDependency[];
	layerViolations: LayerViolation[];
}

export interface FileNode {
	path: string;
	imports: ImportInfo[];
	exports: string[];
	layer?: string;
	complexity?: number;
	lineCount?: number;
}

export interface ImportInfo {
	source: string;
	specifiers: string[];
	isTypeOnly: boolean;
}

export interface CircularDependency {
	cycle: string[];
}

export interface LayerDefinition {
	name: string;
	patterns: string[];
	allowedDependencies: string[];
}

export interface LayerViolation {
	from: string;
	to: string;
	fromLayer: string;
	toLayer: string;
	rule: string;
}

// ─── Phase 3: Smart Recovery ───

export type HealthGrade = "A" | "B" | "C" | "D" | "F";

export interface HealthReport {
	score: number;
	grade: HealthGrade;
	metrics: HealthMetrics;
	issues: HealthIssue[];
	trend: HealthTrend | null;
}

export interface HealthMetrics {
	complexity: MetricDetail;
	duplication: MetricDetail;
	fileOrganization: MetricDetail;
	dependencies: MetricDetail;
}

export interface MetricDetail {
	score: number;
	label: string;
	details: string;
}

export interface HealthTrend {
	direction: "improving" | "stable" | "declining";
	changePercent: number;
	comparedTo: SnapshotId;
}

export interface HealthIssue {
	severity: "critical" | "warning" | "info";
	category: string;
	message: string;
	file?: string;
	suggestion: string;
}

export interface RecoveryPlan {
	projectHealth: HealthReport;
	steps: RecoveryStep[];
	estimatedEffort: string;
	summary: string;
}

export interface RecoveryStep {
	order: number;
	title: string;
	description: string;
	files: string[];
	type: "refactor" | "extract" | "reorganize" | "delete" | "rename";
	risk: "low" | "medium" | "high";
	automated: boolean;
}
