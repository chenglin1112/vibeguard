import type { SnapshotEngine } from "vibeguard-core";

export function getSnapshotTool(engine: SnapshotEngine) {
	return {
		name: "vibeguard_snapshot",
		description:
			"Create a snapshot (checkpoint) of the current project state before making changes. IMPORTANT: You should call this tool BEFORE making any significant code modifications. This allows the user to rollback if something goes wrong.",
		inputSchema: {
			type: "object" as const,
			properties: {
				message: {
					type: "string",
					description:
						"A brief description of what you're about to change, e.g. 'Before refactoring auth module'",
				},
			},
		},
		handler: async (params: { message?: string }) => {
			const result = await engine.createSnapshot(params.message);
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
