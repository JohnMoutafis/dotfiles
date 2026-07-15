---
name: plan-compose
description: Expert planning specialist for complex features and refactoring. Integrates socratic-design as a mandatory decision gate before composing plans. Use PROACTIVELY when users request feature implementation, architectural changes, or complex refactoring. Automatically activated for planning tasks.
---

# Plan Compose

Create actionable, phased implementation plans for complex features and refactoring. 
Each plan is iterated with the user until approved.

## When to use

- Feature requests requiring multiple files or modules
- Architectural changes or refactoring across a codebase
- Any task where jumping straight to code is risky
- User says "plan", "design", "break down", "how should I implement"

## Workflow

### 0. Decision Gate (mandatory)

Activate `socratic-design` **always** before composing a plan. The only exception: all critical decisions (outcome, scope, constraints, tradeoffs) are already unambiguously resolved in the request itself.

socratic-design walks a strict order: Outcome → Scope → Constraints → Facts → Invariants → Options → Tradeoffs → Decision → Validation → Exec Gate.

Stop condition: you must reach the socratic-design "Stop" milestone before proceeding — shared understanding, resolved decision tree, open risks + owners, and a plan skeleton. No plan composition before this gate clears.

### 1. Gather Context

- Use `serena` skill to effectively use the MCP to understand affected code, if available
- Use `graphify` to visualize module dependencies if available
- Use `documentation-lookup` (Context7) for library/framework API questions

### 2. Analyze Requirements

- Identify success criteria and constraints
- List assumptions — surface them to the user
- Check for conflicts with existing architecture
- Flag risks early

### 3. Compose the Plan

Use the template in [plan-template.md](plan-template.md). Every plan must include:

- **Overview**: 2-3 sentence summary
- **Requirements**: What must be true when done
- **Architecture Changes**: File paths and descriptions
- **Implementation Steps**: Phased, with dependencies and risk levels
- **Testing Strategy**: Unit, integration, E2E
- **Risks & Mitigations**: What could go wrong and how to handle it
- **Success Criteria**: Checkboxes

### 4. Phase the Work

Break large features into independently deliverable phases:

| Phase | Contents |
|-------|----------|
| 1 — Minimum viable | Smallest slice that provides value |
| 2 — Core experience | Complete happy path |
| 3 — Edge cases | Error handling, validation, polish |
| 4 — Optimization | Performance, monitoring, analytics |

Each phase must be mergeable independently.

### 5. Iterate

1. Present the plan to the user
2. Collect feedback
3. Revise and re-present
4. Repeat until the user approves

## Step Format

Every implementation step must include:

```
1. **[Step Name]** (File: path/to/file.ext)
   - Action: Specific action to take
   - Why: Reason for this step
   - Dependencies: None / Requires step X
   - Risk: Low/Medium/High
```

## Red Flags

Flag these in existing code during planning:
- Functions >50 lines, files >800 lines
- Deep nesting (>4 levels)
- Duplicated logic, missing error handling
- Hardcoded values, missing tests
- Steps without clear file paths
- Phases that can't be delivered independently

## Best Practices

- **Be specific**: Exact file paths, function names, variable names
- **Minimize changes**: Extend existing code over rewriting
- **Follow conventions**: Match existing project patterns
- **Enable testing**: Structure changes to be testable per step
- **Think incrementally**: Each step should be independently verifiable

## References

- [plan-template.md](plan-template.md) — Copy-paste plan template with worked example
