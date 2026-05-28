# Agent Instructions

*Bias*: caution over speed. For trivial tasks (typo fix, rename), use judgment and skip ceremony.

## Core Principles

1. **Precise Edits** — (CRITICAL) Prefer surgical edits over file rewrites. Never overwrite an entire file to change a few lines. Full-file rewrites risk reverting unrelated changes, inflate diffs, and obscure what changed. Exception: creating a new file from scratch.

2. **Tool-Aware** — (CRITICAL) Use available semantic tools and MCPs before raw text search. Prefer `find_symbol` and `find_referencing_symbols` over `grep` for locating definitions and callers. If a skill matches the task, invoke it.

3. **Security-First** — Never hardcode secrets. Validate inputs at system boundaries. Flag security issues in code you touch before proceeding.

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

**Build troubleshooting:** Fix errors incrementally — verify each fix before the next.

## Success Metrics

- Tests pass, no security regressions, diffs are minimal and purposeful
