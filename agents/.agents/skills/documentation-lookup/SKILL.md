---
name: documentation-lookup
description: Use up-to-date library and framework docs via Context7 MCP instead of training data. Activates for setup questions, API references, code examples, or when the user names a framework (e.g. FastAPI, Tokio, Nim's std/httpclient).
---

# Documentation Lookup (Context7)

When the user asks about libraries, frameworks, or APIs, fetch current documentation via the Context7 MCP (tools `resolve-library-id` and `query-docs`) instead of relying on training data.

## Core Concepts

- **Context7**: MCP server that exposes live documentation; use it instead of training data for libraries and APIs.
- **resolve-library-id**: Returns Context7-compatible library IDs (e.g. `/tiangolo/fastapi`) from a library name and query.
- **query-docs**: Fetches documentation and code snippets for a given library ID and question. Always call resolve-library-id first to get a valid library ID.

## When to use

Activate when the user:

- Asks setup or configuration questions (e.g. "How do I configure a Tokio runtime?")
- Requests code that depends on a library ("Write a SQLAlchemy query for...")
- Needs API or reference information ("What are Nim's asyncdispatch methods?")
- Mentions specific frameworks or libraries (FastAPI, Django, Tokio, Serde, Nim's std/httpclient, etc.)

Use this skill whenever the request depends on accurate, up-to-date behavior of a library, framework, or API. Applies across harnesses that have the Context7 MCP configured (e.g. Claude Code, Cursor, Codex).

## How it works

### Step 1: Resolve the Library ID

Call the **resolve-library-id** MCP tool with:

- **libraryName**: The library or product name taken from the user's question (e.g. `FastAPI`, `Tokio`, `Nim`).
- **query**: The user's full question. This improves relevance ranking of results.

You must obtain a Context7-compatible library ID (format `/org/project` or `/org/project/version`) before querying docs. Do not call query-docs without a valid library ID from this step.

### Step 2: Select the Best Match

From the resolution results, choose one result using:

- **Name match**: Prefer exact or closest match to what the user asked for.
- **Benchmark score**: Higher scores indicate better documentation quality (100 is highest).
- **Source reputation**: Prefer High or Medium reputation when available.
- **Version**: If the user specified a version (e.g. "Django 5", "Tokio 1.x"), prefer a version-specific library ID if listed (e.g. `/org/project/v1.2.0`).

### Step 3: Fetch the Documentation

Call the **query-docs** MCP tool with:

- **libraryId**: The selected Context7 library ID from Step 2 (e.g. `/tiangolo/fastapi`).
- **query**: The user's specific question or task. Be specific to get relevant snippets.

Limit: do not call query-docs (or resolve-library-id) more than 3 times per question. If the answer is unclear after 3 calls, state the uncertainty and use the best information you have rather than guessing.

### Step 4: Use the Documentation

- Answer the user's question using the fetched, current information.
- Include relevant code examples from the docs when helpful.
- Cite the library or version when it matters (e.g. "In FastAPI 0.115...").

## Examples

### Example: FastAPI request validation (Python)

1. Call **resolve-library-id** with `libraryName: "FastAPI"`, `query: "How do I validate request bodies with Pydantic models?"`.
2. From results, pick the best match (e.g. `/tiangolo/fastapi`) by name and benchmark score.
3. Call **query-docs** with `libraryId: "/tiangolo/fastapi"`, `query: "How do I validate request bodies with Pydantic models?"`.
4. Use the returned snippets to answer; include a minimal `POST` endpoint with a Pydantic `BaseModel` from the docs if relevant.

### Example: Serde JSON serialization (Rust)

1. Call **resolve-library-id** with `libraryName: "Serde"`, `query: "How do I serialize and deserialize JSON in Rust?"`.
2. Select the official Serde library ID (e.g. `/serde-rs/serde`).
3. Call **query-docs** with that `libraryId` and the query.
4. Return the `#[derive(Serialize, Deserialize)]` pattern with `serde_json::from_str` / `to_string` examples from the docs.

### Example: Nim async HTTP client

1. Call **resolve-library-id** with `libraryName: "Nim"`, `query: "How do I make async HTTP requests in Nim?"`.
2. Pick the Nim standard library docs ID (e.g. `/nim-lang/Nim`).
3. Call **query-docs**; summarize `std/httpclient` with `asyncdispatch` patterns and show minimal code from the fetched docs.

## Best Practices

- **Be specific**: Use the user's full question as the query where possible for better relevance.
- **Version awareness**: When users mention versions, use version-specific library IDs from the resolve step when available.
- **Prefer official sources**: When multiple matches exist, prefer official or primary packages over community forks.
- **No sensitive data**: Redact API keys, passwords, tokens, and other secrets from any query sent to Context7. Treat the user's question as potentially containing secrets before passing it to resolve-library-id or query-docs.
