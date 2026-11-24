/**
 * Live progress widget for the subagents extension.
 *
 * index.ts keeps a shared WidgetState and calls updateWidget from the
 * onUpdate stream. The registered factory closes over that mutable object,
 * so every TUI re-render shows the latest progress without re-registering.
 */

import type { Message } from "@earendil-works/pi-ai";
import type { ExtensionToolContext } from "@earendil-works/pi-coding-agent";
import { Text, truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { type SingleResult, type UsageStats, emptyUsage, getFinalOutput } from "./spawn.ts";
import { formatToolCall, formatUsageStats, getDisplayItems, resultIcon } from "./render.ts";

const WIDGET_KEY = "subagents";
const THROTTLE_MS = 250;
const MAX_ROWS = 24;
const MAX_TODO_LINES = 12;
const MAX_TAIL_ITEMS = 5;
const MAX_OUTPUT_CHARS = 1200;
const MAX_ACTIVITY_CHARS = 80;

export interface DispatchState {
	label: string;
	results: SingleResult[];
	startedAt: number;
}

export interface WidgetState {
	active: Map<string, DispatchState>;
}

let lastSetAt = 0;

/** Newest `todos` payload in a child's message history, if it wrote one. */
export function parseTodoFromMessages(messages: Message[]): { label: string; done: boolean }[] | undefined {
	for (let i = messages.length - 1; i >= 0; i--) {
		const msg = messages[i] as any;
		if (msg.role !== "toolResult") continue;
		const todos = msg.details?.todos;
		if (!Array.isArray(todos)) continue;
		const items: { label: string; done: boolean }[] = [];
		for (const todo of todos) {
			if (!todo || typeof todo !== "object") continue;
			if (typeof todo.text !== "string" || typeof todo.done !== "boolean") continue;
			items.push({ label: todo.text, done: todo.done });
		}
		return items;
	}
	return undefined;
}

/** Widget body for one child: its TODO list, else its latest output. */
export function deriveTodo(r: SingleResult): string {
	const todos = parseTodoFromMessages(r.messages);
	if (todos) return todos.map((t) => `${t.done ? "[x]" : "[ ]"} ${t.label}`).join("\n");
	const output = getFinalOutput(r.messages);
	if (output) return output.length > MAX_OUTPUT_CHARS ? output.slice(-MAX_OUTPUT_CHARS) : output;
	return "(planning...)";
}

export interface TodoNode {
	id: string;
	label: string;
	done: boolean;
	children: TodoNode[];
}

export interface GrandchildRun {
	ids: string[];
	primary: string;
	status: "running" | "done" | "failed";
	usage: UsageStats;
	agent: string;
	tail: string;
}

export interface AggregateSummary {
	usage: UsageStats;
	cacheHitPct: number | null;
	doneItems: number;
	totalItems: number;
	succeeded: number;
	failed: number;
	running: number;
}

const LIST_LINE = /^(\s*)(?:[-*]\s+\[([ xX])\]\s*|(\d+)[.)]\s+|[-*]\s+)(.+)$/;
const ITEM_PREFIX = /^(?:sub-?items?|items?)\s+([\d.]+)[\d.,\s]*[:\-]?\s*/i;
const BRIEF_IDS = /^\s*(?:Items?|Sub-items?)\s+((?:\d+(?:\.\d+)*)(?:\s*,\s*\d+(?:\.\d+)*)*)\s*:/i;

/** Two-level TODO tree from the worker's own list lines. [] when it wrote none. */
export function parseTodoTree(text: string): TodoNode[] {
	const roots: TodoNode[] = [];
	for (const line of text.split("\n")) {
		const match = LIST_LINE.exec(line);
		if (!match) continue;
		const [, indent, box, number, rest] = match;
		let label = rest.trim();
		let id = "";
		const prefixed = ITEM_PREFIX.exec(label);
		if (prefixed) {
			id = prefixed[1].replace(/\.$/, "");
			label = label.slice(prefixed[0].length).trim();
		} else if (number) {
			id = number;
		}
		const node: TodoNode = { id, label, done: box === "x" || box === "X", children: [] };
		// Deeper than two levels merges into the last level-2 parent.
		if (indent.length >= 2 && roots.length > 0) {
			const parent = roots[roots.length - 1];
			if (!node.id) node.id = `x${roots.length}.${parent.children.length + 1}`;
			parent.children.push(node);
		} else {
			if (!node.id) node.id = `x${roots.length + 1}`;
			roots.push(node);
		}
	}
	return roots;
}

/** Subagent dispatches the worker made, paired with their brief IDs and live tail. */
export function collectGrandchildren(messages: Message[], themeFg?: (color: any, text: string) => string): GrandchildRun[] {
	const runs: GrandchildRun[] = [];
	messages.forEach((msg, index) => {
		const parts = (msg as any).role === "assistant" ? ((msg as any).content ?? []) : [];
		parts.forEach((part: any) => {
			if (part?.type !== "toolCall" || part.name !== "subagent") return;
			const args = part.arguments ?? {};
			const briefs: string[] =
				Array.isArray(args.tasks) && args.tasks.length > 0 ? args.tasks.map((t: any) => String(t?.task ?? "")) : [String(args.task ?? "")];
			const toolResult = messages.slice(index + 1).find((m: any) => m.role === "toolResult" && m.toolCallId === part.id) as any;
			briefs.forEach((brief, i) => runs.push(toGrandchildRun(brief, toolResult?.details?.results?.[i], themeFg)));
		});
	});
	return runs;
}

function toGrandchildRun(brief: string, result: any, themeFg?: (color: any, text: string) => string): GrandchildRun {
	const idsText = BRIEF_IDS.exec(brief)?.[1] ?? "";
	const ids = idsText ? idsText.split(",").map((s) => s.trim()).filter(Boolean) : [];
	const items = getDisplayItems(result?.messages ?? []);
	const last = items[items.length - 1];
	let tail = "(running...)";
	if (last?.type === "toolCall") {
		tail = themeFg ? formatToolCall(last.name, last.args, themeFg) : `${last.name} ${JSON.stringify(last.args).slice(0, 60)}`;
	} else if (last?.type === "text") {
		const line = last.text.split("\n").reverse().find((l) => l.trim())?.trim() ?? "";
		if (line) tail = line.length > 80 ? line.slice(0, 80) : line;
	}
	return { ids, primary: ids[0] ?? "", status: grandchildStatus(result), usage: result?.usage ?? emptyUsage(), agent: result?.agent ?? "task", tail };
}

function grandchildStatus(result: any): GrandchildRun["status"] {
	if (!result) return "running";
	if (result.status === "pending" || result.status === "running") return "running";
	if (result.status === "failed" || result.status === "aborted" || result.errorMessage) return "failed";
	return result.status === "completed" ? "done" : "running";
}

/** Worker plus every grandchild usage, with leaf-item and dispatch counts. */
export function aggregateUsage(workerResult: SingleResult, tree: TodoNode[], grandchildren: GrandchildRun[]): AggregateSummary {
	const usage = emptyUsage();
	const add = (part?: UsageStats) => {
		if (!part) return;
		usage.input += part.input || 0;
		usage.output += part.output || 0;
		usage.cacheRead += part.cacheRead || 0;
		usage.cacheWrite += part.cacheWrite || 0;
		usage.cost += part.cost || 0;
		usage.contextTokens += part.contextTokens || 0;
		usage.turns += part.turns || 0;
	};
	add(workerResult.usage);
	for (const run of grandchildren) add(run.usage);

	let doneItems = 0;
	let totalItems = 0;
	const walk = (nodes: TodoNode[]) => {
		for (const node of nodes) {
			if (node.children.length > 0) walk(node.children);
			else {
				totalItems++;
				if (node.done) doneItems++;
			}
		}
	};
	walk(tree);

	const counted = { succeeded: 0, failed: 0, running: 0 };
	for (const run of grandchildren) {
		if (run.status === "done") counted.succeeded++;
		else if (run.status === "failed") counted.failed++;
		else counted.running++;
	}

	const cacheTotal = usage.input + usage.cacheRead;
	return {
		usage,
		cacheHitPct: cacheTotal > 0 ? Math.round((100 * usage.cacheRead) / cacheTotal) : null,
		doneItems,
		totalItems,
		...counted,
	};
}

function summedUsage(results: SingleResult[]): UsageStats {
	const total: UsageStats = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, contextTokens: 0, turns: 0 };
	for (const result of results) {
		total.input += result.usage.input;
		total.output += result.usage.output;
		total.cacheRead += result.usage.cacheRead;
		total.cacheWrite += result.usage.cacheWrite;
		total.cost += result.usage.cost;
		total.turns += result.usage.turns;
	}
	return total;
}

function formatElapsed(startedAt: number): string {
	const seconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
	if (seconds < 60) return `${seconds}s`;
	const mins = Math.floor(seconds / 60);
	return `${mins}m${String(seconds % 60).padStart(2, "0")}s`;
}

function lastActivity(r: SingleResult, theme: any): string {
	const items = getDisplayItems(r.messages);
	const last = items[items.length - 1];
	if (!last) return theme.fg("muted", "(running...)");
	if (last.type === "toolCall") {
		return theme.fg("muted", "→ ") + formatToolCall(last.name, last.args, theme.fg.bind(theme));
	}
	const lines = last.text.split("\n").filter((line) => line.trim());
	const tail = lines[lines.length - 1]?.trim() ?? "";
	const short = tail.length > MAX_ACTIVITY_CHARS ? `${tail.slice(0, MAX_ACTIVITY_CHARS)}...` : tail;
	return theme.fg("dim", `  ${short}`);
}

function buildSection(dispatch: DispatchState, theme: any): string {
	const { results } = dispatch;
	const usage = formatUsageStats(summedUsage(results), results.find((r) => r.model)?.model);
	const header = [resultIcon("running", false, theme), theme.fg("toolTitle", theme.bold(dispatch.label)), usage, theme.fg("dim", formatElapsed(dispatch.startedAt))]
		.filter(Boolean)
		.join(" ");
	const lines: string[] = [header];

	if (results.length > 0) {
		lines.push(theme.fg("muted", "── todo ──"));
		for (const line of deriveTodo(results[0]).split("\n").slice(0, MAX_TODO_LINES)) lines.push(`  ${line}`);
	}

	const live = results.filter((r) => r.status === "pending" || r.status === "running");
	for (const r of live.slice(0, MAX_TAIL_ITEMS)) {
		const usageText = formatUsageStats(r.usage, r.model);
		lines.push(resultIcon(r.status, false, theme) + " " + theme.fg("accent", r.agent) + (usageText ? theme.fg("dim", ` ${usageText}`) : ""));
		lines.push(lastActivity(r, theme));
	}
	if (live.length > MAX_TAIL_ITEMS) lines.push(theme.fg("muted", `  ... +${live.length - MAX_TAIL_ITEMS} more`));

	return lines.join("\n");
}

const MAX_LOG_BOX_LINES = 5;
const MAX_TODO_BOX_CONTENT_LINES = 14;
const MAX_LOG_CHARS = 70;

/** One bordered box; every line is padded so the visible width stays constant. */
function renderBox(title: string, content: string[], width: number, theme: any): string {
	const border = (text: string) => theme.fg("muted", text);
	const titleText = theme.fg("toolTitle", theme.bold(title));
	const inner = width - 4;
	const topPad = Math.max(0, width - 5 - visibleWidth(titleText));
	const lines = [border("┌─ ") + titleText + border(` ${"─".repeat(topPad)}┐`)];
	for (const line of content) {
		const clipped = truncateToWidth(line, inner, "");
		lines.push(`${border("│")} ${clipped}${" ".repeat(Math.max(0, inner - visibleWidth(clipped)))} ${border("│")}`);
	}
	lines.push(border(`└${"─".repeat(Math.max(0, width - 2))}┘`));
	return lines.join("\n");
}

function runStatusIcon(status: GrandchildRun["status"], theme: any): string {
	if (status === "running") return theme.fg("warning", "⏳");
	if (status === "failed") return theme.fg("error", "✗");
	return theme.fg("success", "✓");
}

function formatTokenCount(count: number): string {
	if (count < 1000) return String(count);
	if (count < 10000) return `${(count / 1000).toFixed(1)}k`;
	if (count < 1000000) return `${Math.round(count / 1000)}k`;
	return `${(count / 1000000).toFixed(1)}M`;
}

/** One bordered mini-box per matched subagent, indented under its TODO node. */
function runDetailLines(run: GrandchildRun, width: number, theme: any): string[] {
	const word = run.status === "running" ? "running" : run.status === "failed" ? "failed" : "done";
	const color = run.status === "running" ? "warning" : run.status === "failed" ? "error" : "success";
	const content = [
		`${theme.fg(color, word)} · ${theme.fg("dim", formatUsageStats(run.usage) || "(no usage)")}`,
		theme.fg("dim", truncateToWidth(run.tail, Math.max(8, width - 12), "")),
	];
	return renderBox(run.agent, content, width - 8, theme)
		.split("\n")
		.map((line) => `    ${line}`);
}

/** Three stacked boxes for a worker child: its live log, its TODO tree, its totals. */
function buildWorkerSection(dispatch: DispatchState, theme: any, width: number): string {
	const workerResult = dispatch.results[0];
	const workerMessages = workerResult.messages;
	const fg = theme.fg.bind(theme);

	const logLines: string[] = [];
	for (const item of getDisplayItems(workerMessages)) {
		if (item.type === "toolCall") logLines.push(theme.fg("muted", "→ ") + formatToolCall(item.name, item.args, fg));
		else {
			const line = item.text.split("\n").reverse().find((l) => l.trim())?.trim();
			if (line) logLines.push(theme.fg("dim", line.length > MAX_LOG_CHARS ? `${line.slice(0, MAX_LOG_CHARS)}...` : line));
		}
	}

	let tree = parseTodoTree(getFinalOutput(workerMessages));
	if (tree.length === 0) {
		const todos = parseTodoFromMessages(workerMessages);
		const flat = todos ?? deriveTodo(workerResult).split("\n").map((label) => ({ label: label.trim(), done: false }));
		tree = flat.filter((t) => t.label && t.label !== "(planning...)").map((t, i) => ({ id: `x${i + 1}`, label: t.label, done: t.done, children: [] }));
	}

	const runs = collectGrandchildren(workerMessages, fg);
	const matched = new Set<GrandchildRun>();
	const blocks: string[][] = [];
	const addNode = (node: TodoNode, level: number) => {
		const nodeRuns = runs.filter((run) => run.primary !== "" && run.primary === node.id);
		for (const run of nodeRuns) matched.add(run);
		const icon = nodeRuns.length > 0 ? `${runStatusIcon(nodeRuns[0].status, theme)} ` : "";
		const block = [`${"  ".repeat(level - 1)}${node.done ? "[x]" : "[ ]"} ${icon}${node.label}`];
		for (const run of nodeRuns) block.push(...runDetailLines(run, width, theme));
		blocks.push(block);
		for (const child of node.children) addNode(child, level + 1);
	};
	for (const node of tree) addNode(node, 1);

	const inflight = runs.filter((run) => !matched.has(run));
	if (inflight.length > 0) {
		blocks.push([theme.fg("muted", "in flight:")]);
		for (const run of inflight) {
			const detail = run.tail === "(running...)" && run.ids.length > 0 ? run.ids.join(", ") : run.tail;
			blocks.push([`${runStatusIcon(run.status, theme)} ${theme.fg("accent", run.agent)} ${detail}`]);
		}
	}

	const lines: string[] = [];
	let dropped = 0;
	if (blocks.reduce((n, block) => n + block.length, 0) > MAX_TODO_BOX_CONTENT_LINES) {
		let used = 0;
		for (const block of blocks) {
			if (used + block.length > MAX_TODO_BOX_CONTENT_LINES - 1) {
				dropped++;
				continue;
			}
			lines.push(...block);
			used += block.length;
		}
	} else {
		for (const block of blocks) lines.push(...block);
	}
	if (dropped > 0) lines.push(theme.fg("muted", `... +${dropped} more`));

	const totals = aggregateUsage(workerResult, tree, runs);
	const cacheHit = totals.cacheHitPct === null ? "" : ` · cache hit ${totals.cacheHitPct}%`;
	const summaryLines = [
		`items: ${totals.doneItems}/${totals.totalItems} done`,
		`dispatches: ${totals.succeeded} ok / ${totals.failed} failed / ${totals.running} running`,
		`↑${formatTokenCount(totals.usage.input)} ↓${formatTokenCount(totals.usage.output)}${cacheHit} · ${formatElapsed(dispatch.startedAt)}`,
	];

	return [
		renderBox("worker logs", logLines.slice(-MAX_LOG_BOX_LINES), width, theme),
		renderBox("todo", lines, width, theme),
		renderBox("summary", summaryLines, width, theme),
	].join("\n");
}

function buildWidgetText(state: WidgetState, theme: any, width: number): string {
	const sections: string[] = [];
	for (const dispatch of state.active.values()) {
		if (dispatch.label === "worker" && dispatch.results.length > 0) {
			sections.push(buildWorkerSection(dispatch, theme, width));
			continue;
		}
		// Worker boxes self-cap; the compact path keeps its row budget.
		sections.push(buildSection(dispatch, theme).split("\n").slice(0, MAX_ROWS).join("\n"));
	}
	return sections.join("\n\n");
}

/** Rebuilds from shared state on every render, so the widget stays current. */
class WidgetText extends Text {
	private widgetState: WidgetState;
	private theme: any;

	constructor(widgetState: WidgetState, theme: any) {
		super("", 0, 0);
		this.widgetState = widgetState;
		this.theme = theme;
	}

	override render(_width: number): readonly string[] {
		const width = Math.max(40, Number(_width) || 60);
		this.setText(buildWidgetText(this.widgetState, this.theme, width));
		return super.render(_width);
	}
}

export function updateWidget(ctx: ExtensionToolContext, state: WidgetState): void {
	if (!ctx.hasUI) return;
	if (state.active.size === 0) {
		lastSetAt = 0;
		ctx.ui.setWidget(WIDGET_KEY, undefined);
		return;
	}
	const now = Date.now();
	if (now - lastSetAt < THROTTLE_MS) return;
	lastSetAt = now;
	ctx.ui.setWidget(WIDGET_KEY, (_tui: any, theme: any) => new WidgetText(state, theme));
}
