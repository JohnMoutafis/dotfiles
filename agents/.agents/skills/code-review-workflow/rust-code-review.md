---
name: rust-code-review
description: Systematic code review for Rust projects. Activates when reviewing pull requests, auditing code quality, checking for safety violations, or when the user asks for a code review. Covers ownership, lifetimes, unsafe code, async patterns, and FFI boundaries.
---

# Rust Code Review

When the user asks for a code review, audit, or quality check on Rust code, perform a structured review covering safety, correctness, idiomatic patterns, and performance. Do not rely on training-data assumptions — inspect the actual diff and run the toolchain.

## Core Concepts

- **Priority levels**: Critical (must fix before merge), Warning (should fix), Suggestion (consider improving).
- **Scope**: Focus on the diff — modified files and lines. Flag pre-existing issues separately if they interact with the change.
- **Language scope**: Primary focus is Rust. Flag FFI boundaries (C ABI via `extern "C"`, Python via PyO3/maturin, Nim via nim-rust interop) when present, applying cross-language safety criteria.

## When to use

Activate when the user:

- Asks for a code review ("review this code", "check my changes")
- Requests a safety audit ("is this safe?", "check for undefined behavior")
- Wants a quality gate before merging ("is this ready to merge?")
- Asks about specific quality concerns ("are there any performance issues?", "is this idiomatic?")
- Mentions reviewing a pull request or a set of changed files

Use this skill whenever code quality, safety, or correctness is being evaluated. Applies across harnesses that support skill-based workflows (OpenCode, Claude Code, Cursor, Codex).

## How it works

### Step 1: Run the Toolchain

Before reading the diff, run the Rust toolchain. If any command fails, report the failures first — do not proceed with a manual review until the toolchain is green.

```
cargo check --message-format=short
cargo clippy -- -D warnings
cargo fmt --check
cargo test
```

If `clippy` or `fmt` fail, flag them as **CRITICAL** — the review is incomplete until they pass. If `cargo check` fails, the review is **BLOCKED**.

### Step 2: Gather Context

Run `git diff` (or `git diff --staged` for staged changes) to see what changed. Identify:

- Which `.rs` files were added, modified, or deleted
- The scope of the change (single function, new module, refactor across crates)
- Whether the change touches safety-sensitive paths (`unsafe` blocks, FFI, raw pointers, `std::process::Command`, filesystem, network, crypto)

Do not review code you haven't read. If the diff is large, ask the user to narrow the scope.

### Step 3: Safety Review (CRITICAL)

Check for these issues in order. Any finding here is a **blocker**.

| Check | What to look for |
|-------|-----------------|
| Unsafe without justification | `unsafe { }` or `unsafe fn` without a `// SAFETY:` comment explaining the invariant being upheld |
| Use-after-free / dangling pointers | Raw pointer dereference after the pointee is dropped; `unsafe` blocks that return references into local state |
| Data races | `unsafe impl Send` or `unsafe impl Sync` without justification; shared mutable state without `Mutex`/`RwLock`/`Atomic` |
| Hardcoded secrets | API keys, passwords, tokens, private keys in source |
| SQL injection | `format!()` or string concatenation building queries; use parameterized queries via `sqlx`, `diesel`, or `rusqlite` |
| Command injection | `std::process::Command` with `sh -c` and user input; pass arguments individually with `.arg()` |
| Panic in production | `panic!()`, `todo!()`, `unreachable!()`, `unwrap()`, `expect()` on untrusted input in production code paths |
| Unsound `transmute` | `std::mem::transmute` between types of different sizes or with invalid bit patterns |
| Insecure dependencies | Known-vulnerable crate versions in `Cargo.toml` / `Cargo.lock` (`cargo audit`) |

### Step 4: Error Handling Review (CRITICAL)

| Check | What to look for |
|-------|-----------------|
| Silenced errors | `let _ = result;` on `#[must_use]` types; `Result::ok()` without checking the `Err` |
| Missing error context | Returning `Err(e)` without `.context()` (anyhow) or `.map_err()` to add meaningful context |
| Boxed errors in libraries | `Box<dyn Error>` in library crates — use `thiserror` for typed, matchable errors |
| Unwrap on fallible ops | `.unwrap()` or `.expect()` on `Result`/`Option` from I/O, parsing, network — use `?` or handle the error case |
| Panic in Drop | `.unwrap()` or `panic!()` inside `Drop` impl — panicking during unwind aborts the process |

### Step 5: Ownership and Lifetimes (HIGH)

| Check | What to look for |
|-------|-----------------|
| Unnecessary cloning | `.clone()` used to satisfy the borrow checker without understanding the root cause; prefer borrows or refactors |
| String instead of &str | Taking `String` in function signatures when `&str` suffices |
| Vec instead of slice | Taking `Vec<T>` when `&[T]` suffices |
| `Rc`/`Arc` for single ownership | Using reference-counted pointers when a single owner and borrows would work |
| Lifetime annotations missing | Elided lifetimes that compile but obscure the ownership contract on public APIs |

### Step 6: Concurrency Review (HIGH)

| Check | What to look for |
|-------|-----------------|
| Blocking in async | `std::thread::sleep`, `std::fs::*`, synchronous I/O inside `async fn` — use `tokio::time::sleep`, `tokio::fs` |
| Unbounded channels | `std::sync::mpsc::channel()` or `tokio::sync::mpsc::unbounded_channel()` — prefer bounded channels with backpressure |
| Mutex poisoning ignored | Accessing a `Mutex` after a panic in another thread without handling `PoisonError` — use `Mutex::lock().unwrap()` carefully or `parking_lot::Mutex` |
| Missing Send/Sync bounds | Types shared across threads without `Send` or `Sync` bounds; `Rc` sent across `.await` or thread boundary |

### Step 7: Code Quality Review (HIGH)

| Check | What to look for |
|-------|-----------------|
| Function size | > 50 lines — suggest splitting into smaller, focused functions |
| File size | > 800 lines — suggest extracting a submodule |
| Wildcard match on enums | `_ =>` arms that silently ignore new variants added later — match exhaustively or use a `#[non_exhaustive]` aware pattern |
| Dead code | Unused functions, imports, variables, or `pub` items that aren't part of the public API |
| Naming | Non-idiomatic names (`snake_case` for fns/vars, `CamelCase` for types, `SCREAMING_SNAKE_CASE` for consts) |
| Documentation | Missing doc comments (`///` or `//!`) on public items; `#![deny(missing_docs)]` in library crates |
| Module structure | Giant `lib.rs` or `main.rs`; flat module trees with no logical grouping |

### Step 8: Performance Review (MEDIUM)

| Check | What to look for |
|-------|-----------------|
| Unnecessary allocations | `String::new()` + `push_str()` where `format!()` would be clearer; `collect()` into `Vec` then iterate |
| Iterator misuse | `.collect::<Vec<_>>().iter()` — iterate directly; chaining adaptors that could be combined |
| Inefficient collections | `Vec` for random removal/insertion when `VecDeque` or `BTreeMap` is better; `HashMap` with predictable keys when `BTreeMap` gives sorted iteration |
| Small-type boxing | `Box<T>` for types smaller than a few machine words without a good reason (trait objects or recursion excepted) |
| Inline hint misuse | `#[inline]` on large functions — trust the compiler unless benchmarks prove otherwise |
| Build times | Overuse of proc macros in hot paths; monomorphization bloat from overly generic code |

### Step 9: Output the Review

For each issue found, use this format:

```
[SEVERITY] Short title
File: path/to/file.rs:42
Issue: One-line description of the problem
Fix: Concrete fix suggestion

// Current (problematic)
current_code_here

// Suggested (fixed)
fixed_code_here
```

Group issues by severity. Put safety issues first, then error handling, then code quality, then performance.

## Examples

### Example: Reviewing an async HTTP handler (Axum)

1. Run `cargo check && cargo clippy -- -D warnings && cargo fmt --check && cargo test` — all green.
2. Run `git diff` — `src/handlers/users.rs` modified, 45-line async fn added.
3. **Safety check**: No `unsafe`, no raw pointers — OK.
4. **Error handling check**: `.unwrap()` on `sqlx::query_as` — flag. Use `?` with proper error conversion.
5. **Concurrency check**: Uses `tokio::spawn` but captures `Arc<AppState>` — OK. No blocking calls in async — OK.
6. **Output**:
   ```
   [CRITICAL] Unwrap on fallible database operation
   File: src/handlers/users.rs:28
   Issue: `.unwrap()` on `sqlx::query_as` — will panic on connection failure
   Fix: Use `?` and ensure the error type implements `IntoResponse`

   // Current
   let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
       .bind(id)
       .fetch_one(&pool)
       .await
       .unwrap();

   // Suggested
   let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
       .bind(id)
       .fetch_one(&pool)
       .await
       .map_err(|e| (StatusCode::NOT_FOUND, e.to_string()))?;
   ```

### Example: Reviewing an unsafe serialization helper

1. Run toolchain — `clippy` warns on `unsafe` block without `// SAFETY:` comment.
2. Run `git diff` — new `unsafe fn deserialize_bytes` in `src/serde_helpers.rs`.
3. **Safety check**: `unsafe` block with pointer arithmetic, no safety comment — flag as CRITICAL. Also, `transmute` from `&[u8]` to `&[T]` — check alignment and size.
4. **Output**:
   ```
   [CRITICAL] Unsafe block without safety justification
   File: src/serde_helpers.rs:15-22
   Issue: `unsafe` block transmutes byte slice to typed slice without documenting invariants
   Fix: Add `// SAFETY:` comment explaining alignment, size checks, and why the cast is sound

   // Current
   unsafe {
       let ptr = bytes.as_ptr() as *const T;
       std::slice::from_raw_parts(ptr, bytes.len() / std::mem::size_of::<T>())
   }

   // Suggested
   // SAFETY: `bytes` is guaranteed to be aligned to `T` because it comes from
   // `read_exact` on a `T`-aligned buffer. The length is checked above to be
   // an exact multiple of `size_of::<T>()`.
   unsafe {
       let ptr = bytes.as_ptr() as *const T;
       std::slice::from_raw_parts(ptr, bytes.len() / std::mem::size_of::<T>())
   }
   ```

### Example: Reviewing ownership issues in a library API

1. Run toolchain — all green.
2. Run `git diff` — new public fn in `src/lib.rs` taking `String` and `Vec`.
3. **Ownership check**: Function takes `String` but only reads — should take `&str`. Takes `Vec<Config>` but iterates — should take `&[Config]`.
4. **Output**:
   ```
   [WARNING] Overly restrictive parameter types on public API
   File: src/lib.rs:42
   Issue: `process_configs` takes `Vec<Config>` and `String` but only borrows
   Fix: Change signatures to `&[Config]` and `&str` to avoid forcing callers to allocate

   // Current
   pub fn process_configs(configs: Vec<Config>, name: String) -> Vec<Output> { ... }

   // Suggested
   pub fn process_configs(configs: &[Config], name: &str) -> Vec<Output> { ... }
   ```

## Best Practices

- **Run the toolchain first**: `cargo check`, `clippy`, `fmt --check`, and `cargo test`. The compiler catches many issues before a human can. Don't review code that doesn't compile.
- **Review the diff, not the whole file**: Focus on what changed. Flag pre-existing issues only when the change makes them worse or they're safety-critical.
- **Be specific**: Every issue must cite a file and line. Vague feedback ("improve error handling") is not actionable.
- **Show the fix**: Include a before/after code snippet. The developer should be able to apply the fix without guessing.
- **Don't review formatting**: `cargo fmt` handles that. Don't flag whitespace, brace placement, or import ordering unless it survived `fmt --check`.
- **Respect the project's conventions**: If the crate uses a specific error handling pattern (e.g. `anyhow` in binaries, `thiserror` in libraries), don't suggest switching without a functional reason.
- **One issue per item**: Don't bundle multiple problems into one bullet. Each finding gets its own block.
- **No sensitive data in output**: Redact any tokens, passwords, or PII that appear in code snippets you quote in the review.
- **Prefer `cargo` subcommands**: `cargo check` for type checking, `cargo clippy` for linting, `cargo fmt` for formatting, `cargo test` for tests, `cargo audit` for dependency vulnerabilities, `cargo tarpaulin` or `cargo llvm-cov` for coverage.
