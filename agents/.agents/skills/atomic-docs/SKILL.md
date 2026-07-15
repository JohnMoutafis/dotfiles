---
name: atomic-docs
description: Splits monolithic project documentation into atomic one-topic-per-file markdown files organized in a categorized docs/ tree with an index-only README, so humans and AI coding assistants get focused context instead of a novel. Use when the user mentions atomic docs, asks to split or restructure a README or docs folder, wants AI-friendly project documentation, or asks to update, add, or generate documentation (e.g. API reference from docstrings) in a project using this style.
disable-model-invocation: false
---

# Atomic Docs

One concern, one file. Focused markdown files live in a categorized `docs/` tree; the README is an index. Handing an AI assistant the one relevant file primes it with exactly the context the task needs.

## Step 0 — Detect Existing Atomic Docs

A project is already atomic when all hold:

- A docs directory (`docs/`, `doc/`, …) contains several small markdown files, each covering exactly one topic
- An index (root or docs `README.md`) links those files
- No remaining monolithic doc duplicates their content

Any taxonomy counts (lenient). If atomic, go straight to step 6.

## Step 1 — Create Infrastructure

Propose the default taxonomy and confirm via the harness `ask` tool before creating anything; honor a custom structure if the user prefers one:

```text
docs/
├── contributing/   # setup, linting, local dev workflow
├── collaboration/  # process: definition of done, working agreements
├── patterns/       # testing strategy, service patterns, conventions
├── adrs/           # architecture decision records
└── api/            # API reference: generated from docstrings, or handwritten
```

No `ask` tool available: state the chosen structure explicitly, then proceed. `docs/api/` holds the API reference — generated from docstrings (record the generator command in `contributing/setup.md`) or maintained by hand; it is exempt from the atomic one-topic-per-file rule.

## Step 2 — Transform Non-Atomic Docs

For each multi-topic doc (README > ~150 lines, CONTRIBUTING, wikis):

1. Map each section to a target atomic file; show the mapping to the user.
2. Split content into the mapped files. Keep facts, commands, examples; drop transitions ("as mentioned above").
3. Once the user approves, delete the originals. Git preserves history; never leave duplicate sources behind.

## Step 3 — Author Atomic Files

Every file:

- Covers exactly one topic; the title states it (`# Testing Strategy`)
- Is self-contained: links related files by path instead of repeating them
- Is concrete: real commands, real examples, no filler prose
- Stays short: aim under 80 lines; when it grows, split off the next concern

## Step 4 — README Becomes an Index

One sentence on what the project does, then grouped links. Nothing else ever migrates back in:

```markdown
# Project Name

One-sentence description.

## Documentation

### Getting started
- [Local setup](docs/contributing/setup.md)
- [Development workflow](docs/contributing/workflow.md)

### Patterns
- [Testing strategy](docs/patterns/testing.md)

### Decisions
- [ADRs](docs/adrs/)

### Reference
- [API](docs/api/)
```

## Step 5 — CONTRIBUTING, AGENTS.md, and Peers

Update `CONTRIBUTING.md`, `AGENTS.md`, `CLAUDE.md`, and similar files with a section of at most 10 lines: what atomic docs are, the tree layout, and the rule "before doing X, read `docs/<category>/<topic>.md`". Link, don't embed — agent files stay minimal.

## Step 6 — Augment Documentation on Request

In an atomic project, route every doc request through the convention:

- New concern → new file in the fitting category, then add it to the README index
- Existing concern → edit only that file
- `docs/api/`: generated files → update the source docstrings, re-run the generator; handwritten files → edit them directly
- Never let the README grow past an index; refuse "misc" dumping grounds
- While coding, read the relevant atomic file first and follow it

## Anti-Patterns

- Category files holding many concerns ("misc.md", "general.md")
- Prose explaining why the docs exist
- Content duplicated between index and files
- Transformed originals left in place next to their atomic replacements
