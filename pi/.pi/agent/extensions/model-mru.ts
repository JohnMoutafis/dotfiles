/**
 * Model list with frequently used models on top, ported from omp's model
 * hub ordering (`sortModelItems`: role/MRU first, then catalog order).
 *
 * `/models` opens a picker ranked by last use; every model change is
 * recorded to ~/.pi/agent/model-usage.json (selector -> ISO timestamp).
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { Api, Model } from "@earendil-works/pi-ai";

const USAGE_FILE = path.join(os.homedir(), ".pi/agent/model-usage.json");

const modelId = (m: { provider: string; id: string }) => `${m.provider}/${m.id}`;

function readUsage(): Record<string, string> {
	try {
		return JSON.parse(fs.readFileSync(USAGE_FILE, "utf-8")) as Record<string, string>;
	} catch {
		return {};
	}
}

function recordUsage(selector: string): void {
	const usage = readUsage();
	usage[selector] = new Date().toISOString();
	try {
		fs.mkdirSync(path.dirname(USAGE_FILE), { recursive: true });
		fs.writeFileSync(USAGE_FILE, JSON.stringify(usage, null, 2) + "\n");
	} catch {
		// Unwritable store: the picker still works, just unranked.
	}
}

/** Most recently used first; never-used models keep catalog order. */
function rankByUse(models: readonly Model<Api>[], usage: Record<string, string>): Model<Api>[] {
	const lastUsed = (m: { provider: string; id: string }) =>
		Date.parse(usage[modelId(m)] ?? "") || 0;
	return [...models].sort((a, b) => {
		const diff = lastUsed(b) - lastUsed(a);
		if (diff !== 0) return diff;
		return modelId(a).localeCompare(modelId(b));
	});
}

function ago(iso: string): string {
	const ms = Date.now() - Date.parse(iso);
	if (!Number.isFinite(ms) || ms < 0) return "";
	const hours = Math.floor(ms / 3_600_000);
	if (hours < 1) return "just now";
	if (hours < 24) return `${hours}h ago`;
	return `${Math.floor(hours / 24)}d ago`;
}

async function openModelPicker(pi: ExtensionAPI, ctx: ExtensionContext) {
	if (!ctx.hasUI) {
		ctx.ui.notify("models: needs an interactive session", "error");
		return;
	}
	const usage = readUsage();
	const ranked = rankByUse(ctx.modelRegistry.getAvailable(), usage);
	const current = ctx.model ? modelId(ctx.model) : null;
	const options = ranked.map((m) => {
		const id = modelId(m);
		const used = usage[id] ? ` (${ago(usage[id])})` : "";
		return id === current ? `${id} — current${used}` : `${id}${used}`;
	});
	const choice = await ctx.ui.select("Select model (frequently used first):", options);
	if (choice === undefined) return;
	const model = ranked[options.indexOf(choice)];
	if (!model) return;
	const ok = await pi.setModel(model);
	ctx.ui.notify(
		ok ? `models: switched to ${modelId(model)}` : `models: no API key for ${modelId(model)}`,
		ok ? "info" : "error",
	);
}

export default function (pi: ExtensionAPI) {
	pi.on("session_start", async (_event, ctx) => {
		if (ctx.model) recordUsage(modelId(ctx.model));
	});

	pi.on("model_select", async (event) => {
		recordUsage(modelId(event.model));
	});

	const openModels = async (_args: string, ctx: ExtensionContext) =>
		openModelPicker(pi, ctx);

	pi.registerCommand("models", { description: "Pick a model; frequently used models first.", handler: openModels });
	pi.registerShortcut("alt+p", {
		description: "Open the /models picker",
		handler: async (ctx) => openModelPicker(pi, ctx),
	});
}
