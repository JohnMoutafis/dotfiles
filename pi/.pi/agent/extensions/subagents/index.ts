/**
 * subagents — delegate assignments to `task` and `worker` subagents.
 *
 * Every subagent runs as a separate `pi` process with an isolated context
 * window (see spawn.ts). Agent definitions are markdown files: bundled in
 * this extension's `agents/` directory, overridable per name in
 * ~/.pi/agent/agents.
 *
 * Spawn rules (enforced with PI_SUBAGENT_ROLE, set on each child process):
 *   - a normal session: any discovered agent, default `task`;
 *   - a worker child: `task` only;
 *   - a task child (or any other child): the tool is not registered.
 */

import * as path from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { type AgentConfig, discoverAgents, formatAgentList } from "./agents.ts";
import { renderCall, renderResult } from "./render.ts";
import { type WidgetState, updateWidget } from "./widget.ts";
import { getConcurrency } from "./settings.ts";
import {
	type DispatchDefaults,
	type SingleResult,
	type SubagentDetails,
	ROLE_ENV,
	emptyUsage,
	getFinalOutput,
	getResultOutput,
	isFailedResult,
	mapWithConcurrencyLimit,
	runSingleAgent,
	truncateModelOutput,
	truncateParallelOutput,
} from "./spawn.ts";

const MAX_PARALLEL_TASKS = 8;
const DEFAULT_AGENT = "task";
// Shared live-widget state: one entry per in-flight subagent dispatch, keyed by tool call id.
const widgetState: WidgetState = { active: new Map() };

const TaskItem = Type.Object({
	agent: Type.Optional(Type.String({ description: 'Name of the agent to invoke. Default: "task".' })),
	task: Type.String({ description: "Assignment to delegate to the agent" }),
});

const SubagentParams = Type.Object({
	agent: Type.Optional(Type.String({ description: 'Name of the agent to invoke (single mode). Default: "task".' })),
	task: Type.Optional(Type.String({ description: "Assignment to delegate (single mode)" })),
	tasks: Type.Optional(Type.Array(TaskItem, { description: "Assignments for parallel execution (single mode is not allowed together with this)" })),
	cwd: Type.Optional(Type.String({ description: "Working directory for the agent process (single mode)" })),
});

export default function (pi: ExtensionAPI) {
	const role = process.env[ROLE_ENV];
	const isWorkerChild = role === "worker";
	// A task child (or any other subagent child) spawns nothing.
	if (role && !isWorkerChild) return;

	// Tool execute results cannot set runtime error state directly, so patch it through the result hook.
	pi.on("tool_result", (event) => {
		if (event.toolName !== "subagent") return;
		const details = event.details as SubagentDetails | undefined;
		if (details?.isError) return { isError: true };
	});

	const agents = discoverAgents();
	const availableText = formatAgentList(agents, 10);

	pi.registerTool({
		name: "subagent",
		label: "Subagent",
		description: [
			"Delegate an assignment to a subagent that runs in an isolated context window.",
			`Default agent is "task": it does one assignment directly and returns.`,
			`"worker" plans the assignment into a TODO, delegates independent items to task subagents, verifies their results, and finishes dependent items itself.`,
			"Pass `tasks` (an array) to run several assignments in parallel.",
			`Available agents: ${availableText}${availableText.remaining > 0 ? ` (+${availableText.remaining} more)` : ""}`,
			isWorkerChild ? "You are a worker subagent: you may only spawn the task agent." : "",
		]
			.filter(Boolean)
			.join(" "),
		parameters: SubagentParams,

		async execute(_toolCallId, params, signal, onUpdate, ctx) {
			const dispatchDefaults: DispatchDefaults = {
				model: ctx.model ? `${ctx.model.provider}/${ctx.model.id}` : undefined,
				thinkingLevel: ctx.thinkingLevel,
			};
			const concurrency = getConcurrency(pi);

			const makeDetails =
				(mode: "single" | "parallel", forceError = false) =>
				(results: SingleResult[]): SubagentDetails => ({
					mode,
					results,
					isError: forceError || results.some(isFailedResult),
				});

			const hasTasks = (params.tasks?.length ?? 0) > 0;
			const hasSingle = Boolean(params.task);
			if (Number(hasTasks) + Number(hasSingle) !== 1) {
				return {
					content: [
						{ type: "text", text: `Invalid parameters. Provide exactly one mode: "task" or "tasks".\nAvailable agents: ${formatAgentList(agents, 20).text}` },
					],
					details: makeDetails("single", true)([]),
				};
			}

			const requestedAgent = (name: string | undefined) => name ?? DEFAULT_AGENT;
			if (isWorkerChild) {
				const offenders = hasTasks
					? params.tasks!.filter((t) => requestedAgent(t.agent) !== DEFAULT_AGENT)
					: requestedAgent(params.agent) !== DEFAULT_AGENT
						? [params.agent!]
						: [];
				if (offenders.length > 0) {
					return {
						content: [
							{
								type: "text",
								text: `A worker subagent may only spawn the "${DEFAULT_AGENT}" agent. Offending request(s): ${offenders.map((o) => `"${o}"`).join(", ")}.`,
							},
						],
						details: makeDetails(hasTasks ? "parallel" : "single", true)([]),
					};
				}
			}

			const findAgent = (name: string): AgentConfig | undefined => agents.find((a) => a.name === name);

			if (hasSingle) {
				const agentName = requestedAgent(params.agent);
				const effectiveCwd = path.resolve(ctx.cwd, params.cwd ?? ".");
				widgetState.active.set(_toolCallId, {
					label: isWorkerChild ? "worker" : agentName,
					results: [],
					startedAt: Date.now(),
				});
				updateWidget(ctx, widgetState);
				try {
					const result = await runSingleAgent(
						dispatchDefaults,
						findAgent(agentName),
						agents,
						agentName,
						params.task!,
						effectiveCwd,
						signal,
						(partial) => {
							onUpdate?.(partial);
							const single = partial.details?.results[0];
							const dispatch = widgetState.active.get(_toolCallId);
							if (single && dispatch) {
								dispatch.results = [single];
								updateWidget(ctx, widgetState);
							}
						},
						makeDetails("single"),
					);
					if (isFailedResult(result)) {
						return {
							content: [
								{
									type: "text",
									text: truncateModelOutput(`Agent ${result.stopReason || result.status}: ${getResultOutput(result)}`),
								},
							],
							details: makeDetails("single")([result]),
						};
					}
					return {
						content: [
							{ type: "text", text: truncateModelOutput(getFinalOutput(result.messages) || "(no output)") },
						],
						details: makeDetails("single")([result]),
					};
				} finally {
					widgetState.active.delete(_toolCallId);
					updateWidget(ctx, widgetState);
				}
			}

			// Parallel mode
			if (params.tasks!.length > MAX_PARALLEL_TASKS) {
				return {
					content: [
						{
							type: "text",
							text: `Too many parallel tasks (${params.tasks!.length}). Max is ${MAX_PARALLEL_TASKS}.`,
						},
					],
					details: makeDetails("parallel", true)([]),
				};
			}

			const allResults: SingleResult[] = params.tasks!.map((t) => ({
				agent: requestedAgent(t.agent),
				agentSource: "unknown",
				task: t.task,
				status: "pending",
				exitCode: null,
				messages: [],
				stderr: "",
				usage: emptyUsage(),
			}));

			widgetState.active.set(_toolCallId, {
				label: `parallel (${params.tasks!.length})`,
				results: [...allResults],
				startedAt: Date.now(),
			});
			updateWidget(ctx, widgetState);

			const emitParallelUpdate = () => {
				const dispatch = widgetState.active.get(_toolCallId);
				if (dispatch) {
					dispatch.results = [...allResults];
					updateWidget(ctx, widgetState);
				}
				if (!onUpdate) return;
				const running = allResults.filter((result) => result.status === "running").length;
				const pending = allResults.filter((result) => result.status === "pending").length;
				const done = allResults.length - running - pending;
				onUpdate({
					content: [
						{
							type: "text",
							text: `Parallel: ${done}/${allResults.length} done, ${running} running, ${pending} pending...`,
						},
					],
					details: makeDetails("parallel")([...allResults]),
				});
			};

			let results: SingleResult[];
			try {
				results = await mapWithConcurrencyLimit(params.tasks!, concurrency, async (t, index) => {
					const name = requestedAgent(t.agent);
					const result = await runSingleAgent(
						dispatchDefaults,
						findAgent(name),
						agents,
						name,
						t.task,
						ctx.cwd,
						signal,
						(partial) => {
							if (partial.details?.results[0]) {
								allResults[index] = partial.details.results[0];
								emitParallelUpdate();
							}
						},
						makeDetails("parallel"),
					);
					allResults[index] = result;
					emitParallelUpdate();
					return result;
				});
			} finally {
				widgetState.active.delete(_toolCallId);
				updateWidget(ctx, widgetState);
			}

			const successCount = results.filter((r) => !isFailedResult(r)).length;
			const summaries = results.map((r) => {
				const output = truncateParallelOutput(getResultOutput(r));
				const status =
					isFailedResult(r) && r.stopReason && r.stopReason !== "end" ? `${r.status} (${r.stopReason})` : r.status;
				return `### [${r.agent}] ${status}\n\n${output}`;
			});
			return {
				content: [
					{
						type: "text",
						text: `Parallel: ${successCount}/${results.length} succeeded\n\n${summaries.join("\n\n---\n\n")}`,
					},
				],
				details: makeDetails("parallel")(results),
			};
		},

		renderCall,
		renderResult,
	});
}
