import type { SnapshotEngine } from "vibeguard-core";

export function getDiffTool(engine: SnapshotEngine) {
	return {
		name: "vibeguard_diff",
		description:
			"Show what changed since a specific snapshot or since the last snapshot. Use this to review changes before committing or to understand what modifications were made.",
		inputSchema: {
			type: "object" as const,
			properties: {
				snapshotId: {
					type: "string",
					description:
						"Compare against this snapshot. Defaults to the most recent snapshot.",
				},
			},
		},
		handler: async (params: { snapshotId?: string }) => {
			let snapshotId = params.snapshotId;

			if (!snapshotId) {
				const listResult = await engine.listSnapshots({ limit: 1 });
				if (!listResult.ok) {
					return {
						content: [
							{
								type: "text" as const,
								text: JSON.stringify({ error: listResult.error }),
							},
						],
						isError: true,
					};
				}
				if (listResult.data.length === 0) {
					return {
						content: [
							{
								type: "text" as const,
								text: JSON.stringify({ error: { message: "No snapshots found" } }),
							},
						],
						isError: true,
					};
				}
				snapshotId = listResult.data[0].id;
			}

			const result = await engine.getSnapshotDiff(snapshotId);
			if (!result.ok) {
				return {
					content: [
						{ type: "text" as const, text: JSON.stringify({ error: result.error }) },
					],
					isError: true,
				};
			}
			return {
				content: [{ type: "text" as const, text: JSON.stringify(result.data) }],
			};
		},
	};
}
