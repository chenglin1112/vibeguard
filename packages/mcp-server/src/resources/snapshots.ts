import type { SnapshotEngine } from "vibeguard-core";

export function getSnapshotsResource(engine: SnapshotEngine) {
	return {
		uri: "vibeguard://snapshots",
		name: "Recent Snapshots",
		description: "List of the 20 most recent project snapshots",
		mimeType: "application/json",
		handler: async () => {
			const result = await engine.listSnapshots({ limit: 20 });
			if (!result.ok) return JSON.stringify({ error: result.error });
			return JSON.stringify(result.data, null, 2);
		},
	};
}
