/**
 * Child-process launch for the subagents extension.
 *
 * Each subagent runs as a separate `pi` process (`--mode json -p --no-session`)
 * with an isolated context window. The parent sets PI_SUBAGENT_ROLE to the
 * agent's name; the extension running inside the child reads it to enforce the
 * spawn rules (worker -> task only, task -> nothing).
 */

import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { AgentToolResult, ThinkingLevel } from "@earendil-works/pi-agent-core";
import type { Message } from "@earendil-works/pi-ai";
import {
	DEFAULT_MAX_BYTES,
	DEFAULT_MAX_LINES,
	type JsonAgentSessionEvent,
	truncateHead,
	withFileMutationQueue,
} from "@earendil-works/pi-coding-agent";
import type { AgentConfig } from "./agents.ts";

export const ROLE_ENV = "PI_SUBAGENT_ROLE";

const PER_TASK_OUTPUT_CAP = 50 * 1024;
const TRUNCATION_NOTICE_RESERVE = 256;

export interface UsageStats {
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
	cost: number;
	contextTokens: number;
	turns: number;
}

type ChildStatus = "pending" | "running" | "completed" | "failed" | "aborted";

export interface SingleResult {
	agent: string;
	agentSource: "bundled" | "user" | "unknown";
	task: string;
	status: ChildStatus;
	exitCode: number | null;
	messages: Message[];
	stderr: string;
	usage: UsageStats;
	model?: string;
	stopReason?: string;
	errorMessage?: string;
	terminationSignal?: NodeJS.Signals;
}

export interface SubagentDetails {
	mode: "single" | "parallel";
	results: SingleResult[];
	isError: boolean;
}

export interface DispatchDefaults {
	model?: string;
	thinkingLevel?: ThinkingLevel;
}

interface ProcessOutcome {
	code: number | null;
	signal: NodeJS.Signals | null;
	spawnError?: Error;
}

export type OnUpdateCallback = (partial: AgentToolResult<SubagentDetails>) => void;

export function emptyUsage(): UsageStats {
	return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, contextTokens: 0, turns: 0 };
}

export function getFinalOutput(messages: Message[]): string {
	for (let i = messages.length - 1; i >= 0; i--) {
		const msg = messages[i];
		if (msg.role === "assistant") {
			for (const part of msg.content) {
				if (part.type === "text") return part.text;
			}
		}
	}
	return "";
}

export function isFailedResult(result: SingleResult): boolean {
	return result.status === "failed" || result.status === "aborted";
}

export function getFailureEvidence(result: SingleResult): string {
	const evidence: string[] = [];
	const seen = new Set<string>();
	const add = (label: string, value: string | undefined) => {
		const text = value?.trim();
		if (!text || seen.has(text)) return;
		seen.add(text);
		evidence.push(`${label}: ${text}`);
	};

	add("Error", result.errorMessage);
	add("Signal", result.terminationSignal);
	add("stderr", result.stderr);
	add("Assistant output", getFinalOutput(result.messages));
	return evidence.join("\n\n") || "(no output)";
}

export function getFailureSummary(result: SingleResult): string {
	return (
		result.errorMessage?.trim() ||
		(result.terminationSignal ? `Terminated by signal ${result.terminationSignal}` : "") ||
		result.stderr.trim() ||
		getFinalOutput(result.messages) ||
		"(no output)"
	);
}

export function getResultOutput(result: SingleResult): string {
	return isFailedResult(result) ? getFailureEvidence(result) : getFinalOutput(result.messages) || "(no output)";
}

export function truncateParallelOutput(output: string): string {
	const byteLength = Buffer.byteLength(output, "utf8");
	if (byteLength <= PER_TASK_OUTPUT_CAP) return output;

	let truncated = output.slice(0, PER_TASK_OUTPUT_CAP);
	while (Buffer.byteLength(truncated, "utf8") > PER_TASK_OUTPUT_CAP) {
		truncated = truncated.slice(0, -1);
	}
	return `${truncated}\n\n[Output truncated: ${byteLength - Buffer.byteLength(truncated, "utf8")} bytes omitted. Full output preserved in tool details.]`;
}

export function truncateModelOutput(output: string): string {
	const initial = truncateHead(output);
	if (!initial.truncated) return output;

	const body = truncateHead(output, {
		maxLines: DEFAULT_MAX_LINES - 2,
		maxBytes: DEFAULT_MAX_BYTES - TRUNCATION_NOTICE_RESERVE,
	});
	const omittedBytes = initial.totalBytes - body.outputBytes;
	const notice = `[Output truncated: ${omittedBytes} bytes omitted. Full output preserved in tool details.]`;
	return body.content ? `${body.content}\n\n${notice}` : notice;
}

export async function mapWithConcurrencyLimit<TIn, TOut>(
	items: TIn[],
	concurrency: number,
	fn: (item: TIn, index: number) => Promise<TOut>,
): Promise<TOut[]> {
	if (items.length === 0) return [];
	const limit = Math.max(1, Math.min(concurrency, items.length));
	const results: TOut[] = new Array(items.length);
	let nextIndex = 0;
	const workers = new Array(limit).fill(null).map(async () => {
		while (true) {
			const current = nextIndex++;
			if (current >= items.length) return;
			results[current] = await fn(items[current], current);
		}
	});
	await Promise.all(workers);
	return results;
}

async function writePromptToTempFile(agentName: string, prompt: string): Promise<{ dir: string; filePath: string }> {
	const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "pi-subagent-"));
	const safeName = agentName.replace(/[^\w.-]+/g, "_");
	const filePath = path.join(tmpDir, `prompt-${safeName}.md`);
	await withFileMutationQueue(filePath, async () => {
		await fs.promises.writeFile(filePath, prompt, { encoding: "utf-8", mode: 0o600 });
	});
	return { dir: tmpDir, filePath };
}

function getPiInvocation(args: string[]): { command: string; args: string[] } {
	const currentScript = process.argv[1];
	// Bun-compiled binaries report their embedded entry as argv[1]: "/$bunfs/root/..." on
	// POSIX and "B:/~BUN/root/..." on Windows. fs.existsSync() resolves these inside Bun.
	const isBunVirtualScript =
		currentScript !== undefined &&
		(currentScript.startsWith("/$bunfs/root/") || /^[A-Za-z]:[\\/]~BUN[\\/]root[\\/]/.test(currentScript));
	if (currentScript && !isBunVirtualScript && fs.existsSync(currentScript)) {
		return { command: process.execPath, args: [currentScript, ...args] };
	}

	const execName = path.basename(process.execPath).toLowerCase();
	const isGenericRuntime = /^(node|bun)(\.exe)?$/.test(execName);
	if (!isGenericRuntime) {
		return { command: process.execPath, args };
	}

	return { command: "pi", args };
}

function createUnstartedResult(
	agent: string,
	task: string,
	status: "aborted" | "failed",
	errorMessage?: string,
): SingleResult {
	return {
		agent,
		agentSource: "unknown",
		task,
		status,
		exitCode: null,
		messages: [],
		stderr: "",
		usage: emptyUsage(),
		errorMessage,
	};
}

/**
 * Run one subagent to completion. `agent` may be undefined: the caller passes
 * the discovered list so the failure message can name the alternatives.
 */
export async function runSingleAgent(
	dispatchDefaults: DispatchDefaults,
	agent: AgentConfig | undefined,
	available: AgentConfig[],
	agentName: string,
	task: string,
	effectiveCwd: string,
	signal: AbortSignal | undefined,
	onUpdate: OnUpdateCallback | undefined,
	makeDetails: (results: SingleResult[]) => SubagentDetails,
): Promise<SingleResult> {
	if (signal?.aborted) {
		return createUnstartedResult(agentName, task, "aborted", "Subagent was aborted before starting");
	}

	if (!agent) {
		const names = available.map((candidate) => `"${candidate.name}"`).join(", ") || "none";
		return createUnstartedResult(
			agentName,
			task,
			"failed",
			`Unknown agent: "${agentName}". Available agents: ${names}.`,
		);
	}

	const args: string[] = ["--mode", "json", "-p", "--no-session"];
	const inheritsDispatchConfig = !agent.model;
	const model = agent.model ?? dispatchDefaults.model;
	if (model) args.push("--model", model);
	if (agent.thinking) args.push("--thinking", agent.thinking);
	else if (inheritsDispatchConfig && dispatchDefaults.thinkingLevel) {
		args.push("--thinking", dispatchDefaults.thinkingLevel);
	}
	if (agent.tools && agent.tools.length > 0) args.push("--tools", agent.tools.join(","));

	let tmpPromptDir: string | null = null;
	let tmpPromptPath: string | null = null;
	const currentResult: SingleResult = {
		agent: agentName,
		agentSource: agent.source,
		task,
		status: "running",
		exitCode: null,
		messages: [],
		stderr: "",
		usage: emptyUsage(),
		model,
	};

	const emitUpdate = () => {
		onUpdate?.({
			content: [{ type: "text", text: getFinalOutput(currentResult.messages) || "(running...)" }],
			details: makeDetails([currentResult]),
		});
	};

	try {
		if (agent.systemPrompt.trim()) {
			const tmp = await writePromptToTempFile(agent.name, agent.systemPrompt);
			tmpPromptDir = tmp.dir;
			tmpPromptPath = tmp.filePath;
			args.push("--append-system-prompt", tmpPromptPath);
		}

		if (signal?.aborted) {
			currentResult.status = "aborted";
			currentResult.errorMessage = "Subagent was aborted before starting";
			return currentResult;
		}

		args.push(`Task: ${task}`);
		emitUpdate();
		let wasAborted = false;
		const outcome = await new Promise<ProcessOutcome>((resolve) => {
			const invocation = getPiInvocation(args);
			let settled = false;
			let exited = false;
			let closed = false;
			let killTimer: ReturnType<typeof setTimeout> | undefined;
			let buffer = "";

			const processLine = (line: string) => {
				if (!line.trim()) return;
				let event: JsonAgentSessionEvent;
				try {
					event = JSON.parse(line) as JsonAgentSessionEvent;
				} catch {
					return;
				}
				if (event.type !== "message_end") return;
				const eventMessage = event.message;
				if (
					eventMessage.role !== "user" &&
					eventMessage.role !== "assistant" &&
					eventMessage.role !== "toolResult"
				) {
					return;
				}
				const message = eventMessage as Message;
				currentResult.messages.push(message);
				if (message.role === "assistant") {
					currentResult.usage.turns++;
					currentResult.usage.input += message.usage.input;
					currentResult.usage.output += message.usage.output;
					currentResult.usage.cacheRead += message.usage.cacheRead;
					currentResult.usage.cacheWrite += message.usage.cacheWrite;
					currentResult.usage.cost += message.usage.cost.total;
					currentResult.usage.contextTokens = message.usage.totalTokens;
					if (!currentResult.model) currentResult.model = message.model;
					currentResult.stopReason = message.stopReason;
					currentResult.errorMessage = message.errorMessage;
				}
				emitUpdate();
			};

			let proc: ReturnType<typeof spawn>;
			const finish = (result: ProcessOutcome) => {
				if (settled) return;
				settled = true;
				closed = true;
				if (killTimer) clearTimeout(killTimer);
				if (signal) signal.removeEventListener("abort", abortProcess);
				resolve(result);
			};
			const abortProcess = () => {
				if (closed || exited || proc.exitCode !== null || proc.signalCode !== null) return;
				if (!proc.kill("SIGTERM")) return;
				wasAborted = true;
				killTimer = setTimeout(() => {
					if (!closed && !exited) proc.kill("SIGKILL");
				}, 5000);
			};

			try {
				proc = spawn(invocation.command, invocation.args, {
					cwd: effectiveCwd,
					shell: false,
					stdio: ["ignore", "pipe", "pipe"],
					env: { ...process.env, [ROLE_ENV]: agent.name },
				});
			} catch (error) {
				finish({
					code: null,
					signal: null,
					spawnError: error instanceof Error ? error : new Error(String(error)),
				});
				return;
			}

			proc.stdout?.on("data", (data) => {
				buffer += data.toString();
				const lines = buffer.split("\n");
				buffer = lines.pop() || "";
				for (const line of lines) processLine(line);
			});
			proc.stderr?.on("data", (data) => {
				currentResult.stderr += data.toString();
			});
			proc.on("exit", () => {
				exited = true;
			});
			proc.on("close", (code, terminationSignal) => {
				if (buffer.trim()) processLine(buffer);
				finish({ code, signal: terminationSignal });
			});
			proc.on("error", (error) => {
				finish({ code: null, signal: null, spawnError: error });
			});

			if (signal) {
				if (signal.aborted) abortProcess();
				else signal.addEventListener("abort", abortProcess, { once: true });
			}
		});

		currentResult.exitCode = outcome.code;
		currentResult.terminationSignal = outcome.signal ?? undefined;

		if (wasAborted) {
			currentResult.status = "aborted";
			currentResult.errorMessage ||= "Subagent was aborted";
		} else if (outcome.spawnError) {
			currentResult.status = "failed";
			currentResult.errorMessage = `Failed to spawn subagent: ${outcome.spawnError.message}`;
		} else if (outcome.signal) {
			currentResult.status = "failed";
			currentResult.errorMessage ||= `Subagent terminated by signal ${outcome.signal}`;
		} else if (outcome.code !== 0) {
			currentResult.status = "failed";
			currentResult.errorMessage ||= `Subagent exited with code ${outcome.code}`;
		} else if (currentResult.stopReason === "aborted") {
			currentResult.status = "aborted";
		} else if (currentResult.stopReason === "error") {
			currentResult.status = "failed";
		} else {
			currentResult.status = "completed";
		}
		return currentResult;
	} finally {
		if (tmpPromptPath) {
			try {
				fs.unlinkSync(tmpPromptPath);
			} catch {
				/* ignore */
			}
		}
		if (tmpPromptDir) {
			try {
				fs.rmdirSync(tmpPromptDir);
			} catch {
				/* ignore */
			}
		}
	}
}
