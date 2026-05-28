# Agent Instructions

*Bias*: caution over speed. For trivial tasks (typo fix, rename), use judgment and skip ceremony.

## Core Principles

1. **Agent-First** — Delegate to specialized agents for domain tasks
2. **Test-Driven** — Write tests before implementation, 80%+ coverage required
3. **Security-First** — Never compromise on security; validate all inputs
4. **Plan Before Execute** — Plan complex features before writing code
5. **Tool-Aware** — Use available semantic tools (serena, graphify, Context7) before raw grep/glob

## Available Agents

| Agent | Purpose | When to Use |
|-------|---------|-------------|
| orchestrator | Task routing and verification gate | **Always first** — routes to specialists, runs post-implementation verification |
| planner | Implementation planning | Complex features, refactoring, architecture decisions |
| tdd-guide | Test-driven development | New features, bug fixes — writes tests, delegates implementation to coder |
| error-resolver | Fix build/type/lint errors | When build, typecheck, or lint fails |
| coder | Code implementation | Write, port, scaffold, or fix source files |
| code-reviewer | Code review and quality audit | PRs, security audits — activates `code-review-workflow` skill |

## Agent Orchestration

- **orchestrator** is the primary entry point. It cannot write or edit files — only routes.
- Run independent specialists in **parallel** (e.g., `planner` + `tdd-guide` on different features).
- After any code-writing task, the orchestrator runs its own build/typecheck/lint verification — never trust subagent self-reports.

### Routing

| User asks for... | Route to |
|---|---|
| Complex feature, architecture change, refactor plan | `planner` |
| New feature or bug fix with tests | `tdd-guide` |
| Build/typecheck/lint errors | `error-resolver` |
| Straightforward code change | `coder` |
| Code review, security audit, quality gate | `code-reviewer` |

## Coding Style

**Targeted edits (CRITICAL):** Never overwrite a file when only a few lines need to change.

**Immutability (CRITICAL):** Create new objects, never mutate. Return new copies with changes applied.

**Code quality:** Match existing project conventions exactly. Keep functions under 50 lines, files under 800 lines. Avoid deep nesting (>4 levels). Handle errors explicitly. Add comments only for non-obvious logic.

## Semantic Tools

If Serena MCP and loadable skills are available, prefer these over raw text search.

### Serena (built-in MCP)

| Tool | Use for | Instead of... |
|------|---------|--------------|
| `find_symbol` / `get_symbols_overview` | Locating functions, classes, methods; file structure | `grep` for symbol lookup |
| `find_referencing_symbols` | Finding all callers of a symbol before changes | `grep` for usage search |
| `find_declaration` / `find_implementations` | Jumping to definitions and implementations | Reading files top-to-bottom |
| `rename_symbol` | Safe cross-codebase renames | Manual find-and-replace |
| `replace_symbol_body` / `insert_*_symbol` | Editing relative to known symbols | Guessing line numbers |

**Rule**: Before `grep`, try `find_symbol`. Before editing near a function, use `find_symbol` for exact location.

### Skills

Invoke via the `skill` tool when trigger conditions match:

| Skill | When to activate |
|-------|-----------------|
| `documentation-lookup` | Looking up current API docs (Context7 MCP) — prefer over training data |
| `tdd-workflow` | Building features or fixing bugs with test-first development |
| `code-review-workflow` | Reviewing pull requests, auditing code quality, security checks |
| `serena` | Managing project memories, symbol navigation, session continuity |
| `socratic-design` | Evidence-first decisions when requirements are ambiguous |
| `graphify` | Visualizing module dependencies and code structure |
| `caveman` | Minimal-diff, low-ceremony changes |

## Testing

| Language | Test command |
|----------|-------------|
| Python | `pytest` (or `uv run pytest`) |
| Rust | `cargo test` |
| Nim | `nim c -r tests/` or `testament` |

## Performance

**Context management:** Avoid the last 20% of the context window for large refactoring and multi-file features.

**Build troubleshooting:** Use `error-resolver` agent → analyze errors → fix incrementally → verify after each fix.

## Success Metrics

- Tests pass, no security regressions, diffs are minimal and purposeful
