import type { SnapshotEngine } from "vibeguard-core";

export function getListSnapshotsTool(engine: SnapshotEngine) {
	return {
		name: "vibeguard_list_snapshots",
		description:
			"List recent project snapshots with their IDs, timestamps, and change summaries. Use this to find a specific point in time to rollback to or to review project history.",
		inputSchema: {
			type: "object" as const,
			properties: {
				limit: {
					type: "number",
					description: "Maximum number of snapshots to return. Default: 20.",
				},
			},
		},
		handler: async (params: { limit?: number }) => {
			const result = await engine.listSnapshots({ limit: params.limit ?? 20 });
			if (!result.ok) {
				return {
					content: [
						{ type: "text" as const, text: JSON.stringify({ error: result.error }) },
					],
					isError: true,
				};
			}
			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify({
							snapshots: result.data,
							count: result.data.length,
						}),
					},
				],
			};
		},
	};
}
