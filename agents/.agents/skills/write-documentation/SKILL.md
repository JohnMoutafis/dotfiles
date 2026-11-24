---
name: write-documentation
description: Write project documentation in the user's direct, no-nonsense style — a general documentation page plus an optional API reference and optional flow diagrams, always in Markdown. Use when asked to write, restructure, or expand documentation (module docs, README, API reference, flow diagrams) or when the user mentions the "write-documentation" style.
---

# Write documentation

Write documentation the way the user writes: short declarative sentences, bullets
over prose, zero flowery filler. The style rules in [STYLE.md](STYLE.md) are the
most important part of this skill — they outrank everything below. When in doubt,
re-read them.

## Workflow

1. **Scope the subject.** Identify what the page documents and its audience.
   Gather facts from the source (code, ADRs, existing docs) before writing a
   word. Never invent an endpoint, status, limit, field, or error code — every
   specific in the page must be verifiable against the source.
2. **Ask which parts.** Before writing, ask via the `ask` tool:
   - Include an API reference section? (yes / no)
   - Include flow diagrams? (yes / no)
   Only ask when not already answered in the user's request.
3. **Write** the page following [STYLE.md](STYLE.md) and the structure below.
4. **Verify** before delivering:
   - every mermaid diagram parses (test with the mermaid version the target
     platform uses, not just any parser);
   - every endpoint, status value, limit, and error code matches the source;
   - no flowery phrasing survived — scan for the "Never" list in STYLE.md.

## Page structure

General documentation page, sections in this order (drop what doesn't apply,
never reorder):

1. `# Title` — then a 2–4 sentence overview: what this is, end to end.
2. `## Purpose` — the 2–4 shaping rules as numbered bold-lead-in paragraphs.
3. `## Actors` or `## Terms` — table.
4. `## Lifecycle` — one mermaid `flowchart TD`, then `### Stage by stage` with
   one bold-lead-in paragraph per stage (`**N · Name.**`).
5. `## Status reference` — table (Stage | Field | Values).
6. `## Formats and limits` — table with exact values.
7. `## Access control` — numbered list of gate conditions, then a short
   scoping paragraph.
8. `## Glossary` — table (Term | Definition), bold terms, one-sentence
   definitions.

API reference (when requested) — shape depends on the interface:

- **HTTP API**: a `## Conventions` section first — authentication, visibility
  as a caller→sees table, the response envelope
  (`{"status": "success", ...}` / `{"status": "error", "message": "..."}`),
  pagination, and common error codes not repeated per endpoint. State the
  invisible-resource rule as its own sentence after the visibility table
  ("An invisible resource is a `404`, never a `403`"). Then one
  `## METHOD /path/` section per endpoint — see STYLE.md for the fixed
  internal order.
- **Non-HTTP API** (library, SDK, CLI, internal service): one
  `## method_name()` section per method — signature, an arguments table
  (name | type | description), the return value, **at least one usage
  example**, and failure behavior (exceptions, error values). No curl, no
  envelope, no status-code tables; the example is runnable against the real
  signature.

Flow diagrams (when requested): an intro of one sentence ending in a colon,
then a bullet list of the alternative paths the diagrams cover; then one
`sequenceDiagram` per step with alternatives drawn into the same chart
(`alt`/`else`), bullet takeaways after each diagram. No legend, no "how to
read these" block, no diagrams index table — the notation is `->>` call,
`-->>` return, `Note over` side effect, `alt`/`else` branch; if a diagram
needs a non-obvious convention explained, one bullet after it does that.

## Hard rules

- Markdown only. No HTML except `<br/>` inside diagram labels.
- Bullets for steps, branches, and sub-explanations. Prose only for 1–3
  sentence statements of fact.
- Any enumeration of 3+ parallel items is a table.
- No time-sensitive info, no file paths, no commit hashes, no git talk, no
  meta talk about the document itself.
- Cross-references to sibling pages are bare page-name mention lines, grouped
  as a bullet list right under the title (`- Documentation: Uploads`) — not
  markdown links. Match the target platform's convention when one exists.
