import { RulesEngine, ConfigLoader } from "vibeguard-core";
import { resolve } from "node:path";

export function getCheckTool() {
	return {
		name: "vibeguard_check",
		description:
			"Run architecture rule checks on the project. Call this after making changes to verify they follow the project's architecture rules. Returns violations grouped by severity.",
		inputSchema: {
			type: "object" as const,
			properties: {
				preset: {
					type: "string",
					description:
						"Rule preset to use (generic, react-app, api-server, minimal). Defaults to config setting.",
				},
			},
		},
		async handler(args: { preset?: string }) {
			try {
				const projectRoot = resolve(".");
				const configResult = await ConfigLoader.load(projectRoot);
				if (!configResult.ok) {
					return {
						content: [
							{ type: "text" as const, text: configResult.error.message },
						],
						isError: true,
					};
				}

				const config = configResult.data;
				if (args.preset) {
					config.rules.preset = args.preset;
				}

				const engine = new RulesEngine(config.rules, projectRoot);
				const result = await engine.checkProject();

				if (!result.ok) {
					return {
						content: [
							{ type: "text" as const, text: result.error.message },
						],
						isError: true,
					};
				}

				return {
					content: [
						{ type: "text" as const, text: JSON.stringify(result.data, null, 2) },
					],
				};
			} catch (e) {
				return {
					content: [
						{
							type: "text" as const,
							text: `Check failed: ${e instanceof Error ? e.message : String(e)}`,
						},
					],
					isError: true,
				};
			}
		},
	};
}
