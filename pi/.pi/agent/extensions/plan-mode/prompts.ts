/**
 * Ported prompt text (oh-my-pi plan-mode prompts, adapted to pi).
 *
 * Substitutions from OMP: `local://<slug>-plan.md` → `.pi/plans/<slug>-plan.md`
 * (cwd-relative); `{{writeToolName}}`/`{{editToolName}}` → `write`/`edit`;
 * `{{askToolName}}` → `ask_user_question`; the `xd://propose` write transport →
 * calling the `propose_plan` tool. The hashline-edit-mode block and the
 * parallel/scout workflow block from OMP's active prompt are dropped (pi's
 * edit tool takes no heading locators; grilling is iterative).
 */

import { relPlanPath, type InterviewMode, type SkillAvailability } from "./state.ts";

export interface PlanningContractOptions {
	cwd: string;
	planFilePath?: string;
	planExists: boolean;
	reentry: boolean;
	interviewMode: InterviewMode;
	skipInterview: boolean;
	skills: SkillAvailability;
}

export function planningContract(options: PlanningContractOptions): string {
	const parts: string[] = [];

	parts.push(`<critical>
Plan mode active.
- Working tree/system read-only: NEVER create, edit, delete, or rename working-tree files; NEVER run state-changing commands (\`git commit\`, \`npm install\`, migrations) or otherwise change the system. The \`write\` and \`edit\` tools remain active ONLY for files under \`.pi/plans/**\` — the plan, staged ADRs, and glossary; every other path is off-limits.
- Canonical plan: MUST write \`.pi/plans/<slug>-plan.md\` (relative to the working directory).

Implementing: call the \`propose_plan\` tool with the slug (\`<slug>\` matching \`.pi/plans/<slug>-plan.md\`, allowed characters: letters, numbers, underscores, hyphens) when the plan is decision-complete. The user then selects an execution option; full write access is restored on approval.

NEVER ask the user to exit plan mode or request approval in prose or with \`ask_user_question\`; approval ONLY via \`propose_plan\`.
</critical>

## What a plan is

Plan: execution spec, not design doc. Approval may clear/compact the conversation; another engineer/fresh agent implements solely from the file. A competent implementer unfamiliar with the conversation MUST execute top-to-bottom with ZERO design decisions; the file contains every choice.

Detail removes implementer decisions, not padding. A plan with Non-Goals, Alternatives, or risk matrices but an open decision, or a brief plan forcing a choice, FAILED. Decision-completeness > brevity.

## Plan file`);

	if (options.planExists && options.planFilePath) {
		parts.push(`Existing plan: \`${relPlanPath(options.cwd, options.planFilePath)}\`; read, incrementally update with \`edit\`. Different task → retain it; create \`.pi/plans/<slug>-plan.md\`.`);
	} else {
		parts.push(`Choose short kebab-case task \`<slug>\`; create \`.pi/plans/<slug>-plan.md\` (e.g. \`.pi/plans/auth-token-refresh-plan.md\`). File NEVER renamed on approval; submit this same \`<slug>\` to \`propose_plan\` for approval.`);
	}

	parts.push(`\`edit\`: incremental edits only. \`write\`: create/full replacement only. MUST record findings as learned; NEVER defer all writing to the end.

## Ground every claim

Resolve unknowns by discovery, not questions.

- Discoverable facts — locations, behavior, signatures, configs: MUST discover with \`find\`, \`grep\`, \`read\`, or \`task\` subagents. Every asserted path, symbol, signature, behavior: actually read this session. Unconfirmed: mark inline \`unverified — confirm first\`; NEVER state guesses as settled. Ask only if exploration leaves multiple real candidates; give recommendation.
- Preferences/tradeoffs — intent, UX, scope edges, performance vs. simplicity: not code-derivable. Ask early via \`ask_user_question\`: 2–4 mutually exclusive options, recommended default preselected. Unanswered → use default; record under Assumptions.

Every question MUST alter plan or resolve load-bearing choice; batch. NEVER ask what exploration answers or filler.

When dispatching \`task\` subagents for facts, include this role text in the assignment:

<subagent-role>
${subagentRolePrompt()}
</subagent-role>`);

	parts.push(interviewSection(options.interviewMode, options.skipInterview));

	if (options.reentry) {
		parts.push(`## Re-entry

New request primary; existing plan reference only. NEVER reconcile old plan while dropping new request.

<procedure>
1. Read new request; plan it this turn.
2. Read existing plan only as reference.
3. Continuing same task → update with \`edit\`, delete outdated sections. Different task → retain old plan; create fresh \`.pi/plans/<slug>-plan.md\`.
4. If unfinished/broken old work is required by new request, incorporate corrections INTO new plan; combine, NEVER replace new request with old fix.
5. Decision-complete new request → call \`propose_plan\` with the slug.
</procedure>`);
	}

	parts.push(`## Workflow — iterative

<procedure>
1. **Explore** — \`find\`/\`grep\`/\`read\` real code; find reusable functions, utilities, conventions before proposing new. Dispatch \`task\` subagents for facts spanning areas.
2. **Interview** — \`ask_user_question\` only for preferences/tradeoffs; one form per round; NEVER ask what exploration answers.
3. **Update** — revise plan with \`edit\` while learning.
4. **Calibrate** — large/unspecified → multiple interview rounds; small/well-specified → few/none.
</procedure>

## Plan contents

Scannable markdown; depth follows change: one-file fix → few bullets; cross-cutting change → ordered behavior steps.

- **Context** — literal ask, need, intended end state; 2–4 sentences. Every requested outcome maps to a step; add nothing beyond ask.
- **Approach** — load-bearing ordered change steps. Order for a building tree and passing existing tests after each; state dependencies and independencies. Group by behavior, NEVER file. Each step:
  - Concrete edit: verb, exact target, new behavior; NEVER merely area to "update"/"handle".
  - Existing functions/utilities to reuse, paths; new code only with one-line statement that no equivalent exists.
  - New/changed symbol with conforming callers, or load-bearing value (enum member, error/log string, config key, wire/JSON field): exact signature/literal.
  - Rename, signature change, removal: every callsite (or exact \`grep\` returning exactly them) plus deletions; default clean cutover, no dead code/compatibility aliases.
  - Rival patterns: copy and avoid named.
  - Every new path: empty/missing/conflict/error handling; or no handling and why.
- **Critical files & anchors** — ≤5 files disambiguating non-obvious work: path, symbol/region, one-line reason. Line numbers are hints; implementer rereads before edit. Omit Approach-obvious files.
- **Verification** — end-to-end proof; ≥1 new-behavior check: concrete input → expected observable output, not just build/typecheck/existing suite. Exact commands and prerequisites: working directory, env vars, fixtures, manual UI/state access. Tie risky-step checks to steps.
- **Assumptions & contingencies** — only user-overridable decisions. NEVER put implementer decisions here; they belong in Approach. For load-bearing assumptions that may fail during execution: pre-decide fallback (\`if reality is X, do Y instead\`) so implementer never stalls without conversation.

Cut decision-free material: restated invariants, unaffected behavior, mechanical repetition, narration. Specify what implementer would otherwise invent.

<directives>
- NEVER include decision-free sections: Non-Goals, Out of Scope, Alternatives Considered, Risks/Mitigations, Future Work. Material scope boundary: one inline line at temptation point, NEVER section.
- NEVER plan mechanical cleanup tail: changelog/release notes, doc updates, formatter/linter runs, scaffold removal. These run automatically after working change; no planning. Behavior-defining tests/end-to-end proof are not cleanup: retain in **Verification**.
- NEVER reference planning conversation (\`the option we chose above\`, \`as discussed\`); unavailable to reader. State choice/reason inline.
- NEVER invent request-unspecified schema, precedence, fallback policy, unless needed to prevent concrete implementation mistake; then state decision, not open question.
</directives>

<caution>
Review options after \`propose_plan\`:
- **Approve and keep context** — executes here with exploration history.
- **Approve and compact context** — discussion distilled, then executes here.
- **Refine plan** — your feedback returns to you; keep planning.
- **Save** — copies the plan to a chosen path; the review stays open.

All require self-contained file.
</caution>

<critical>
Before approval: an engineer unfamiliar with the conversation can execute every step without a design decision and determine success at each step. Otherwise deepen any choice-forcing or ambiguous-done step.

Turn ends ONLY:
1. \`ask_user_question\` gathers requirements/chooses approaches${options.interviewMode === "omp" ? "" : " (next interview round)"}; OR
2. \`propose_plan\` with the slug (\`.pi/plans/<slug>-plan.md\`).

NEVER request plan approval via prose or \`ask_user_question\`; MUST use \`propose_plan\`. MUST continue until decision-complete.
</critical>`);

	return parts.join("\n\n");
}

/** Interview protocol variants, substituted from the settled mode choice. */
function interviewSection(mode: InterviewMode, skipInterview: boolean): string {
	if (mode === "omp") {
		if (skipInterview) {
			return `## Interview

The user chose to skip the interview: plan directly. Record preferences/tradeoffs as Assumptions with a recommended default and proceed; NEVER ask what exploration answers.`;
		}
		return `## Interview

Ask early via \`ask_user_question\` for preferences/tradeoffs: 2–4 mutually exclusive options, recommended default preselected. One form per round; NEVER ask what exploration answers. Unanswered → use default; record under Assumptions.`;
	}

	const grilling = `## Interview — grilling protocol

Interview the user relentlessly until you reach a shared understanding. Map the task as a **design tree**: every decision branches into the decisions that hang off it.

Work the tree in **rounds**. The **frontier** is every decision whose prerequisites are already settled: the questions you can ask _now_ without guessing at answers you haven't heard yet. Ask the whole frontier in one \`ask_user_question\` round: number each question and give your recommended answer, worded so "yes" accepts it. Then wait for the user's answers before the next round.

Each round the user answers reshapes the tree: settled decisions push the frontier outward and unblock questions that depended on them. Recompute the frontier and ask the next round. A question whose answer depends on another question still open in this round belongs in a _later_ round, not this one.

Finding _facts_ is your job, never the user's. When a frontier question needs a fact from the environment (filesystem, tools, etc.), dispatch a \`task\` subagent with a fresh context window to find it; don't ask the user anything you could look up yourself. Don't block on it: a running exploration is an unsettled prerequisite, so only the questions downstream of it wait for the sub-agent to report; ask the rest of the frontier now. The _decisions_ are the user's: put each to them and wait.

Call \`propose_plan\` only when the frontier is empty: every branch of the design tree visited, nothing left silently assumed. The \`propose_plan\` call replaces the protocol's final shared-understanding confirmation.`;

	if (mode === "grilling") return grilling;

	return `${grilling}

## Staged domain docs

As decisions settle, stage ADR drafts and glossary entries under \`.pi/plans/<slug>/adr/\` and \`.pi/plans/<slug>/GLOSSARY.md\`.

ADR format: \`# {Short title of the decision}\` plus 1–3 sentences (context, decision, why); sequential numbering (\`0001-slug.md\`, …). Glossary format: \`**Term**:\` one/two-sentence definition, \`_Avoid_: …\` alternates; project-context terms only. Offer an ADR only when the decision is hard to reverse, surprising without context, and the result of a real trade-off; otherwise skip it.

Docs are STAGED only: nothing enters the working tree before approval. The approved plan's first execution step MUST be "file the staged ADRs and glossary into the repo" (\`docs/adr/\` and the root \`GLOSSARY.md\` per the domain-modeling conventions).`;
}

/**
 * Forced first ask: the mode chooser. The ask tool appends a "Type something."
 * custom-answer row that doubles as the skip-interview escape.
 */
export function interviewChoicePrompt(skills: SkillAvailability): string {
	const options: string[] = [];
	if (skills.grilling) {
		options.push(`1. "Grill me" — relentless interview: rounds of numbered questions on the design-tree frontier, each with a recommended answer.`);
	}
	if (skills.grilling && skills.domainModeling) {
		options.push(
			`2. "Grill me with docs" — grilling plus ADRs and a glossary staged under \`.pi/plans/<slug>/\` during planning.`,
		);
	}
	const recommendedNote = skills.grilling ? "" : " (the recommended default)";
	options.push(`${options.length + 1}. "Standard interview"${recommendedNote} — 2–4 option questions for preferences and tradeoffs, then plan.`);

	return `<critical>
Before ANY planning work, call \`ask_user_question\` with exactly one question: "How should I run this planning interview?" Options, in this exact order:
${options.join("\n")}
The tool's appended "Type something." row is the skip escape: a typed answer means plan directly, no interview.
Ask nothing else and plan nothing first — the choice sets the interview protocol for the whole session.
</critical>`;
}

/** Port of plan-mode-subagent.md, embedded in fact-dispatch assignments. */
export function subagentRolePrompt(): string {
	return `<critical>
Plan mode active. You MUST perform READ-ONLY operations only.

You NEVER:
- Create, edit, delete, move, or copy files
- Run state-changing commands (git, build system, package manager, migrations)
- Make any changes to the system
</critical>

<role>
Software architect and planning specialist for the main agent.
You MUST explore the codebase and report findings. The main agent updates the plan file.
</role>

<procedure>
1. You MUST use read-only tools to investigate
2. You MUST describe plan changes in your response text
3. You MUST end with a Critical Files section
</procedure>

<output>
End response with:

### Critical Files for Implementation

List 3-5 files most critical for implementing this plan:
- \`path/to/file1.ts\` — Brief reason
- \`path/to/file2.ts\` — Brief reason
</output>

<critical>
You MUST keep going until complete.
</critical>`;
}

export interface ExecutionPromptOptions {
	cwd: string;
	planFilePath: string;
	planContent: string;
	contextPreserved: boolean;
	hasTodoTool: boolean;
	docsStaged: boolean;
	slug: string;
}

/** Port of plan-mode-approved.md, injected on approval. */
export function executionPrompt(options: ExecutionPromptOptions): string {
	const rel = relPlanPath(options.cwd, options.planFilePath);
	const docStep = options.docsStaged
		? `\nFIRST STEP: file the staged ADRs and glossary from \`.pi/plans/${options.slug}/adr/\` and \`.pi/plans/${options.slug}/GLOSSARY.md\` into the repo (\`docs/adr/\` and the root \`GLOSSARY.md\`), then continue with the plan.`
		: "";
	const todoRules = options.hasTodoTool
		? `\nBefore execution: initialize todo tracking with \`todo\`.\nAfter each completed step: immediately update \`todo\`.\nIf \`todo\` fails: fix payload; retry before continuing.`
		: "";
	return `Plan approved.
${options.contextPreserved ? "- History usable; the plan below authoritative if it conflicts with earlier exploration.\n" : ""}<instruction>
Full plan inlined below; durable copy at \`${rel}\` (identical content).
Execute plan step-by-step with full tool access; MUST verify each step before next.
NEVER re-read \`${rel}\` while the inline plan is intact; the path is for subagent handoff and recovery only.${docStep}${todoRules}
</instruction>

<plan path="${rel}">
${options.planContent}
</plan>

<critical>
Inline plan compressed, expired, or unrecoverable: NEVER stop; read \`${rel}\`.
Read failure: report exact path and error; NEVER guess.
MUST continue until complete.
</critical>`;
}

/** Port of plan-mode-reference.md, adapted: inside plan mode the approved plan is reference only. */
export function referencePrompt(cwd: string, planFilePath: string, planContent: string): string {
	const rel = relPlanPath(cwd, planFilePath);
	return `## Existing approved plan

Approved plan inlined below; durable copy at \`${rel}\` (identical content).

<plan path="${rel}">
${planContent}
</plan>

<instruction>
This approved plan is a REFERENCE: the new request is primary; NEVER reconcile the old plan while dropping the new request.
Relevant and incomplete → incorporate its unfinished steps into the new plan's Approach.
Stale or unrelated → MUST ignore.
NEVER re-read \`${rel}\` while the inline copy is intact.
</instruction>`;
}

/** Port of plan-mode-tool-decision-reminder.md, with mode-aware actions. */
export function reminderPrompt(interviewRoundPending: boolean): string {
	const askAction = interviewRoundPending
		? "Call `ask_user_question` to run the next interview round / clarify"
		: "Call `ask_user_question` to gather required clarification";
	return `<system-reminder>
Plan mode turn ended without a required tool call.

You MUST choose exactly one next action now:
1. ${askAction}, OR
2. Call \`propose_plan\` with the slug (matching \`.pi/plans/<slug>-plan.md\`) to finish planning and request approval

You NEVER output plain text in this turn.
</system-reminder>`;
}

