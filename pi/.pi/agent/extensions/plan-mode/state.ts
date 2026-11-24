/**
 * Session state and path/slug helpers for plan mode.
 *
 * Module-level state only: plan mode does not persist across restarts.
 * The one session-scoped exception is `everEnabled`/`lastApprovedPath`,
 * which survive an exit so a re-entry can reference an approved plan.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { CONFIG_DIR_NAME } from "@earendil-works/pi-coding-agent";

export type InterviewMode = "omp" | "grilling" | "grill-with-docs";

export interface PlanModeState {
	enabled: boolean;
	/** Known `.pi/plans/<slug>-plan.md` (absolute); undefined until a plan is found or proposed. */
	planFilePath: string | undefined;
	slug: string | undefined;
	interviewMode: InterviewMode;
	/** The forced entry ask was answered (or there was none to ask). */
	interviewSettled: boolean;
	/** Entry ask is still pending; inject the mode-choice section until it fires. */
	awaitingInterviewChoice: boolean;
	/** User skipped the interview with a custom answer. */
	skipInterview: boolean;
	/** This entry follows an earlier plan-mode session in this conversation. */
	reentry: boolean;
	/** grill-with-docs staged ADRs/glossary; the approved plan must file them first. */
	docsStaged: boolean;
	/** Active tool names snapshotted at entry, restored on exit. */
	toolsBefore: string[] | undefined;
}

/** Survives exit so the next entry knows it is a re-entry and can reference the approved plan. */
let everEnabled = false;
let lastApprovedPath: string | undefined;

export const state: PlanModeState = {
	enabled: false,
	planFilePath: undefined,
	slug: undefined,
	interviewMode: "omp",
	interviewSettled: false,
	awaitingInterviewChoice: false,
	skipInterview: false,
	reentry: false,
	docsStaged: false,
	toolsBefore: undefined,
};

export function resetState(): void {
	state.enabled = false;
	state.planFilePath = undefined;
	state.slug = undefined;
	state.interviewMode = "omp";
	state.interviewSettled = false;
	state.awaitingInterviewChoice = false;
	state.skipInterview = false;
	state.reentry = false;
	state.docsStaged = false;
	state.toolsBefore = undefined;
}

export function beginEntry(): void {
	state.reentry = everEnabled;
	state.enabled = true;
	state.interviewSettled = false;
	state.awaitingInterviewChoice = false;
	state.interviewMode = "omp";
	state.skipInterview = false;
	state.docsStaged = false;
	state.slug = undefined;
	state.planFilePath = undefined;
}

export function markExited(): void {
	everEnabled = true;
}

export function setApprovedPlan(planFilePath: string): void {
	lastApprovedPath = planFilePath;
}

export function getApprovedPlanPath(): string | undefined {
	return lastApprovedPath;
}

export function plansDir(cwd: string): string {
	return path.join(cwd, CONFIG_DIR_NAME, "plans");
}

export function planFileForSlug(cwd: string, slug: string): string {
	return path.join(plansDir(cwd), `${slug}-plan.md`);
}

/** cwd-relative spelling of a plan path, as prompts and dialogs show it. */
export function relPlanPath(cwd: string, filePath: string): string {
	const rel = filePath.startsWith(cwd) ? filePath.slice(cwd.length + 1) : filePath;
	return rel || filePath;
}

/**
 * Port of OMP's normalizePlanTitle: spaces → hyphens, everything outside
 * letters/numbers/underscore/hyphen dropped, collapses runs of hyphens.
 * Rejects empty titles and path-separator/`..` tricks outright.
 */
export function normalizeSlug(raw: string): { slug: string } | { error: string } {
	const trimmed = raw.trim();
	if (!trimmed) return { error: "Slug is required and must not be empty." };
	if (trimmed.includes("/") || trimmed.includes("\\") || trimmed.includes("..")) {
		return { error: "Slug must not contain path separators or '..'." };
	}
	const withoutExt = trimmed.replace(/\.md$/i, "");
	const sanitized = withoutExt
		.replace(/\s+/g, "-")
		.replace(/[^A-Za-z0-9_-]/g, "")
		.replace(/-{2,}/g, "-")
		.replace(/^-+|-+$/g, "");
	if (!sanitized) {
		return { error: "Slug must contain at least one letter, number, underscore, or hyphen after sanitization." };
	}
	// A trailing "-plan" is redundant: the file is always <slug>-plan.md (OMP's planSlugFromSupplied).
	return { slug: sanitized.replace(/-plan$/i, "") };
}

/** Newest `*-plan.md` under .pi/plans/, or undefined when none exist yet. */
export function findNewestPlan(cwd: string): string | undefined {
	const dir = plansDir(cwd);
	let best: { file: string; mtime: number } | undefined;
	try {
		for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
			if (!entry.isFile() || !/plan\.md$/i.test(entry.name)) continue;
			const mtime = fs.statSync(path.join(dir, entry.name)).mtimeMs;
			if (!best || mtime > best.mtime) best = { file: path.join(dir, entry.name), mtime };
		}
	} catch {
		return undefined; // no dir yet — nothing to reference
	}
	return best?.file;
}

/** Create .pi/plans/ on demand; failure is non-fatal (the write tool may create it anyway). */
export function ensurePlansDir(cwd: string): void {
	try {
		fs.mkdirSync(plansDir(cwd), { recursive: true });
	} catch {
		// Directory creation races with the agent's own write; the prompt retries.
	}
}

export function isGitRepo(cwd: string): boolean {
	return fs.existsSync(path.join(cwd, ".git"));
}

export interface SkillAvailability {
	grilling: boolean;
	domainModeling: boolean;
}

/**
 * Disk probe for the interview skills. Pi exposes loaded skills per-run in
 * systemPromptOptions.skills, but skills load on demand so that list would give
 * false negatives at entry; probing the skill roots on disk is the reliable check.
 */
export function probeSkills(cwd: string): SkillAvailability {
	const roots = [path.join(cwd, ".agents", "skills"), path.join(os.homedir(), ".agents", "skills")];
	const has = (name: string) => roots.some((root) => fs.existsSync(path.join(root, name, "SKILL.md")));
	return { grilling: has("grilling"), domainModeling: has("domain-modeling") };
}
