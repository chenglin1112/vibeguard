export const VIBEGUARD_PREFIX = "[vibeguard]";
export const CONFIG_FILENAME = "vibeguard.yml";
export const DEFAULT_SNAPSHOT_INTERVAL = 30;
export const DEFAULT_MAX_SNAPSHOTS = 500;
export const VIBEGUARD_DATA_DIR = ".vibeguard";

export const DEFAULT_IGNORE = [
	"node_modules",
	".git",
	"dist",
	"*.log",
	".vibeguard",
];

export const DEFAULT_CONFIG = {
	version: 1,
	snapshot: {
		enabled: true,
		auto: true,
		interval: DEFAULT_SNAPSHOT_INTERVAL,
		max_snapshots: DEFAULT_MAX_SNAPSHOTS,
		ignore: DEFAULT_IGNORE,
	},
	rules: {
		preset: "generic",
		custom: [],
	},
	health: {
		complexity_threshold: 15,
		duplication_threshold: 5,
		file_length_threshold: 300,
		dependency_depth_threshold: 5,
	},
	mcp: {
		enabled: true,
		port: 3777,
		mode: "stdio" as const,
	},
};

export const BUILTIN_RULE_NAMES = [
	"no-circular-deps",
	"no-cross-layer-imports",
	"single-responsibility",
	"no-hardcoded-secrets",
	"no-duplicate-logic",
	"max-complexity",
	"no-deep-nesting",
	"consistent-naming",
	"no-god-file",
	"dependency-direction",
] as const;

export const RULE_PRESETS: Record<string, readonly string[]> = {
	generic: BUILTIN_RULE_NAMES,
	"react-app": [...BUILTIN_RULE_NAMES],
	"api-server": [...BUILTIN_RULE_NAMES],
	minimal: ["no-circular-deps", "no-hardcoded-secrets", "no-god-file"],
};
