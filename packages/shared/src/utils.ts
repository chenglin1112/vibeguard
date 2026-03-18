export function shortHash(hash: string): string {
	return hash.slice(0, 7);
}

export function formatTimestamp(ts: number): string {
	return new Date(ts).toISOString();
}

export function pluralize(
	count: number,
	singular: string,
	plural?: string,
): string {
	return count === 1 ? singular : (plural ?? `${singular}s`);
}

export function summarizeChanges(
	filesChanged: string[],
	linesAdded: number,
	linesDeleted: number,
): string {
	const fileCount = filesChanged.length;
	const fileNames =
		filesChanged.length <= 3
			? filesChanged.map((f) => f.split("/").pop()).join(", ")
			: `${filesChanged.length} files`;

	const parts: string[] = [];
	if (linesAdded > 0) parts.push(`+${linesAdded}`);
	if (linesDeleted > 0) parts.push(`-${linesDeleted}`);

	const stats = parts.length > 0 ? ` (${parts.join(" ")})` : "";
	return `Modified ${fileCount} ${pluralize(fileCount, "file")}: ${fileNames}${stats}`;
}
