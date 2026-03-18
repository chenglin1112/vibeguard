export function getSafeEditPrompt() {
	return {
		name: "vibeguard_safe_edit",
		description:
			"A template for making safe code changes with automatic snapshot protection.",
		arguments: [
			{ name: "files", description: "Files to be edited", required: true },
			{
				name: "rules",
				description: "Architecture rules to follow",
				required: false,
			},
		],
		handler: async (params: { files: string; rules?: string }) => {
			const rulesText =
				params.rules ?? "No specific architecture rules configured.";
			return {
				messages: [
					{
						role: "user" as const,
						content: {
							type: "text" as const,
							text: `I will now make changes to ${params.files}. VibeGuard will automatically create a snapshot before and after these changes. The architecture rules for this project are:\n${rulesText}\n\nI will ensure my changes comply with these rules. After editing, I will run vibeguard_check to verify compliance.`,
						},
					},
				],
			};
		},
	};
}
