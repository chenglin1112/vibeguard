import { HealthScorer, RecoveryPlanner, ConfigLoader } from "vibeguard-core";
import { resolve } from "node:path";

export function getRescueTool() {
	return {
		name: "vibeguard_rescue",
		description:
			"Generate a step-by-step recovery plan for the project based on its health analysis. Call this when the codebase has issues and you need a structured plan to fix them. Returns prioritized steps sorted by risk level (quick wins first).",
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
				const reportResult = await scorer.generateReport(config);

				if (!reportResult.ok) {
					return {
						content: [
							{ type: "text" as const, text: reportResult.error.message },
						],
						isError: true,
					};
				}

				const planner = new RecoveryPlanner(projectRoot);
				const planResult = await planner.createPlan(reportResult.data);

				if (!planResult.ok) {
					return {
						content: [
							{ type: "text" as const, text: planResult.error.message },
						],
						isError: true,
					};
				}

				return {
					content: [
						{ type: "text" as const, text: JSON.stringify(planResult.data, null, 2) },
					],
				};
			} catch (e) {
				return {
					content: [
						{
							type: "text" as const,
							text: `Rescue plan failed: ${e instanceof Error ? e.message : String(e)}`,
						},
					],
					isError: true,
				};
			}
		},
	};
}
