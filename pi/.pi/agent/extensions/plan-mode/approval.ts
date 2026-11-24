/**
 * The propose_plan review flow: approval dialog, refine feedback, save copy.
 *
 * Degrades without UI (print/json modes): auto-approve with context kept.
 * "Approve and compact context" is only offered when ctx.compact() exists;
 * it is never faked.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { executionPrompt } from "./prompts.ts";
import { planReviewOverlay, type ReviewOverlayChoice, type ReviewPick } from "./review-overlay.ts";
import { relPlanPath, state } from "./state.ts";

export interface ReviewRequest {
	pi: ExtensionAPI;
	ctx: ExtensionContext;
	cwd: string;
	slug: string;
	planFilePath: string;
	planContent: string;
	hasTodoTool: boolean;
	/** Exit plan mode: restore tools, clear state. Called only on approval paths. */
	onApprove: () => void;
}

export interface ReviewOutcome {
	text: string;
	isError?: boolean;
	choice?: string;
}

const KEEP = "Approve and keep context";
const COMPACT = "Approve and compact context";
const REFINE = "Refine plan";
const SAVE = "Save";

/** Overlay choice rows: ids map one-to-one onto the outcome handlers. */
function overlayChoices(hasCompact: boolean): ReviewOverlayChoice[] {
	const choices: ReviewOverlayChoice[] = [
		{ id: "keep", label: KEEP, detail: "Approve and stay in this session — full context kept" },
	];
	if (hasCompact) choices.push({ id: "compact", label: COMPACT, detail: "Summarize this conversation, then execute" });
	choices.push(
		{ id: "refine", label: REFINE, detail: "Give feedback; the plan updates and re-proposes" },
		{ id: "save", label: SAVE, detail: "Copy the plan file elsewhere; review stays open" },
	);
	return choices;
}

export async function reviewPlan(request: ReviewRequest): Promise<ReviewOutcome> {
	if (!request.ctx.hasUI) return autoApprove(request);

	const choices = overlayChoices(typeof request.ctx.compact === "function");

	let picked: ReviewPick;
	if (request.ctx.mode === "tui") {
		picked = await request.ctx.ui.custom<ReviewPick>(
			planReviewOverlay({ slug: request.slug, planContent: request.planContent, choices }),
			{
				overlay: true,
				// Right half of the terminal; the left half keeps the live main screen.
				overlayOptions: { width: "50%", col: "100%", row: 0, margin: 0 },
			},
		);
	} else {
		const label = await request.ctx.ui.select("Plan review — next step?", choices.map((row) => row.label));
		picked = label === undefined ? null : (choices.find((row) => row.label === label)?.id ?? null);
	}

	if (picked === null) {
		return { text: "Review dismissed; still in plan mode. Refine the plan and call propose_plan again.", choice: "dismissed" };
	}
	if (picked === "keep") return approveKeep(request);
	if (picked === "compact") return approveCompact(request);
	if (picked === "refine") return refine(request);
	return save(request);
}

/** No dialogs in print/json mode: approve with context kept and inject the execution prompt. */
function autoApprove(request: ReviewRequest): ReviewOutcome {
	const docsStaged = state.docsStaged;
	request.onApprove();
	request.pi.sendMessage(
		{ customType: "plan-mode-approved", content: execution(request, docsStaged, true), display: false },
		{ deliverAs: "steer" },
	);
	return {
		text: `No UI available in ${request.ctx.mode} mode: plan auto-approved with context kept. Plan mode exited; the read-only rules are lifted and full tools restored. Execute the approved plan per the message that follows.`,
		choice: "auto-keep",
	};
}

function approveKeep(request: ReviewRequest): ReviewOutcome {
	const docsStaged = state.docsStaged;
	request.onApprove();
	request.pi.sendMessage(
		{ customType: "plan-mode-approved", content: execution(request, docsStaged, true), display: true },
		{ deliverAs: "steer" },
	);
	return {
		text: `Plan approved (context kept). Plan mode exited; the read-only rules are lifted and full tools restored. Execute the approved plan per the message that follows.`,
		choice: "keep",
	};
}

function approveCompact(request: ReviewRequest): ReviewOutcome {
	const docsStaged = state.docsStaged;
	request.onApprove();
	const rel = relPlanPath(request.cwd, request.planFilePath);
	request.ctx.compact({
		customInstructions: `Compaction before executing the approved plan. The approved plan is durable at ${rel}; the approved-plan message inlines it in full — preserve the plan, its steps, and any staged-doc instructions verbatim.`,
		onComplete: () => sendExecution(request, docsStaged, false),
		onError: () => sendExecution(request, docsStaged, true),
	});
	return {
		text: `Plan approved (context will be compacted). Plan mode exited; full tools restored. The approved plan executes after compaction.`,
		choice: "compact",
	};
}

async function refine(request: ReviewRequest): Promise<ReviewOutcome> {
	const feedback = request.ctx.hasUI ? await request.ctx.ui.editor("Refine the plan:", "") : undefined;
	if (!feedback?.trim()) {
		return { text: "Refinement cancelled; still in plan mode. Call propose_plan again when the plan is ready.", choice: "refine-cancelled" };
	}
	request.pi.sendUserMessage(feedback.trim(), { deliverAs: "steer" });
	return {
		text: "Refinement submitted as a user message. Still in plan mode: update the plan per the feedback, then call propose_plan again.",
		choice: "refine",
	};
}

async function save(request: ReviewRequest): Promise<ReviewOutcome> {
	const suggested = path.join(path.dirname(request.planFilePath), `${request.slug}-plan-saved.md`);
	const typed = await request.ctx.ui.input("Save plan to path:", suggested);
	if (typed === undefined) {
		return { text: "Save cancelled; still in plan mode. Call propose_plan again to re-open the review.", choice: "save-cancelled" };
	}
	const target = typed.trim() ? path.resolve(request.cwd, typed.trim()) : suggested;
	try {
		fs.mkdirSync(path.dirname(target), { recursive: true });
		fs.copyFileSync(request.planFilePath, target);
	} catch (error) {
		return {
			text: `Failed to save plan to ${target}: ${error instanceof Error ? error.message : String(error)}`,
			isError: true,
			choice: "save-failed",
		};
	}
	return { text: `Plan saved to ${target}. Still in plan mode — the review stays open; refine or call propose_plan again.`, choice: "save" };
}

function sendExecution(request: ReviewRequest, docsStaged: boolean, contextPreserved: boolean): void {
	request.pi.sendMessage(
		{ customType: "plan-mode-approved", content: execution(request, docsStaged, contextPreserved), display: true },
		{ triggerTurn: true, deliverAs: "followUp" },
	);
}

function execution(request: ReviewRequest, docsStaged: boolean, contextPreserved: boolean): string {
	return executionPrompt({
		cwd: request.cwd,
		planFilePath: request.planFilePath,
		planContent: request.planContent,
		contextPreserved,
		hasTodoTool: request.hasTodoTool,
		docsStaged,
		slug: request.slug,
	});
}
