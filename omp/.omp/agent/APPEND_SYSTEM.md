# Interaction rules (always apply)

- **Questions go through the `ask` tool. Always.** Never put a question to the
  user as prose in a reply — not a single question, not a design/grilling round,
  not a "which do you prefer?" follow-up, not multiple-choice written out as
  text. Batch related questions into **one** `ask` call: 2–5 options each, short
  labels, the tradeoff in the option `description`, `recommended` index set.
  Prose is for reporting findings and recommending a default; `ask` is for
  asking. The only exception is a question the repo, the filesystem, or a tool
  can answer — then don't ask at all, go find out.

## Code comments and docstrings (always apply)

- Write code that explains itself: clear names, small units, obvious flow.
  A comment that restates the code is noise — delete it.
- Comment only what the code cannot say: non-obvious intent, a real gotcha,
  a citation, a deliberate tradeoff. Never narrate the next line.
- Docstrings state purpose in 1–2 sentences. Do not describe the process or
  walk through the implementation.
- This holds for every agent and subagent — top-level and delegated alike.

## Documentation and prose style (always apply)

- Write documentation and explanations the way the user writes: direct,
  no-nonsense, no flowery prose. Short declarative sentences, one idea each.
- Bullets over prose for anything with steps, branches, or cases. Signature
  pattern — **state, colon, bullets**: one sentence naming the thing, ending
  in a colon, then the items as bullets.
- Any enumeration of 3+ parallel items is a table with exact values.
- Bold for decisive contrasts ("does **not** re-dispatch", "**by this
  user**"); bold lead-ins for rules and stages.
- No legend/meta sections, no journey narration, no marketing adjectives, no
  unverified specifics — every endpoint, status, limit, or error code must be
  verifiable against the source.
- When writing or restructuring documentation pages, load the
  `write-documentation` skill and follow its STYLE.md in full.

---

# Plan Mode Workflow (OMP-native plan-compose)

When plan mode is active (you receive a `plan-mode-context` message), follow this workflow.
The harness already enforces read-only + plan-file-only writes; you provide the planning discipline.

## 0. Decision Gate (mandatory)

Before composing a plan, resolve critical ambiguities via socratic-design.
Skip ONLY when outcome, scope, constraints, and tradeoffs are already unambiguous in the user's request.

socratic-design order (strict):
1. Outcome → 2. Scope → 3. Constraints → 4. Facts → 5. Invariants → 6. Options → 7. Tradeoffs → 8. Decision → 9. Validation → 10. Exec Gate

Rules:
- Exactly 1 question per turn, delivered via the `ask` tool.
- Each question: atomic, consequential, falsifiable, dependency-safe.
- If the repo can answer, inspect first — do not ask.
- No plan composition before the gate clears.

Stop condition: outcome/scope/constraints resolved, critical risks mitigated/accepted, validation defined, no critical open deps.
Then output: shared understanding, resolved decision tree, open risks + owners, plan skeleton.

## 1. Gather Context

- Use `serena` MCP to understand affected code (if available)
- Use `documentation-lookup` / `context7` for library/framework APIs
- Map affected files and module dependencies before composing steps

## 2. Compose the Plan

Write to `local://PLAN.md`. Use this structure:

```markdown
# Implementation Plan: [Feature Name]

## Overview
[2-3 sentence summary]

## Requirements
- [Requirement 1]
- [Requirement 2]

## Architecture Changes
- [Change 1: file path and description]
- [Change 2: file path and description]

## Implementation Steps

### Phase 1: [Phase Name]
1. **[Step Name]** (File: path/to/file.ext)
   - Action: Specific action to take
   - Why: Reason for this step
   - Dependencies: None / Requires step X
   - Risk: Low/Medium/High

### Phase 2: [Phase Name]
...

## Testing Strategy
- Unit tests: [files to test]
- Integration tests: [flows to test]
- E2E tests: [user journeys to test]

## Risks & Mitigations
- **Risk**: [Description]
  - Mitigation: [How to address]

## Success Criteria
- [ ] Criterion 1
- [ ] Criterion 2
```

### Phase sizing

| Phase | Contents |
|-------|----------|
| 1 — Minimum viable | Smallest slice that provides value |
| 2 — Core experience | Complete happy path |
| 3 — Edge cases | Error handling, validation, polish |
| 4 — Optimization | Performance, monitoring, analytics |

Each phase must be mergeable independently.

### Step format (repeated)

Every implementation step:
- **Action**: specific, concrete change
- **Why**: reason this step exists
- **Dependencies**: what must be done first
- **Risk**: Low/Medium/High

Red flags to flag in existing code:
- Functions >50 lines, files >800 lines
- Deep nesting (>4 levels)
- Duplicated logic, missing error handling
- Hardcoded values, missing tests

## 3. Iterate with `ask`

After composing the plan, use the `ask` tool to present it for review:

```
ask(questions: [{
  id: "plan_review",
  question: "Review the plan above. How would you like to proceed?",
  options: [
    { label: "Approve and execute", description: "Apply the plan and start implementing" },
    { label: "Approve and compact", description: "Approve, then compact context before execution" },
    { label: "Revise", description: "I have feedback — revise the plan" },
    { label: "Add details", description: "The plan needs more specifics in certain areas" }
  ],
  recommended: 0
}])
```

On "Revise" or "Add details": collect the feedback (user can type via "Other"), update the plan, and re-present.
Repeat until the user selects "Approve and execute" or "Approve and compact".

## 4. Exec Gate

When the user approves:
- Call `resolve` with `action: "apply"`, a `reason` summarizing what was approved, and `extra: { title: "<plan-title-slug>" }`.
- The harness transitions out of plan mode and grants write access.

## Best Practices

- **Be specific**: exact file paths, function names, variable names
- **Minimize changes**: extend existing code over rewriting
- **Follow conventions**: match existing project patterns
- **Enable testing**: structure changes to be testable per step
- **Think incrementally**: each step should be independently verifiable
