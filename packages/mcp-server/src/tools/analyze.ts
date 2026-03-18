import { HealthScorer, ConfigLoader } from "@vibeguard/core";
import { resolve } from "node:path";

export function getAnalyzeTool() {
	return {
		name: "vibeguard_analyze",
		description:
			"Analyze the project's overall health and get a score from 0-100 with grade A-F. Call this to understand the current state of the codebase before making significant changes or when the user asks about code quality.",
		inputSchema: {
			type: "object" as const,
			properties: {},
		},
		async handler(_args: Record<string, unknown>) {
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
				const scorer = new HealthScorer(config.health, projectRoot);
				const result = await scorer.generateReport(config);

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
							text: `Analysis failed: ${e instanceof Error ? e.message : String(e)}`,
						},
					],
					isError: true,
				};
			}
		},
	};
}
