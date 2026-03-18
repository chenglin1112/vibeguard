import type { VibeGuardConfig } from "vibeguard-shared";

export function getConfigResource(config: VibeGuardConfig) {
	return {
		uri: "vibeguard://config",
		name: "VibeGuard Configuration",
		description: "Current VibeGuard configuration for this project",
		mimeType: "application/json",
		handler: async () => JSON.stringify(config, null, 2),
	};
}
