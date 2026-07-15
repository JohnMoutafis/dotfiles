---
name: documentation-lookup
description: Fetch up-to-date library and framework docs via Context7 MCP instead of relying on training data. Use when the user asks about libraries, APIs, setup questions, code examples, or names a framework (e.g. FastAPI, Tokio, Serde, Nim's std/httpclient, Django, SQLAlchemy).
---

# Documentation Lookup (Context7)

Fetch current documentation via Context7 MCP tools (`resolve-library-id` → `query-docs`) instead of relying on training data.

## When to use

- Setup or configuration questions ("How do I configure a Tokio runtime?")
- Code that depends on a library ("Write a SQLAlchemy query for...")
- API or reference lookups ("What are Nim's asyncdispatch methods?")
- User names a specific framework or library

## Workflow

### 1. Resolve the Library ID

Call **resolve-library-id** with:
- `libraryName`: Library name from the user's question (e.g. `FastAPI`, `Tokio`, `Nim`)
- `query`: The user's full question (improves relevance ranking)

### 2. Select the Best Match

Choose from results using:
- **Name match**: Exact or closest match
- **Benchmark score**: Higher = better docs quality (100 is max)
- **Source reputation**: Prefer High or Medium
- **Version**: If user specified one (e.g. "Django 5"), prefer version-specific ID

### 3. Fetch the Documentation

Call **query-docs** with:
- `libraryId`: Selected ID from step 2 (e.g. `/tiangolo/fastapi`)
- `query`: The user's specific question

Limit: max 3 calls to `resolve-library-id` or `query-docs` per question. After 3, state uncertainty and use best available info.

### 4. Answer

- Use the fetched docs, not training data
- Include relevant code examples from the docs
- Cite library version when it matters (e.g. "In FastAPI 0.115...")

## Examples

**FastAPI (Python):** `resolve-library-id("FastAPI", "validate request bodies")` → `/tiangolo/fastapi` → `query-docs` → answer with Pydantic `BaseModel` pattern from docs.

**Serde (Rust):** `resolve-library-id("Serde", "serialize JSON")` → `/serde-rs/serde` → `query-docs` → answer with `#[derive(Serialize, Deserialize)]` + `serde_json` examples.

**Nim stdlib:** `resolve-library-id("Nim", "async HTTP requests")` → `/nim-lang/Nim` → `query-docs` → answer with `std/httpclient` + `asyncdispatch` patterns.

## Best Practices

- **Be specific**: Pass the user's full question as the query
- **Version awareness**: Use version-specific library IDs when available
- **Prefer official sources**: Official packages over community forks
- **No sensitive data**: Redact secrets from queries sent to Context7
