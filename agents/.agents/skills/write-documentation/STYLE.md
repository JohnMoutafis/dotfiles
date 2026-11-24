# Style guide

The voice: a senior engineer briefing another senior engineer. Direct, factual,
complete. Every sentence carries a fact; if cutting a sentence loses nothing,
cut it.

## Sentences

- Short and declarative. One idea per sentence; a colon expansion that
  completes the same idea is fine:
  > Its primary key is the **SHA-256 of the file bytes**, which makes content
  > identity and de-duplication the same thing: re-uploading identical bytes
  > from the same user returns the current state rather than creating a second
  > record.
- Bold lead-in for a rule or stage, then 2–4 plain sentences:
  > **1. Parse once, asynchronously.** Every uploaded file is parsed exactly
  > once, immediately after upload, by a background worker. The result is
  > persisted. Reading a preview never re-reads or re-parses the original
  > object.
- State behavior and invariants, never the process of establishing them.
  "Reading a preview never re-parses the original" — not "we made sure that…".
- Contrast with bold: "does **not** re-dispatch anything"; "`completed` means
  *the checks ran*, not *the data passed*".
- No hedging and no filler: "simply", "essentially", "of course", "it's worth
  noting", "interestingly".

## Bullets over prose

- The signature pattern — **state, colon, bullets**: one sentence that names
  the thing, ending in a colon, then the items as bullets:
  > One sequence diagram per step, with the alternative paths:
  >
  > - carrier uploads
  > - auto-approval
  > - rejection
  > - failure
  > - re-queue
- Any explanation with two or more steps, branches, or cases becomes bullets.
- After a diagram or a dense section: bullet takeaways holding only the
  non-obvious facts — invariants, gotchas, deliberate design decisions:
  > - Re-queue is integrity-stage **only**.
  > - The staged Parquet is the whole table of that one sheet, not a projection.
- Sub-expansions nest one level: a bullet, then indented bullets for its cases.
- A deliberate consequence gets its own sentence right after the rule it
  follows from: "A deliberate consequence of rule 2: the module measures
  **what arrived**, never **what was expected**."

## Tables

- Any enumeration of 3+ parallel items is a table: actors, statuses, formats,
  limits, glossary, endpoint fields, error codes.
- Bold the key column cells (`**Shipper**`).
- State exact values, compact with middle dots:
  > **Preview bounds** | 100 rows per sheet · 2,048 characters per cell · 50 sheet names
- Status tables map stage → field → values, one row per stage.

## Diagrams

- Lifecycle: one mermaid `flowchart TD`. Node labels use `<br/>` for line
  breaks; decision nodes are `{}`; branch labels sit on edges
  (`-->|"same user"|`). Keep node text telegraphic — fact, not sentence.
- Flows: one `sequenceDiagram` per step. Alternative paths live in `alt`/`else`
  inside the same chart, never a separate diagram.
- Notes carry the detail: guards, CAS conditions, error codes in square
  brackets, e.g. `[crash-between-save-and-dispatch recovery]`. Compact symbols
  inside notes: `⇒` for "yields", `·` between facts, `│` between alternatives.
- Pin the theme `init` directive at the top of every diagram; keep it when
  editing the body.
- After each diagram: the bullet takeaways (see above).

## API reference

- `## Conventions` first: authentication, visibility (a caller→sees table,
  one row per caller kind), the response envelope, pagination, common error
  codes. Per-endpoint sections never repeat them.
- The invisible-resource rule is its own sentence right after the visibility
  table: "An invisible resource is a `404`, never a `403` — the API does not
  confirm that a record exists to someone who cannot see it."
- Per endpoint, fixed internal order:
  1. `## METHOD /path/`
  2. one dense paragraph: what it does, then gates, scoping, and key
     semantics packed into 2–4 sentences
  3. field table (Field | Type | Required | Description) — only when the
     endpoint takes a body
  4. curl example: `curl "$API/api/v1/.../" -b "sessionid=$SESSION"`
  5. realistic JSON response example
  6. `| Code | Description |` table — every code the endpoint can return
- Code descriptions state the exact condition, bolding the decisive contrast:
  > `200` | These exact bytes were already uploaded **by this user** — the current record is returned, nothing new is created
- Error descriptions state the condition, not the feeling: "`409` | The result
  is already `queued` — a re-run is already pending".
- Example values are realistic and consistent across the whole document (same
  ids, same company names throughout).

## Non-HTTP API reference

For a library, SDK, CLI, or internal service interface. Same voice, different
shape — no HTTP machinery.

- One `## method_name()` section per method, fixed internal order:
  1. `## method_name()`
  2. one dense paragraph: what it does, its key semantics, and any invariant
     callers must respect
  3. signature in a fenced code block, exactly as callable
  4. arguments table (Name | Type | Description), one row per parameter
  5. return value: one sentence stating type and meaning
  6. **at least one usage example** — runnable against the real signature,
     realistic values, consistent across the document
  7. failure behavior: what it raises/returns on bad input, as a short bullet
     list
- Shared behavior across methods (thread-safety, caching, config) goes in a
  `## Conventions` section first, stated once, not repeated per method.

## Never

- Legend and meta sections: no "How to read these", no diagrams index table,
  no "This section describes…". The page starts with content, not instructions
  on how to read it.
- Flowery transitions and narrative glue ("As we can see", "Let's now turn
  to", "Having established").
- Second-person journey narration ("First we…, then we…").
- Unverified specifics: an invented endpoint, status, limit, field, or error
  code is a defect, not a placeholder.
- Meta talk about the document ("This section describes…").
- Marketing adjectives ("powerful", "seamless", "robust").
