/**
 * TUI rendering for the subagents extension tool.
 */

import * as os from "node:os";
import type { AgentToolResult } from "@earendil-works/pi-agent-core";
import { formatReadLineRange, getMarkdownTheme } from "@earendil-works/pi-coding-agent";
import { Container, Markdown, Spacer, Text } from "@earendil-works/pi-tui";
import { type SingleResult, type SubagentDetails, type UsageStats, getFailureSummary, getFinalOutput, isFailedResult } from "./spawn.ts";

const COLLAPSED_ITEM_COUNT = 10;

// Shared status icon for single and parallel render paths, and the live widget.
export function resultIcon(status: SingleResult["status"], failed: boolean, theme: any): string {
	if (status === "pending" || status === "running") return theme.fg("warning", "⏳");
	if (failed) return theme.fg("error", "✗");
	return theme.fg("success", "✓");
}

function formatTokens(count: number): string {
	if (count < 1000) return count.toString();
	if (count < 10000) return `${(count / 1000).toFixed(1)}k`;
	if (count < 1000000) return `${Math.round(count / 1000)}k`;
	return `${(count / 1000000).toFixed(1)}M`;
}

export function formatUsageStats(usage: UsageStats, model?: string): string {
	const parts: string[] = [];
	if (usage.turns) parts.push(`${usage.turns} turn${usage.turns > 1 ? "s" : ""}`);
	if (usage.input) parts.push(`↑${formatTokens(usage.input)}`);
	if (usage.output) parts.push(`↓${formatTokens(usage.output)}`);
	if (usage.cacheRead) parts.push(`R${formatTokens(usage.cacheRead)}`);
	if (usage.cacheWrite) parts.push(`W${formatTokens(usage.cacheWrite)}`);
	if (usage.cost) parts.push(`$${usage.cost.toFixed(4)}`);
	if (usage.contextTokens && usage.contextTokens > 0) {
		parts.push(`ctx:${formatTokens(usage.contextTokens)}`);
	}
	if (model) parts.push(model);
	return parts.join(" ");
}

export function formatToolCall(toolName: string, args: Record<string, unknown>, themeFg: (color: any, text: string) => string): string {
	const shortenPath = (p: string) => {
		const home = os.homedir();
		return p.startsWith(home) ? `~${p.slice(home.length)}` : p;
	};

	switch (toolName) {
		case "bash": {
			const command = (args.command as string) || "...";
			const preview = command.length > 60 ? `${command.slice(0, 60)}...` : command;
			return themeFg("muted", "$ ") + themeFg("toolOutput", preview);
		}
		case "read": {
			const rawPath = (args.file_path || args.path || "...") as string;
			const filePath = shortenPath(rawPath);
			const lineRange = formatReadLineRange(args.offset, args.limit);
			let text = themeFg("muted", "read ") + themeFg("accent", filePath);
			if (lineRange) {
				text += themeFg("warning", lineRange);
			}
			return text;
		}
		case "write": {
			const rawPath = (args.file_path || args.path || "...") as string;
			const filePath = shortenPath(rawPath);
			const content = (args.content || "") as string;
			const lines = content.split("\n").length;
			let text = themeFg("muted", "write ") + themeFg("accent", filePath);
			if (lines > 1) text += themeFg("dim", ` (${lines} lines)`);
			return text;
		}
		case "edit": {
			const rawPath = (args.file_path || args.path || "...") as string;
			return themeFg("muted", "edit ") + themeFg("accent", shortenPath(rawPath));
		}
		case "ls": {
			const rawPath = (args.path || ".") as string;
			return themeFg("muted", "ls ") + themeFg("accent", shortenPath(rawPath));
		}
		case "find": {
			const pattern = (args.pattern || "*") as string;
			const rawPath = (args.path || ".") as string;
			return themeFg("muted", "find ") + themeFg("accent", pattern) + themeFg("dim", ` in ${shortenPath(rawPath)}`);
		}
		case "grep": {
			const pattern = (args.pattern || "") as string;
			const rawPath = (args.path || ".") as string;
			return (
				themeFg("muted", "grep ") +
				themeFg("accent", `/${pattern}/`) +
				themeFg("dim", ` in ${shortenPath(rawPath)}`)
			);
		}
		default: {
			const argsStr = JSON.stringify(args);
			const preview = argsStr.length > 50 ? `${argsStr.slice(0, 50)}...` : argsStr;
			return themeFg("accent", toolName) + themeFg("dim", ` ${preview}`);
		}
	}
}

type DisplayItem = { type: "text"; text: string } | { type: "toolCall"; name: string; args: Record<string, any> };

export function getDisplayItems(messages: SingleResult["messages"]): DisplayItem[] {
	const items: DisplayItem[] = [];
	for (const msg of messages) {
		if (msg.role === "assistant") {
			for (const part of msg.content) {
				if (part.type === "text") items.push({ type: "text", text: part.text });
				else if (part.type === "toolCall") items.push({ type: "toolCall", name: part.name, args: part.arguments });
			}
		}
	}
	return items;
}

const aggregateUsage = (results: SingleResult[]): UsageStats => {
	const total: UsageStats = {
		input: 0,
		output: 0,
		cacheRead: 0,
		cacheWrite: 0,
		cost: 0,
		contextTokens: 0,
		turns: 0,
	};
	for (const result of results) {
		total.input += result.usage.input;
		total.output += result.usage.output;
		total.cacheRead += result.usage.cacheRead;
		total.cacheWrite += result.usage.cacheWrite;
		total.cost += result.usage.cost;
		total.turns += result.usage.turns;
	}
	return total;
};

export function renderCall(args: Record<string, any>, theme: any, _context: any): Text {
	if (args.tasks && args.tasks.length > 0) {
		let text =
			theme.fg("toolTitle", theme.bold("subagent ")) +
			theme.fg("accent", `parallel (${args.tasks.length} tasks)`);
		for (const t of args.tasks.slice(0, 3)) {
			const preview = t.task.length > 40 ? `${t.task.slice(0, 40)}...` : t.task;
			text += `\n  ${theme.fg("accent", t.agent ?? "task")}${theme.fg("dim", ` ${preview}`)}`;
		}
		if (args.tasks.length > 3) text += `\n  ${theme.fg("muted", `... +${args.tasks.length - 3} more`)}`;
		return new Text(text, 0, 0);
	}

	const agentName = args.agent || "task";
	const preview = args.task ? (args.task.length > 60 ? `${args.task.slice(0, 60)}...` : args.task) : "...";
	let text = theme.fg("toolTitle", theme.bold("subagent ")) + theme.fg("accent", agentName);
	text += `\n  ${theme.fg("dim", preview)}`;
	return new Text(text, 0, 0);
}

export function renderResult(result: AgentToolResult<SubagentDetails>, opts: { expanded: boolean }, theme: any, _context: any): Container | Text {
	const details = result.details;
	if (!details || details.results.length === 0) {
		const text = result.content[0];
		return new Text(text?.type === "text" ? text.text : "(no output)", 0, 0);
	}

	const { expanded } = opts;
	const mdTheme = getMarkdownTheme();

	const renderDisplayItems = (items: DisplayItem[], limit?: number) => {
		const toShow = limit ? items.slice(-limit) : items;
		const skipped = limit && items.length > limit ? items.length - limit : 0;
		let text = "";
		if (skipped > 0) text += theme.fg("muted", `... ${skipped} earlier items\n`);
		for (const item of toShow) {
			if (item.type === "text") {
				const preview = expanded ? item.text : item.text.split("\n").slice(0, 3).join("\n");
				text += `${theme.fg("toolOutput", preview)}\n`;
			} else {
				text += `${theme.fg("muted", "→ ") + formatToolCall(item.name, item.args, theme.fg.bind(theme))}\n`;
			}
		}
		return text.trimEnd();
	};


	if (details.mode === "single" && details.results.length === 1) {
		const r = details.results[0];
		const isError = isFailedResult(r);
		const isRunning = r.status === "pending" || r.status === "running";
		const icon = resultIcon(r.status, isFailedResult(r), theme);
		const displayItems = getDisplayItems(r.messages);
		const finalOutput = getFinalOutput(r.messages);

		if (expanded) {
			const container = new Container();
			let header = `${icon} ${theme.fg("toolTitle", theme.bold(r.agent))}${theme.fg("muted", ` (${r.agentSource})`)}`;
			if (isRunning) header += ` ${theme.fg("warning", `[${r.status}]`)}`;
			else if (isError) header += ` ${theme.fg("error", `[${r.stopReason ?? r.status}]`)}`;
			container.addChild(new Text(header, 0, 0));
			if (isError && r.errorMessage) container.addChild(new Text(theme.fg("error", `Error: ${r.errorMessage}`), 0, 0));
			if (r.terminationSignal) container.addChild(new Text(theme.fg("error", `Signal: ${r.terminationSignal}`), 0, 0));
			if (r.stderr.trim()) container.addChild(new Text(theme.fg("error", `stderr: ${r.stderr.trim()}`), 0, 0));
			container.addChild(new Spacer(1));
			container.addChild(new Text(theme.fg("muted", "─── Task ───"), 0, 0));
			container.addChild(new Text(theme.fg("dim", r.task), 0, 0));
			container.addChild(new Spacer(1));
			container.addChild(new Text(theme.fg("muted", "─── Output ───"), 0, 0));
			if (displayItems.length === 0 && !finalOutput) {
				container.addChild(new Text(theme.fg("muted", "(no output)"), 0, 0));
			} else {
				for (const item of displayItems) {
					if (item.type === "toolCall")
						container.addChild(
							new Text(theme.fg("muted", "→ ") + formatToolCall(item.name, item.args, theme.fg.bind(theme)), 0, 0),
						);
				}
				if (finalOutput) {
					container.addChild(new Spacer(1));
					container.addChild(new Markdown(finalOutput.trim(), 0, 0, mdTheme));
				}
			}
			const usageStr = formatUsageStats(r.usage, r.model);
			if (usageStr) {
				container.addChild(new Spacer(1));
				container.addChild(new Text(theme.fg("dim", usageStr), 0, 0));
			}
			return container;
		}

		let text = `${icon} ${theme.fg("toolTitle", theme.bold(r.agent))}${theme.fg("muted", ` (${r.agentSource})`)}`;
		if (isRunning) text += ` ${theme.fg("warning", `[${r.status}]`)}`;
		else if (isError) text += ` ${theme.fg("error", `[${r.stopReason ?? r.status}]`)}`;
		if (isError && r.errorMessage) text += `\n${theme.fg("error", `Error: ${r.errorMessage}`)}`;
		else if (displayItems.length === 0) text += `\n${theme.fg("muted", "(no output)")}`;
		else {
			text += `\n${renderDisplayItems(displayItems, COLLAPSED_ITEM_COUNT)}`;
			if (displayItems.length > COLLAPSED_ITEM_COUNT) text += `\n${theme.fg("muted", "(Ctrl+O to expand)")}`;
		}
		const usageStr = formatUsageStats(r.usage, r.model);
		if (usageStr) text += `\n${theme.fg("dim", usageStr)}`;
		return new Text(text, 0, 0);
	}

	if (details.mode === "parallel") {
		const running = details.results.filter((result) => result.status === "running").length;
		const pending = details.results.filter((result) => result.status === "pending").length;
		const successCount = details.results.filter((result) => result.status === "completed").length;
		const failCount = details.results.filter(isFailedResult).length;
		const isRunning = running > 0 || pending > 0;
		let icon = theme.fg("success", "✓");
		if (isRunning) icon = theme.fg("warning", "⏳");
		else if (failCount > 0) icon = theme.fg("warning", "◐");
		const status = isRunning
			? `${successCount + failCount}/${details.results.length} done, ${running} running, ${pending} pending`
			: `${successCount}/${details.results.length} tasks`;

		if (expanded && !isRunning) {
			const container = new Container();
			container.addChild(
				new Text(`${icon} ${theme.fg("toolTitle", theme.bold("parallel "))}${theme.fg("accent", status)}`, 0, 0),
			);

			for (const r of details.results) {
				const rIcon = resultIcon(r.status, isFailedResult(r), theme);
				const displayItems = getDisplayItems(r.messages);
				const finalOutput = getFinalOutput(r.messages);

				container.addChild(new Spacer(1));
				container.addChild(new Text(`${theme.fg("muted", "─── ") + theme.fg("accent", r.agent)} ${rIcon}`, 0, 0));
				container.addChild(new Text(theme.fg("muted", "Task: ") + theme.fg("dim", r.task), 0, 0));
				if (isFailedResult(r) && r.errorMessage)
					container.addChild(new Text(theme.fg("error", `Error: ${r.errorMessage}`), 0, 0));
				if (r.terminationSignal) container.addChild(new Text(theme.fg("error", `Signal: ${r.terminationSignal}`), 0, 0));
				if (r.stderr.trim()) container.addChild(new Text(theme.fg("error", `stderr: ${r.stderr.trim()}`), 0, 0));

				for (const item of displayItems) {
					if (item.type === "toolCall") {
						container.addChild(
							new Text(theme.fg("muted", "→ ") + formatToolCall(item.name, item.args, theme.fg.bind(theme)), 0, 0),
						);
					}
				}

				if (finalOutput) {
					container.addChild(new Spacer(1));
					container.addChild(new Markdown(finalOutput.trim(), 0, 0, mdTheme));
				}

				const taskUsage = formatUsageStats(r.usage, r.model);
				if (taskUsage) container.addChild(new Text(theme.fg("dim", taskUsage), 0, 0));
			}

			const usageStr = formatUsageStats(aggregateUsage(details.results));
			if (usageStr) {
				container.addChild(new Spacer(1));
				container.addChild(new Text(theme.fg("dim", `Total: ${usageStr}`), 0, 0));
			}
			return container;
		}

		// Collapsed view (or still running)
		let text = `${icon} ${theme.fg("toolTitle", theme.bold("parallel "))}${theme.fg("accent", status)}`;
		for (const r of details.results) {
			const rIcon = resultIcon(r.status, isFailedResult(r), theme);
			const displayItems = getDisplayItems(r.messages);
			text += `\n\n${theme.fg("muted", "─── ")}${theme.fg("accent", r.agent)} ${rIcon}`;
			if (displayItems.length === 0) {
				const failed = isFailedResult(r);
				let summary = "(no output)";
				if (r.status === "pending") summary = "(pending...)";
				else if (r.status === "running") summary = "(running...)";
				else if (failed) summary = getFailureSummary(r);
				text += `\n${theme.fg(failed ? "error" : "muted", summary)}`;
			} else {
				text += `\n${renderDisplayItems(displayItems, 5)}`;
			}
		}
		if (!isRunning) {
			const usageStr = formatUsageStats(aggregateUsage(details.results));
			if (usageStr) text += `\n\n${theme.fg("dim", `Total: ${usageStr}`)}`;
		}
		if (!expanded) text += `\n${theme.fg("muted", "(Ctrl+O to expand)")}`;
		return new Text(text, 0, 0);
	}

	const text = result.content[0];
	return new Text(text?.type === "text" ? text.text : "(no output)", 0, 0);
}
