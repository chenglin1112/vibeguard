import type { Result, VibeGuardError } from "./types.js";

export function ok<T>(data: T): Result<T> {
	return { ok: true, data };
}

export function err<T = never>(error: VibeGuardError): Result<T> {
	return { ok: false, error };
}

export function vibeError(
	code: string,
	message: string,
	suggestion?: string,
): VibeGuardError {
	return { code, message, suggestion };
}

export const ErrorCodes = {
	NOT_A_GIT_REPO: "NOT_A_GIT_REPO",
	SNAPSHOT_FAILED: "SNAPSHOT_FAILED",
	SNAPSHOT_NOT_FOUND: "SNAPSHOT_NOT_FOUND",
	NO_CHANGES: "NO_CHANGES",
	ROLLBACK_FAILED: "ROLLBACK_FAILED",
	CONFIG_INVALID: "CONFIG_INVALID",
	CONFIG_PARSE_ERROR: "CONFIG_PARSE_ERROR",
	WATCHER_FAILED: "WATCHER_FAILED",
	RULE_CHECK_FAILED: "RULE_CHECK_FAILED",
	ANALYSIS_FAILED: "ANALYSIS_FAILED",
	HEALTH_CHECK_FAILED: "HEALTH_CHECK_FAILED",
	RECOVERY_FAILED: "RECOVERY_FAILED",
} as const;
