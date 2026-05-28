---
name: code-review-workflow
description: Language-agnostic code review workflow. Activates when reviewing pull requests, auditing code quality, checking for security issues, or when the user asks for a code review. Routes to language-specific guides (Python, Rust) for idiomatic checks.
---

# Code Review Workflow

When the user asks for a code review, audit, or quality check, perform a structured review covering security, correctness, maintainability, and performance. Start with this general workflow, then apply language-specific checks from the companion guides.

## Core Concepts

- **Priority levels**: Critical (must fix before merge), Warning (should fix), Suggestion (consider improving).
- **Scope**: Focus on the diff — modified files and lines. Flag pre-existing issues only when they interact with the change.
- **Language routing**: After applying the universal checks below, delegate to the language-specific guide:
  - Python → [python-code-review.md](python-code-review.md)
  - Rust → [rust-code-review.md](rust-code-review.md)
  - Other languages → apply the universal checks; note that language-specific guidance is not available.

## When to use

Activate when the user:

- Asks for a code review ("review this code", "check my changes")
- Requests a security audit ("is this safe?", "check for vulnerabilities")
- Wants a quality gate before merging ("is this ready to merge?")
- Asks about specific quality concerns ("are there any performance issues?")
- Mentions reviewing a pull request or a set of changed files

Use this skill whenever code quality, security, or correctness is being evaluated. Applies across harnesses that support skill-based workflows (OpenCode, Claude Code, Cursor, Codex).

## How it works

### Step 1: Run Automated Checks

Before manual review, run the project's automated toolchain. If any command fails, report the failures first.

| Language | Commands |
|----------|----------|
| Python | `ruff check .`, `mypy .` (or `pyright`), `pytest` (or `python -m pytest`) |
| Rust | `cargo check --message-format=short`, `cargo clippy -- -D warnings`, `cargo fmt --check`, `cargo test` |
| Nim | `nim check <main_module>.nim`, `nim c -r tests/` (or `testament`) |
| Generic | `git diff` to see changes; adapt tooling to the project's build system |

Automated failures are **CRITICAL** — the review is incomplete until they pass. Do not manually review code that fails type checking or linting.

### Step 2: Gather Context

Run `git diff` (or `git diff --staged` for staged changes) to see what changed. Identify:

- Which files were added, modified, or deleted
- The scope of the change (single function, new module, refactor across files)
- Whether the change touches security-sensitive paths (auth, database, file I/O, network, serialization, crypto)

Do not review code you haven't read. If the diff is large, ask the user to narrow the scope.

### Step 3: Security Review (CRITICAL)

Check for these issues in order. Any finding here is a **blocker**.

| Check | What to look for |
|-------|-----------------|
| Hardcoded secrets | API keys, passwords, tokens, private keys in source code or config files |
| Injection | SQL injection (string concatenation in queries), command injection (user input in shell commands), path traversal (user input in file paths) |
| Deserialization | Untrusted data reaching deserializers (`pickle`, `yaml.load` with unsafe constructors, `serde` on untrusted input without validation) |
| Missing auth/authz | Endpoints or operations without authentication or authorization checks |
| Insecure dependencies | Known-vulnerable package versions in dependency manifests |
| Logging secrets | `print()`, `log`, `tracing` calls that may leak tokens, passwords, PII |
| Unsafe patterns | Language-specific: `unsafe` blocks without justification (Rust), `shell=True` (Python), raw pointer manipulation without guards |

### Step 4: Correctness Review (HIGH)

Verify the code does what it claims:

| Check | What to look for |
|-------|-----------------|
| Logic errors | Off-by-one, inverted conditions, wrong operator precedence, incorrect boolean logic |
| Missing error handling | Uncaught exceptions, silenced errors, swallowed `Result`/`Option` values |
| Edge cases | Empty inputs, null/None/nil values, large inputs, Unicode/special characters, boundary values |
| Race conditions | Shared mutable state in concurrent/async code without synchronization |
| Resource leaks | Unclosed files, sockets, database connections, child processes |
| Idempotency | Duplicate calls producing side effects when they shouldn't; non-idempotent retry logic |

### Step 5: Maintainability Review (HIGH)

| Check | What to look for |
|-------|-----------------|
| Function size | > 50 lines — suggest splitting into smaller, focused functions |
| File size | > 800 lines — suggest extracting a submodule or subpackage |
| Nesting depth | > 4 levels — flatten with early returns, guard clauses, or extraction |
| Naming | Names that don't describe purpose; single-letter variables; inconsistent conventions |
| Duplication | Repeated logic across files or within a file; extract shared utility |
| Documentation | Missing docstrings / doc comments on public APIs; undocumented invariants or preconditions |
| Modularity | Giant single-file modules; flat structure with no logical grouping; coupling across unrelated concerns |

### Step 6: Performance Review (MEDIUM)

| Check | What to look for |
|-------|-----------------|
| Algorithm complexity | O(n²) where O(n log n) is possible; nested loops on large or unbounded datasets |
| I/O in loops | Database queries, HTTP calls, file reads inside loops — batch, cache, or use bulk operations |
| Memory | Building large collections in memory when streaming or generators would suffice |
| Caching | Repeated expensive computations without memoization; cache invalidation bugs |
| Data structures | Wrong collection for the access pattern (e.g. list for membership tests when set/hash is O(1)) |
| Blocking in async | Synchronous I/O or CPU-bound work inside async/event-loop contexts |

### Step 7: Output the Review

For each issue found, use this format:

```
[SEVERITY] Short title
File: path/to/file.ext:42
Issue: One-line description of the problem
Fix: Concrete fix suggestion

# Current (problematic)
current_code_here

# Suggested (fixed)
fixed_code_here
```

Group issues by severity. Order: security issues first, then correctness, then maintainability, then performance.

### Step 8: Apply Language-Specific Checks

After the universal review, consult the companion guide for the project's language:

- **[python-code-review.md](python-code-review.md)** — Python-specific: `@lru_cache`, `asyncio` patterns, Pydantic validation, `with` context managers, type hints, `import` hygiene
- **[rust-code-review.md](rust-code-review.md)** — Rust-specific: ownership/borrowing, lifetimes, `unsafe` audit, async runtime usage, `Send`/`Sync`, error handling patterns (`thiserror`/`anyhow`), iterator chains, proc macro overhead

If the project uses multiple languages (e.g. Python + Rust via PyO3), apply both guides to their respective files.

## Examples

### Example: Reviewing a multi-language change

1. Run `git diff` — changes in `api/auth.py` (Python) and `src/crypto.rs` (Rust extension).
2. Run automated checks: `ruff . && mypy api/ && cargo check && cargo clippy` — all green.
3. **Security check** (universal): No hardcoded secrets, no injection — OK.
4. **Language routing**: Apply [python-code-review.md](python-code-review.md) to `api/auth.py`, apply [rust-code-review.md](rust-code-review.md) to `src/crypto.rs`.
5. Output findings grouped by file, with severity.

### Example: Reviewing a Python-only change

1. Run `ruff . && mypy . && pytest` — one test fails: `test_validate_email`.
2. Stop — flag the failing test as **CRITICAL**. Do not proceed with manual review until tests pass.
3. Once green, run `git diff` — `utils/validation.py` modified, new 40-line function.
4. Apply universal checks: security OK, correctness OK, maintainability OK.
5. Apply [python-code-review.md](python-code-review.md) language guide: check for `@lru_cache` on pure functions, verify type hints on new signature, check `import` hygiene.
6. Output any findings.

## References

- [python-code-review.md](python-code-review.md) — Python-specific review checklist
- [rust-code-review.md](rust-code-review.md) — Rust-specific review checklist

## Best Practices

- **Run automation first**: Linters, type checkers, and tests catch issues faster than a human. Don't manually review code that fails automated checks.
- **Review the diff, not the whole file**: Focus on what changed. Flag pre-existing issues only when the change makes them worse or they're security-critical.
- **Be specific**: Every issue must cite a file and line. Vague feedback ("improve error handling") is not actionable.
- **Show the fix**: Include a before/after code snippet. The developer should be able to apply the fix without guessing.
- **Don't review style**: Delegate formatting to linters (`ruff format`, `black`, `cargo fmt`). Don't flag whitespace or quote style unless it affects readability.
- **One issue per item**: Don't bundle multiple problems into one bullet. Each finding gets its own block.
- **Respect the project's conventions**: If the codebase uses a pattern consistently, don't suggest switching without a functional reason.
- **No sensitive data in output**: Redact any tokens, passwords, or PII that appear in code snippets you quote in the review.
