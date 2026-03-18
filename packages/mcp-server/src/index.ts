import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
	CallToolRequestSchema,
	ListToolsRequestSchema,
	ListResourcesRequestSchema,
	ReadResourceRequestSchema,
	ListPromptsRequestSchema,
	GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { resolve } from "node:path";
import { SnapshotEngine, SimpleGitAdapter, ConfigLoader } from "@vibeguard/core";
import { getSnapshotTool } from "./tools/snapshot.js";
import { getRollbackTool } from "./tools/rollback.js";
import { getDiffTool } from "./tools/diff.js";
import { getListSnapshotsTool } from "./tools/list-snapshots.js";
import { getCheckTool } from "./tools/check.js";
import { getRulesTool } from "./tools/rules.js";
import { getAnalyzeTool } from "./tools/analyze.js";
import { getRescueTool } from "./tools/rescue.js";
import { getConfigResource } from "./resources/config.js";
import { getSnapshotsResource } from "./resources/snapshots.js";
import { getSafeEditPrompt } from "./prompts/safe-edit.js";

async function main() {
	const projectRoot = resolve(".");

	const configResult = await ConfigLoader.load(projectRoot);
	const config = configResult.ok ? configResult.data : undefined;

	if (!config) {
		console.error("Failed to load VibeGuard config. Run vibeguard init first.");
		process.exit(1);
	}

	const gitAdapter = new SimpleGitAdapter(projectRoot);
	const engine = new SnapshotEngine({
		gitAdapter,
		config: config.snapshot,
		projectRoot,
	});

	const snapshotTool = getSnapshotTool(engine);
	const rollbackTool = getRollbackTool(engine);
	const diffTool = getDiffTool(engine);
	const listTool = getListSnapshotsTool(engine);

	const configResource = getConfigResource(config);
	const snapshotsResource = getSnapshotsResource(engine);

	const safeEditPrompt = getSafeEditPrompt();

	const checkTool = getCheckTool();
	const rulesTool = getRulesTool();
	const analyzeTool = getAnalyzeTool();
	const rescueTool = getRescueTool();

	const tools = [snapshotTool, rollbackTool, diffTool, listTool, checkTool, rulesTool, analyzeTool, rescueTool];
	const resources = [configResource, snapshotsResource];
	const prompts = [safeEditPrompt];

	const server = new Server(
		{ name: "vibeguard", version: "0.0.1" },
		{ capabilities: { tools: {}, resources: {}, prompts: {} } },
	);

	server.setRequestHandler(ListToolsRequestSchema, async () => ({
		tools: tools.map((t) => ({
			name: t.name,
			description: t.description,
			inputSchema: t.inputSchema,
		})),
	}));

	server.setRequestHandler(CallToolRequestSchema, async (request) => {
		const tool = tools.find((t) => t.name === request.params.name);
		if (!tool) {
			return {
				content: [{ type: "text", text: `Unknown tool: ${request.params.name}` }],
				isError: true,
			};
		}
		return tool.handler(request.params.arguments as any);
	});

	server.setRequestHandler(ListResourcesRequestSchema, async () => ({
		resources: resources.map((r) => ({
			uri: r.uri,
			name: r.name,
			description: r.description,
			mimeType: r.mimeType,
		})),
	}));

	server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
		const resource = resources.find((r) => r.uri === request.params.uri);
		if (!resource) {
			throw new Error(`Unknown resource: ${request.params.uri}`);
		}
		const content = await resource.handler();
		return {
			contents: [{ uri: resource.uri, mimeType: resource.mimeType, text: content }],
		};
	});

	server.setRequestHandler(ListPromptsRequestSchema, async () => ({
		prompts: prompts.map((p) => ({
			name: p.name,
			description: p.description,
			arguments: p.arguments,
		})),
	}));

	server.setRequestHandler(GetPromptRequestSchema, async (request) => {
		const prompt = prompts.find((p) => p.name === request.params.name);
		if (!prompt) {
			throw new Error(`Unknown prompt: ${request.params.name}`);
		}
		return prompt.handler(request.params.arguments as any);
	});

	const transport = new StdioServerTransport();
	await server.connect(transport);
}

main().catch(console.error);
