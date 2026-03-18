import type { SnapshotEngine } from "vibeguard-core";

export function getRollbackTool(engine: SnapshotEngine) {
	return {
		name: "vibeguard_rollback",
		description:
			"Rollback the project to a previous snapshot. Use this when the user says something like 'undo that', 'go back', 'revert', or when you detect that your changes broke something. Always create a snapshot before rolling back so the rollback itself can be undone.",
		inputSchema: {
			type: "object" as const,
			properties: {
				snapshotId: {
					type: "string",
					description:
						"The snapshot ID to rollback to. If not provided, rolls back to the most recent snapshot.",
				},
			},
		},
		handler: async (params: { snapshotId?: string }) => {
			let targetId = params.snapshotId;

			if (!targetId) {
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
				targetId = listResult.data[0].id;
			}

			const result = await engine.rollbackTo(targetId);
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
							rolledBackTo: targetId,
							safetySnapshotId: result.data.id,
							message: `Rolled back to snapshot ${targetId}. Safety snapshot ${result.data.id} was created.`,
						}),
					},
				],
			};
		},
	};
}
