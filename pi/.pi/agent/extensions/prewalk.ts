/**
 * Prewalk: one-way mid-session model handoff, ported from oh-my-pi.
 *
 * `/prewalk [provider/model]` arms a handoff from the active model to the
 * target (the configured default, unless named). The first edit/write is
 * blocked with the plan demand; after the agent writes a todo list, the
 * next edit/write switches the model and injects a checklist nudge.
 */

import {
	type ExtensionContext,
	type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import type { Api, Model } from "@earendil-works/pi-ai";
import type { AutocompleteItem } from "@earendil-works/pi-tui";

const TODO_TOOL = "todo";
// State-changing todo actions; `list`/`get` do not satisfy the gate.
const TODO_ACTIONS = new Set(["create", "update"]);
// File-mutating tools. pi-hashline-edit-pro replaces the built-in `edit`
// with anchored editors, and the Serena MCP server exposes its own file
// editors; all of them must cross the prewalk line. shortcut: the MCP
// names are pinned to the server alias "serena"; re-check when the MCP
// config renames the server or adds another editing server.
const MUTATING_TOOLS = new Set([
	"edit",
	"write",
	"replace",
	"replace_match",
	"insert",
	"copy",
	"move",
	"mcp__serena__create_text_file",
	"mcp__serena__replace_content",
	"mcp__serena__replace_in_files",
	"mcp__serena__replace_symbol_body",
	"mcp__serena__insert_after_symbol",
	"mcp__serena__insert_before_symbol",
	"mcp__serena__rename_symbol",
	"mcp__serena__safe_delete_symbol",
]);

const GATE_A_REASON =
  "Use all the tools at your disposal to plan deeply, then capture the plan as a comprehensive TODO list " +
	"(build the TODO with 5-9 steps; each step must change code or verify it). Finally implement the plan.";

const CHECKLIST_NUDGE =
	"You now implement a plan written by a stronger model. Keep scope minimal. " +
	"Grep every call site before you change a shared function. Run the full test module before you claim done.";

type State = "unarmed" | "armed" | "plan-demanded" | "todo-seen";

let state: State = "unarmed";
let target: Model<Api> | null = null;
// tool_execution_end carries no args; capture the call at start, confirm at end.
let pendingTodoId: string | null = null;
// Active model after a handoff; drives the working badge.
let workingModel: string | null = null;
// Completion list snapshot; getArgumentCompletions receives no ctx.
let knownModels: string[] = [];

const modelId = (m: { provider: string; id: string }) => `${m.provider}/${m.id}`;

function resolveTarget(pi: ExtensionAPI, ctx: ExtensionContext, arg: string): Model<Api> | null {
	if (arg) {
		const sep = arg.lastIndexOf("/");
		const provider = sep === -1 ? arg : arg.slice(0, sep);
		const id = sep === -1 ? arg : arg.slice(sep + 1);
		return ctx.modelRegistry.find(provider, id) ?? null;
	}
	const settings = pi.getSettings();
	const provider = (settings as { defaultProvider?: string }).defaultProvider;
	const id = (settings as { defaultModel?: string }).defaultModel;
	if (!provider || !id) return null;
	return ctx.modelRegistry.find(provider, id) ?? null;
}

function disarm(ctx: ExtensionContext, notice?: string, level: "info" | "error" = "info") {
	state = "unarmed";
	target = null;
	pendingTodoId = null;
	workingModel = null;
	ctx.ui.setStatus("prewalk", undefined);
	ctx.ui.setWidget("prewalk", undefined);
	if (notice) ctx.ui.notify(notice, level);
}

function arm(pi: ExtensionAPI, ctx: ExtensionContext, arg: string) {
	const model = resolveTarget(pi, ctx, arg);
	if (!model) {
		disarm(ctx, `prewalk: unknown or unresolved model "${arg}"`, "error");
		return;
	}
	if (ctx.model && modelId(model) === modelId(ctx.model)) {
		disarm(ctx, "prewalk: target equals the active model; disarmed");
		return;
	}
	target = model;
	state = "armed";
	ctx.ui.setStatus("prewalk", `prewalk: ${modelId(model)}`);
	const planner = ctx.model ? modelId(ctx.model) : "unknown";
	ctx.ui.notify(`prewalk: ${planner} is planning; hands off to ${modelId(model)} at the first edit`, "info");
}

export default function (pi: ExtensionAPI) {
	pi.on("session_start", async (_event, ctx) => {
		// A resumed session keeps its model via session history; armed
		// state is deliberately not restored (see design, edge cases).
		state = "unarmed";
		target = null;
		pendingTodoId = null;
		workingModel = null;
		knownModels = ctx.modelRegistry.getAvailable().map(modelId);
		ctx.ui.setStatus("prewalk", undefined);
		ctx.ui.setWidget("prewalk", undefined);
	});

	pi.on("model_select", async (event, ctx) => {
		// The badge survives our own handoff (same model); a later
		// manual change or cycle drops it.
		if (!workingModel) return;
		if (`${event.model.provider}/${event.model.id}` === workingModel) return;
		workingModel = null;
		ctx.ui.setStatus("prewalk", undefined);
	});

	pi.on("tool_call", async (event, ctx) => {
		if (state === "unarmed" || !target) return;
		if (!MUTATING_TOOLS.has(event.toolName)) return;

		if (state === "todo-seen") {
			const to = modelId(target);
			const from = ctx.model ? modelId(ctx.model) : "unknown";
			const ok = await pi.setModel(target);
			if (!ok) {
				disarm(ctx, `prewalk: ${to} is not available; disarmed`, "error");
				return { block: true, reason: "prewalk disarmed: target model is not available" };
			}
			pi.appendEntry("prewalk-handoff", { from, to, at: new Date().toISOString() });
			pi.sendMessage(
				{ customType: "prewalk-checklist", content: CHECKLIST_NUDGE, display: true },
				{ deliverAs: "steer" },
			);
			disarm(ctx, `prewalk: ${to} is now working`);
			// Keep the working badge until the user changes model again.
			workingModel = to;
			ctx.ui.setStatus("prewalk", `prewalk: ${to} is working`);
			return;
		}

		if (state === "armed") state = "plan-demanded";
		return { block: true, reason: GATE_A_REASON };
	});

	pi.on("tool_execution_start", (event) => {
		if (state !== "plan-demanded" || event.toolName !== TODO_TOOL) return;
		const action = (event.args as { action?: string } | undefined)?.action;
		pendingTodoId = action && TODO_ACTIONS.has(action) ? event.toolCallId : null;
	});

	pi.on("tool_execution_end", (event, ctx) => {
		if (state !== "plan-demanded" || pendingTodoId === null) return;
		if (event.toolCallId !== pendingTodoId) return;
		pendingTodoId = null;
		if (event.isError) return;
		state = "todo-seen";
		// Show the captured plan: visual confirmation that Gate B passed.
		const tasks = (
			event.result as { details?: { tasks?: { subject: string; status: string }[] } } | undefined
		)?.details?.tasks;
		const lines = ["prewalk: plan captured"];
		for (const t of tasks ?? []) {
			const mark = t.status === "completed" ? "[x]" : t.status === "in_progress" ? "[~]" : "[ ]";
			lines.push(`  ${mark} ${t.subject}`);
		}
		ctx.ui.setWidget("prewalk", lines);
		if (target) {
			ctx.ui.setStatus("prewalk", `prewalk: plan captured, next edit hands off to ${modelId(target)}`);
		}
	});

	pi.registerCommand("prewalk", {
		description:
			"Arm the prewalk handoff: plan on the current model, switch to the target at the first file edit. No argument = the configured default model.",
		getArgumentCompletions: (prefix: string): AutocompleteItem[] | null => {
			const hits = knownModels
				.filter((id) => id.startsWith(prefix))
				.map((id) => ({ value: id, label: id }));
			return hits.length > 0 ? hits : null;
		},
		handler: async (args: string, ctx) => {
			const arg = args.trim();
			if (arg === "off") {
				disarm(ctx, "prewalk: disarmed");
				return;
			}
			if (arg === "restart") {
				// Re-arm: keep the previous target when one was set.
				const kept = target ? modelId(target) : "";
				disarm(ctx);
				arm(pi, ctx, kept);
				return;
			}
			arm(pi, ctx, arg);
		},
	});
}
