import { RulesEngine, ConfigLoader } from "@vibeguard/core";
import { RULE_PRESETS } from "@vibeguard/shared";
import { resolve } from "node:path";

export function getRulesTool() {
	return {
		name: "vibeguard_rules",
		description:
			'List available architecture rules and presets. Call this to understand what rules are enforced before making changes.',
		inputSchema: {
			type: "object" as const,
			properties: {
				action: {
					type: "string",
					enum: ["list", "presets"],
					description:
						'Action: "list" shows active rules, "presets" shows available presets. Defaults to "list".',
				},
			},
		},
		async handler(args: { action?: string }) {
			try {
				const action = args.action || "list";

				if (action === "presets") {
					return {
						content: [
							{
								type: "text" as const,
								text: JSON.stringify(RULE_PRESETS, null, 2),
							},
						],
					};
				}

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

				const engine = new RulesEngine(configResult.data.rules, projectRoot);
				const rulesResult = await engine.loadRules();

				if (!rulesResult.ok) {
					return {
						content: [
							{ type: "text" as const, text: rulesResult.error.message },
						],
						isError: true,
					};
				}

				const rulesSummary = rulesResult.data.map((r) => ({
					name: r.name,
					description: r.description,
					severity: r.severity,
				}));

				return {
					content: [
						{
							type: "text" as const,
							text: JSON.stringify(rulesSummary, null, 2),
						},
					],
				};
			} catch (e) {
				return {
					content: [
						{
							type: "text" as const,
							text: `Rules query failed: ${e instanceof Error ? e.message : String(e)}`,
						},
					],
					isError: true,
				};
			}
		},
	};
}
