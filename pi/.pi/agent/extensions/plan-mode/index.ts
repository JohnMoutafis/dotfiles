/**
 * plan-mode — read-only planning with an approval gate, ported from
 * oh-my-pi's plan mode.
 *
 * /plan toggles: snapshot tools, restrict to the read-only-plus-plan set,
 * inject the planning-contract prompt section (interview variants: OMP,
 * grilling, grill-with-docs). propose_plan submits the plan for review
 * (approve keep/compact, refine, save). Approval restores the snapshot and
 * injects the approved-plan execution prompt. A turn that ends without an
 * ask/propose call gets one rate-limited reminder.
 */

import * as fs from "node:fs";
import type { ExtensionAPI, ExtensionCommandContext, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { reviewPlan } from "./approval.ts";
import { interviewChoicePrompt, planningContract, referencePrompt, reminderPrompt } from "./prompts.ts";
import {
	beginEntry,
	ensurePlansDir,
	findNewestPlan,
	getApprovedPlanPath,
	isGitRepo,
	markExited,
	normalizeSlug,
	planFileForSlug,
	probeSkills,
	relPlanPath,
	resetState,
	setApprovedPlan,
	state,
	type SkillAvailability,
} from "./state.ts";

const ASK_TOOL = "ask_user_question";
const PROPOSE_TOOL = "propose_plan";
/** Read-only core plus the plan-drafting pair; everything else drops on entry. */
const PLAN_MODE_TOOLS = new Set([
	"read",
	"grep",
	"find",
	"ls",
	"bash",
	"powershell",
	"write",
	"edit",
	ASK_TOOL,
	"subagent",
	PROPOSE_TOOL,
]);

export default function planModeExtension(pi: ExtensionAPI): void {
	// Re-probed at each entry (cwd is per-session); cached between turns.
	let skills: SkillAvailability = { grilling: false, domainModeling: false };

	// Turn tracking for the turn-end reminder. `reminderLatch` blocks a second
	// consecutive reminder unless some tool call (progress) happened since.
	let sawRequiredCall = false;
	let reminderLatch = false;

	function enter(ctx: ExtensionCommandContext): void {
		const cwd = ctx.cwd;
		skills = probeSkills(cwd);
		beginEntry();
		state.toolsBefore = pi.getActiveTools();
		state.planFilePath = findNewestPlan(cwd);
		pi.setActiveTools([
			...new Set([...(state.toolsBefore ?? []).filter((name) => PLAN_MODE_TOOLS.has(name)), ...PLAN_MODE_TOOLS]),
		]);
		ensurePlansDir(cwd);

		const askAvailable = pi.getAllTools().some((tool) => tool.name === ASK_TOOL);
		if ((skills.grilling || skills.domainModeling) && askAvailable) {
			// interviewMode stays "omp" until the mode-choice ask is answered.
			state.awaitingInterviewChoice = true;
		} else {
			state.interviewSettled = true;
		}

		ctx.ui.setStatus("plan-mode", "⏸ plan");
		const gitNote = isGitRepo(cwd) ? " (consider adding `.pi/plans/` to .gitignore)" : "";
		pi.sendMessage({
			customType: "plan-mode-entered",
			content: `Plan mode active. State the task to plan.${gitNote}`,
			display: true,
		});
	}

	function exitPlanMode(ctx: ExtensionContext): void {
		pi.setActiveTools(state.toolsBefore ?? pi.getActiveTools());
		resetState();
		markExited();
		ctx.ui.setStatus("plan-mode", undefined);
	}

	pi.registerCommand("plan", {
		description: "Toggle plan mode (read-only planning with an approval gate)",
		handler: async (_args, ctx) => {
			if (state.enabled) {
				exitPlanMode(ctx);
				ctx.ui.notify("Plan mode off. Full tools restored.", "info");
			} else {
				enter(ctx);
			}
		},
	});

	pi.registerCommand("plan-off", {
		description: "Exit plan mode (safe when not active)",
		handler: async (_args, ctx) => {
			if (state.enabled) {
				exitPlanMode(ctx);
				ctx.ui.notify("Plan mode off. Full tools restored.", "info");
			} else {
				ctx.ui.notify("Plan mode is not active.", "info");
			}
		},
	});

	// Planning contract as a diffable prompt section; keyed off state so an
	// exit drops it from the next run's prompt automatically.
	pi.on("before_agent_start", async (event) => {
		if (!state.enabled) return;
		const cwd = event.systemPromptOptions.cwd ?? "";
		event.systemPromptOptions.sections.plan_mode = planningContract({
			cwd,
			planFilePath: state.planFilePath,
			planExists: Boolean(state.planFilePath && fs.existsSync(state.planFilePath)),
			reentry: state.reentry,
			interviewMode: state.interviewMode,
			skipInterview: state.skipInterview,
			skills,
		});
		if (state.awaitingInterviewChoice) {
			event.systemPromptOptions.sections.plan_mode_interview = interviewChoicePrompt(skills);
		}
		if (state.reentry) {
			const approvedPath = getApprovedPlanPath();
			if (approvedPath && fs.existsSync(approvedPath)) {
				event.systemPromptOptions.sections.plan_mode_reference = referencePrompt(
					cwd,
					approvedPath,
					fs.readFileSync(approvedPath, "utf8"),
				);
			}
		}
	});

	// Track tool activity for the turn-end reminder; any call counts as progress.
	pi.on("tool_call", async (event) => {
		reminderLatch = false;
		if (event.toolName === ASK_TOOL || event.toolName === PROPOSE_TOOL) {
			sawRequiredCall = true;
		}
	});

	pi.on("turn_start", async () => {
		sawRequiredCall = false;
	});

	// Capture the interview-mode choice from the first ask round.
	pi.on("tool_result", async (event) => {
		if (event.toolName !== ASK_TOOL || !state.enabled || !state.awaitingInterviewChoice) return;
		const details = event.details as { cancelled?: boolean; answers?: Array<{ answer?: string | null }> } | undefined;
		const label = (details?.answers?.[0]?.answer ?? "").toLowerCase();
		state.awaitingInterviewChoice = false;
		state.interviewSettled = true;
		if (!label && details?.cancelled) {
			state.interviewMode = "omp"; // declined → OMP default interview
			return;
		}
		if (label.includes("docs") && skills.grilling && skills.domainModeling) {
			state.interviewMode = "grill-with-docs";
			state.docsStaged = true;
		} else if (label.includes("grill")) {
			state.interviewMode = "grilling";
		} else if (label.includes("standard")) {
			state.interviewMode = "omp";
		} else {
			state.interviewMode = "omp";
			state.skipInterview = true;
		}
	});

	// One reminder per stalled turn; latched so two consecutive dead turns
	// (no ask, no propose, no tool call at all) only get one.
	pi.on("turn_end", async (event) => {
		if (!state.enabled || event.outcome !== "completed" || sawRequiredCall) return;
		if (reminderLatch) return;
		reminderLatch = true;
		const interviewRoundPending = state.interviewSettled && state.interviewMode !== "omp";
		return {
			entries: [
				...event.entries,
				{
					type: "custom_message" as const,
					customType: "plan-mode-reminder",
					content: reminderPrompt(interviewRoundPending),
					display: false,
				},
			],
			continue: true,
		};
	});

	pi.registerTool({
		name: PROPOSE_TOOL,
		label: "Propose Plan",
		description:
			"Submit the plan at .pi/plans/<slug>-plan.md for user review. Only valid in plan mode. The user chooses: approve (keep or compact context), refine, or save; approval exits plan mode and restores full tools.",
		defaultActive: false,
		parameters: Type.Object({
			slug: Type.String({
				description: "The <slug> matching .pi/plans/<slug>-plan.md — letters, numbers, underscores, hyphens.",
			}),
		}),

		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			if (!state.enabled) {
				return {
					content: [{ type: "text" as const, text: "Plan mode is not active. Run /plan first." }],
					details: { choice: "not-active" },
				};
			}
			const normalized = normalizeSlug(String(params.slug ?? ""));
			if ("error" in normalized) {
				return {
					content: [{ type: "text" as const, text: normalized.error }],
					details: { choice: "bad-slug" },
				};
			}
			const planFilePath = planFileForSlug(ctx.cwd, normalized.slug);
			let planContent: string;
			try {
				planContent = await fs.promises.readFile(planFilePath, "utf8");
			} catch {
				return {
					content: [
						{
							type: "text" as const,
							text: `No plan file at ${relPlanPath(ctx.cwd, planFilePath)} — write the plan first.`,
						},
					],
					details: { choice: "missing-plan" },
				};
			}
			state.slug = normalized.slug;
			state.planFilePath = planFilePath;
			setApprovedPlan(planFilePath); // remembered for re-entry reference after approval

			const outcome = await reviewPlan({
				pi,
				ctx,
				cwd: ctx.cwd,
				slug: normalized.slug,
				planFilePath,
				planContent,
				hasTodoTool: pi.getAllTools().some((tool) => tool.name === "todo"),
				onApprove: () => exitPlanMode(ctx),
			});
			return {
				content: [{ type: "text" as const, text: outcome.text }],
				...(outcome.isError ? { isError: true } : {}),
				details: { choice: outcome.choice },
			};
		},
	});
}
