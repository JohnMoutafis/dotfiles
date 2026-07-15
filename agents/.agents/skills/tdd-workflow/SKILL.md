---
name: tdd-workflow
description: Test-driven development with red-green-refactor loop. Use when user wants to build features or fix bugs using TDD in Python (pytest), Rust (cargo test), or Nim (unittest/testament), mentions "red-green-refactor", wants integration tests, or asks for test-first development.
---

# Test-Driven Development

## Philosophy

Tests verify behavior through public interfaces, not implementation details. A good test reads like a specification — "user can checkout with valid cart" — and survives internal refactors unchanged.

**Vertical slices, not horizontal.** One test → one implementation → repeat. Never write all tests first then all code — that tests imagined behavior, not actual behavior.

See [tests.md](tests.md) for examples and [mocking.md](mocking.md) for mocking guidelines.

## Workflow

### 1. Plan

- Confirm with user which behaviors to test — prioritize critical paths
- Design for [testability](interface-design.md): inject dependencies, avoid global state
- Identify opportunities for [deep modules](deep-modules.md)
- Use `serena` skill to understand the code area if available (semantic tools ex: `find_symbol`, `get_symbols_overview`)

### 2. RED — Write one failing test

Write a test that describes expected behavior through the public API:

```python
def test_user_can_checkout_with_valid_cart():
    cart = Cart(items=[Item("book", 10.0)])
    order = checkout(cart)
    assert order.status == "confirmed"
```
```rust
#[test]
fn user_can_checkout_with_valid_cart() {
    let cart = Cart::new(vec![Item::new("book", 10.0)]);
    let order = checkout(&cart).unwrap();
    assert_eq!(order.status, Status::Confirmed);
}
```
```nim
test "user can checkout with valid cart":
    let order = checkout(initCart(@[initItem("book", 10.0)]))
    check order.status == "confirmed"
```

Run it — confirm it **fails**:

| Language | Command |
|----------|---------|
| Python | `pytest tests/test_checkout.py -k test_can_checkout` (or `uv run pytest`) |
| Rust | `cargo test user_can_checkout -- --nocapture` |
| Nim | `nim c -r tests/test_checkout.nim` or `testament` |

### 3. GREEN — Write minimal code to pass

Implement only enough to make the failing test pass. No speculative features.

Run the same test — confirm it **passes**.

### 4. Repeat

For each remaining behavior: RED → GREEN → next. One test at a time.

### 5. Refactor

After all tests pass, look for [refactor candidates](refactoring.md):

- Extract duplication, deepen modules, apply SOLID where natural
- Run tests after each refactor step
- **Never refactor while RED** — get to GREEN first

### 6. Verify coverage

| Language | Command |
|----------|---------|
| Python | `pytest --cov` or `coverage run -m pytest && coverage report` |
| Rust | `cargo tarpaulin` or `cargo llvm-cov` |
| Nim | `nim c --passC:-fprofile-arcs --passC:-ftest-coverage` (check project config) |

Target: **80%+ coverage** on changed code.

## Edge Cases to Cover

1. Null/None/nil input
2. Empty collections and strings
3. Invalid types or malformed input
4. Boundary values (min, max, zero, negative)
5. Error paths (network failures, DB errors, timeouts)
6. Concurrent access / race conditions
7. Large datasets (10k+ items)
8. Special characters (Unicode, emojis, SQL injection chars)

## Anti-Patterns

- Testing implementation details (internal state) instead of behavior
- Tests depending on each other (shared mutable state)
- Asserting too little (tests that pass but verify nothing)
- Writing all tests first, then all implementation (horizontal slicing)
- Mocking everything — prefer real collaborators when fast enough

## Quality Checklist

```
[ ] Test describes behavior, not implementation
[ ] Test uses public interface only
[ ] Test would survive internal refactor
[ ] Edge cases covered (null, empty, invalid, boundary)
[ ] Error paths tested, not just happy path
[ ] Mocks used only for external dependencies (DB, network, 3rd-party APIs)
[ ] Tests are independent — no shared state between tests
[ ] Coverage is 80%+ on changed code
```

## References

- [tests.md](tests.md) — Test examples
- [mocking.md](mocking.md) — Mocking guidelines
- [interface-design.md](interface-design.md) — Designing for testability
- [deep-modules.md](deep-modules.md) — Small interface, deep implementation
- [refactoring.md](refactoring.md) — Refactor candidates and patterns
