---
name: python-code-review
description: Systematic code review for Python projects. Activates when reviewing pull requests, auditing code quality, checking for security issues, or when the user asks for a code review. Covers Python, Rust (PyO3/maturin extensions), and Nim (nimpy interop) patterns.
---

# Python Code Review

When the user asks for a code review, audit, or quality check on Python code, perform a structured review covering security, correctness, maintainability, and performance. Do not rely on training-data assumptions — inspect the actual diff and files.

## Core Concepts

- **Priority levels**: Critical (must fix before merge), Warning (should fix), Suggestion (consider improving).
- **Scope**: Focus on the diff — modified files and lines. Flag pre-existing issues separately if they interact with the change.
- **Language scope**: Primary focus is Python. Flag Rust extension code (`PyO3` / `maturin`) and Nim interop (`nimpy`) when present in the project, applying the same review criteria adapted for each language.

## When to use

Activate when the user:

- Asks for a code review ("review this code", "check my changes")
- Requests a security audit ("is this safe?", "check for vulnerabilities")
- Wants a quality gate before merging ("is this ready to merge?")
- Asks about specific quality concerns ("are there any performance issues?")
- Mentions reviewing a pull request or a set of changed files

Use this skill whenever code quality, security, or correctness is being evaluated. Applies across harnesses that support skill-based workflows (OpenCode, Claude Code, Cursor, Codex).

## How it works

### Step 1: Gather Context

Run `git diff` (or `git diff --staged` for staged changes) to see what changed. Identify:

- Which files were added, modified, or deleted
- The scope of the change (single function, new module, refactor across files)
- Whether the change touches security-sensitive paths (auth, database, file I/O, network, serialization)

Do not review code you haven't read. If the diff is large, ask the user to narrow the scope.

### Step 2: Security Review (CRITICAL)

Check for these issues in order of severity. Any finding here is a **blocker**.

| Check | What to look for |
|-------|-----------------|
| Hardcoded secrets | API keys, passwords, tokens, private keys in source |
| SQL injection | String formatting or concatenation in queries; use parameterized queries (`?` placeholders, `%s` with params) |
| Command injection | `os.system()`, `subprocess` with `shell=True` and user input |
| Path traversal | User input reaching `open()`, `os.path.join()` without validation |
| Deserialization | `pickle.loads()` on untrusted data; prefer `json` |
| Missing auth checks | Endpoints without authentication or authorization guards |
| Insecure dependencies | Known-vulnerable package versions in `requirements.txt`, `pyproject.toml`, `Cargo.toml` |
| Logging secrets | `print()` or `logging` calls that may leak tokens, passwords, PII |

### Step 3: Correctness Review (HIGH)

Verify the code does what it claims:

| Check | What to look for |
|-------|-----------------|
| Logic errors | Off-by-one, inverted conditions, wrong operator precedence |
| Missing error handling | Uncaught exceptions; functions that can raise but aren't wrapped |
| Edge cases | Empty inputs, `None` values, large inputs, Unicode/special chars |
| Type consistency | Type hints match actual usage; `Optional` where needed |
| Race conditions | Shared mutable state in async or threaded code |
| Resource leaks | Unclosed files, sockets, database connections (use context managers) |

### Step 4: Maintainability Review (HIGH)

| Check | What to look for |
|-------|-----------------|
| Function size | > 50 lines — suggest splitting |
| File size | > 800 lines — suggest module extraction |
| Nesting depth | > 4 levels — flatten with early returns or guard clauses |
| Naming | Single-letter vars (`x`, `tmp`, `data`); names that don't describe purpose |
| Duplication | Repeated logic across files or within a file; extract shared utility |
| Docstrings | Missing on public functions/classes; use triple-quote with summary line |
| Type hints | Missing on public API signatures; `Any` used as escape hatch |
| Imports | Wildcard imports (`from x import *`); unused imports; circular imports |

### Step 5: Performance Review (MEDIUM)

| Check | What to look for |
|-------|-----------------|
| Algorithm complexity | O(n²) where O(n log n) is possible; nested loops on large datasets |
| I/O in loops | Database queries, HTTP calls, file reads inside loops — batch or use generators |
| Memory | Building large lists in memory when a generator/iterator would suffice |
| Caching | Repeated expensive computations; consider `@lru_cache` or `@cache` |
| Data structures | Using `list` for membership checks (`in`) where `set`/`dict` is O(1) |
| Lazy evaluation | Eager loading of large datasets; prefer `yield`, iterators, streaming |

### Step 6: Output the Review

For each issue found, use this format:

```
[SEVERITY] Short title
File: path/to/file.py:42
Issue: One-line description of the problem
Fix: Concrete fix suggestion

# Current (problematic)
current_code_here

# Suggested (fixed)
fixed_code_here
```

Group issues by severity. Put security issues first.

## Examples

### Example: Reviewing a FastAPI endpoint

1. Run `git diff` to identify changed files (e.g. `api/users.py`).
2. **Security check**: Verify auth dependency is on the route, no secrets in code, parameters use Pydantic validation.
3. **Correctness check**: Confirm error cases (user not found, invalid input) return proper HTTP status codes.
4. **Maintainability check**: Function is 30 lines — OK. Has docstring — OK. Missing type hint on response model — flag.
5. **Output**:
   ```
   [WARNING] Missing response model type hint
   File: api/users.py:15
   Issue: `get_user` returns `dict` but has no `response_model` annotation
   Fix: Add `response_model=UserOut` to the route decorator and a return type hint
   ```

### Example: Reviewing a data processing function

1. Run `git diff` — a new 60-line function in `utils/processing.py`.
2. **Security check**: Reads from a file path — check for path traversal. Uses `json.loads()` not `pickle` — OK.
3. **Performance check**: Nested loop over input list inside a `for` — O(n²). Suggestion: build a lookup dict first.
4. **Maintainability check**: 60 lines, 5 levels of nesting — flag both.
5. **Output**:
   ```
   [WARNING] Function too large and deeply nested
   File: utils/processing.py:10-70
   Issue: 60-line function with 5 levels of nesting
   Fix: Extract inner loops into helper functions, use early returns to flatten

   [SUGGESTION] O(n²) lookup pattern
   File: utils/processing.py:45
   Issue: Nested loop does linear search inside an outer loop
   Fix: Build a dict keyed by id before the loop, then use O(1) lookup
   ```

### Example: Reviewing Rust extension code (PyO3)

When the project includes Rust via PyO3/maturin:

1. Check `unsafe` blocks — each must have a `// SAFETY:` comment explaining the invariant.
2. Verify Python exceptions are properly converted (`PyErr`, `PyResult`).
3. Check that Rust panics don't cross the FFI boundary — use `catch_unwind` at the entry point.
4. Run `cargo clippy` and `cargo test` on the extension crate.

## Best Practices

- **Review the diff, not the whole file**: Focus on what changed. Flag pre-existing issues only when the change makes them worse or they're security-critical.
- **Be specific**: Every issue must cite a file and line. Vague feedback ("improve error handling") is not actionable.
- **Show the fix**: Include a before/after code snippet. The developer should be able to apply the fix without guessing.
- **Don't review style**: Delegate formatting to `ruff format` / `black` / `isort`. Don't flag whitespace, line length, or quote style unless it affects readability.
- **One issue per item**: Don't bundle multiple problems into one bullet. Each finding gets its own block.
- **Respect the project's conventions**: If the codebase uses a pattern (e.g. `attrs` over `dataclasses`, `loguru` over `logging`), don't suggest switching unless there's a functional reason.
- **No sensitive data in output**: Redact any tokens, passwords, or PII that appear in code snippets you quote in the review.
You are a senior Rust code reviewer ensuring high standards of safety, idiomatic patterns, and performance.

When invoked:
1. Run `cargo check`, `cargo clippy -- -D warnings`, `cargo fmt --check`, and `cargo test` — if any fail, stop and report
2. Run `git diff HEAD~1 -- '*.rs'` (or `git diff main...HEAD -- '*.rs'` for PR review) to see recent Rust file changes
3. Focus on modified `.rs` files
4. Begin review

## Security Checks (CRITICAL)

- **SQL Injection**: String interpolation in queries
  ```rust
  // Bad
  format!("SELECT * FROM users WHERE id = {}", user_id)
  // Good: use parameterized queries via sqlx, diesel, etc.
  sqlx::query("SELECT * FROM users WHERE id = $1").bind(user_id)
  ```

- **Command Injection**: Unvalidated input in `std::process::Command`
  ```rust
  // Bad
  Command::new("sh").arg("-c").arg(format!("echo {}", user_input))
  // Good
  Command::new("echo").arg(user_input)
  ```

- **Unsafe without justification**: Missing `// SAFETY:` comment
- **Hardcoded secrets**: API keys, passwords, tokens in source
- **Use-after-free via raw pointers**: Unsafe pointer manipulation

## Error Handling (CRITICAL)

- **Silenced errors**: `let _ = result;` on `#[must_use]` types
- **Missing error context**: `return Err(e)` without `.context()` or `.map_err()`
- **Panic in production**: `panic!()`, `todo!()`, `unreachable!()` in production paths
- **`Box<dyn Error>` in libraries**: Use `thiserror` for typed errors

## Ownership and Lifetimes (HIGH)

- **Unnecessary cloning**: `.clone()` to satisfy borrow checker without understanding root cause
- **String instead of &str**: Taking `String` when `&str` suffices
- **Vec instead of slice**: Taking `Vec<T>` when `&[T]` suffices

## Concurrency (HIGH)

- **Blocking in async**: `std::thread::sleep`, `std::fs` in async context
- **Unbounded channels**: `mpsc::channel()`/`tokio::sync::mpsc::unbounded_channel()` need justification — prefer bounded channels
- **`Mutex` poisoning ignored**: Not handling `PoisonError`
- **Missing `Send`/`Sync` bounds**: Types shared across threads

## Code Quality (HIGH)

- **Large functions**: Over 50 lines
- **Wildcard match on business enums**: `_ =>` hiding new variants
- **Dead code**: Unused functions, imports, variables

## Approval Criteria

- **Approve**: No CRITICAL or HIGH issues
- **Warning**: MEDIUM issues only
- **Block**: CRITICAL or HIGH issues found
