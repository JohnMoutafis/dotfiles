---
name: tdd-workflow
description: Test-driven development with red-green-refactor loop. Use when user wants to build features or fix bugs using TDD in Python (pytest), Rust (cargo test), or Nim (unittest/testament), mentions "red-green-refactor", wants integration tests, or asks for test-first development.
---

# Test-Driven Development

## Philosophy

**Core principle**: Tests should verify behavior through public interfaces, not implementation details. Code can change entirely; tests shouldn't.

**Good tests** are integration-style: they exercise real code paths through public APIs. They describe _what_ the system does, not _how_ it does it. A good test reads like a specification - "user can checkout with valid cart" tells you exactly what capability exists. These tests survive refactors because they don't care about internal structure.

```python
# Python (pytest) — tests behavior through the public API
def test_user_can_checkout_with_valid_cart():
    cart = Cart(items=[Item("book", 10.0)])
    order = checkout(cart)
    assert order.status == "confirmed"
```

```rust
// Rust — tests behavior, not internal struct layout
#[test]
fn user_can_checkout_with_valid_cart() {
    let cart = Cart::new(vec![Item::new("book", 10.0)]);
    let order = checkout(&cart).unwrap();
    assert_eq!(order.status, Status::Confirmed);
}
```

```nim
# Nim (unittest) — tests the public proc, not private helpers
test "user can checkout with valid cart":
    var cart = initCart(@[initItem("book", 10.0)])
    let order = checkout(cart)
    check order.status == "confirmed"
```

**Bad tests** are coupled to implementation. They mock internal collaborators, test private methods, or verify through external means (like querying a database directly instead of using the interface). The warning sign: your test breaks when you refactor, but behavior hasn't changed. If you rename an internal function and tests fail, those tests were testing implementation, not behavior.

See [tests.md](tests.md) for examples and [mocking.md](mocking.md) for mocking guidelines.

## Anti-Pattern: Horizontal Slices

**DO NOT write all tests first, then all implementation.** This is "horizontal slicing" - treating RED as "write all tests" and GREEN as "write all code."

This produces **crap tests**:

- Tests written in bulk test _imagined_ behavior, not _actual_ behavior
- You end up testing the _shape_ of things (data structures, function signatures) rather than user-facing behavior
- Tests become insensitive to real changes - they pass when behavior breaks, fail when behavior is fine
- You outrun your headlights, committing to test structure before understanding the implementation

**Correct approach**: Vertical slices via tracer bullets. One test → one implementation → repeat. Each test responds to what you learned from the previous cycle. Because you just wrote the code, you know exactly what behavior matters and how to verify it.

```
WRONG (horizontal):
  RED:   test_can_checkout, test_can_cancel, test_empty_cart, ...
  GREEN: checkout(), cancel(), clear_cart(), ...

RIGHT (vertical — one tracer bullet at a time):
  RED→GREEN: test_can_checkout → checkout()
  RED→GREEN: test_can_cancel   → cancel()
  RED→GREEN: test_empty_cart   → clear_cart()
  ...
```

## Workflow

### 1. Planning

When exploring the codebase, use the project's domain glossary so that test names and interface vocabulary match the project's language, and respect ADRs in the area you're touching.

Favor the project's native test runner: `pytest` for Python, `cargo test` for Rust, `testament` or `nim c -r` with `unittest` for Nim. Use available code-introspection tools if present (e.g. codanna, serena, etc.).

Before writing any code:

- Can we design for testability? (inject dependencies, avoid global state)


- [ ] Confirm with user what interface changes are needed
- [ ] Confirm with user which behaviors to test (prioritize critical paths)
- [ ] Identify opportunities for [deep modules](deep-modules.md) (small interface, deep implementation)
- [ ] Design interfaces for [testability](interface-design.md)
- [ ] List the behaviors to test (not implementation steps)
- [ ] Get user approval on the plan

Ask: "What should the public interface look like? Which behaviors are most important to test?"

**You can't test everything.** Confirm with the user exactly which behaviors matter most. Focus testing effort on critical paths and complex logic, not every possible edge case.

### 2. Tracer Bullet

Write ONE test that confirms ONE thing about the system:

```
RED:   Write test for first behavior → test fails
       $ pytest tests/test_checkout.py -k test_can_checkout  # or: cargo test, nim c -r tests/test_checkout
GREEN: Write minimal code to pass → test passes
       $ pytest tests/test_checkout.py -k test_can_checkout  # green!
```

This is your tracer bullet - proves the path works end-to-end.

### 3. Incremental Loop

For each remaining behavior:

```
RED:   Write next test → fails  ($ pytest ... -k test_next_behavior)
GREEN: Minimal code to pass → passes
```

Rules:

- One test at a time
- Only enough code to pass current test
- Don't anticipate future tests
- Keep tests focused on observable behavior
- Run the **same single test** in RED and GREEN to confirm the transition

### 4. Refactor

After all tests pass, look for [refactor candidates](refactoring.md):

- [ ] Extract duplication
- [ ] Deepen modules (move complexity behind simple interfaces)
- [ ] Apply SOLID principles where natural
- [ ] Consider what new code reveals about existing code
- [ ] Run tests after each refactor step (`pytest`, `cargo test`, or `nim c -r tests/...`)

- **Never refactor while RED.** Get to GREEN first.

## Checklist Per Cycle

```
[ ] Test describes behavior, not implementation
[ ] Test uses public interface only
[ ] Test would survive internal refactor
[ ] Code is minimal for this test
[ ] No speculative features added
[ ] Test runner confirms RED→GREEN transition (pytest -k, cargo test, nim c -r)
```
