---
name: serena
version: "1.3"
last_updated: 2026-05-27
tags: [serena, usage, workflow, automation, guidance]
description: "Serena MCP for project memory and code navigation. Use when managing Serena memories, navigating symbols, performing intelligent refactoring, or maintaining context/continuity across AI agent sessions."
---

# Serena Usage

Effective usage of the Serena MCP Server for project memory management, code intelligence, and maintaining continuity across AI agent sessions.

- Leverage native parallel subagent dispatch and 200k+ context windows where available.


## Activation Conditions

Use symptom -> action triggers: when one matches, apply this skill and verify with the protocol below.

**MUST activate when:**
- Serena is available for the project
- Task requires project memory continuity
- Task requires symbol navigation or Serena refactoring workflow
- Managing project memories for AI session continuity
- Navigating codebases using symbol-based tools
- Performing code refactoring with Serena's symbol management
- Setting up Serena onboarding for new projects
- Using Serena's memory system for project context preservation

**Critical: Always verify project activation FIRST with `get_current_config` before any Serena operations**

## Prerequisites

- Serena MCP Server configured and running
- Project activated (use `get_current_config` to verify, or `activate_project` if not activated)
- Onboarding completed for the target project (use `check_onboarding_performed` first)
- If not activated, run `activate_project` with project name or path
- If not onboarded, run `onboarding` tool after activation

---

## Onboarding Workflow

### First-Time Project Setup
1. **Check activation**: Call `get_current_config` to verify if project is activated
2. **Activate if needed**: If not activated, call `activate_project` with project name or path
3. **Check onboarding**: Call `check_onboarding_performed` to verify onboarding status
4. **Read manual**: If not onboarded, call `initial_instructions` to read the Serena Instructions Manual
5. **Initialize**: Call `onboarding` to complete project setup
6. Serena analyzes the project structure and creates initial context

### What Onboarding Captures
- Project language and framework detection
- Directory structure analysis
- Key file identification
- Symbol index creation
- Initial memory scaffolding

### Activation Check Pattern
```bash
# Always verify activation first
get_current_config
# If no active project, activate it
activate_project project="path/to/project"
# Then proceed with onboarding check
check_onboarding_performed
```

## Project Activation

### Why Activation Matters
Project activation is the first step when working with Serena. It tells Serena which project to work with and initializes the workspace context.

### Activation Workflow
1. **Check current status**: Call `get_current_config` to see if a project is already activated
2. **Activate if needed**: If no active project, call:
   ```
   activate_project project="project-name"
   # OR with path:
   activate_project project="path/to/project/directory"
   ```
3. **Verify activation**: Call `get_current_config` again to confirm activation succeeded
4. **Proceed with onboarding**: Once activated, check if onboarding is needed

### Activation Best Practices
- Always check `get_current_config` before attempting any Serena operations
- Use the workspace root path when activating
- Activation is session-specific — you may need to reactivate in new sessions
- After activation, the project context is available for all subsequent Serena operations

---

## Memory Management

### Core Concepts
Serena memories persist between sessions, providing continuity for AI agents across work sessions.

### Memory Operations

| Operation | Tool | Purpose |
|-----------|------|---------|
| List all | `list_memories` | See available memories |
| Read one | `read_memory` | Access specific memory content |
| Create | `write_memory` | Store new information |
| Update | `edit_memory` | Modify existing memory |
| Remove | `delete_memory` | Clean up obsolete information |

### Memory Structure

Serena memories use the Memory Bank naming convention for consistency and clarity. This structure organizes project intelligence into core files and tasks.

#### Core Files

| Memory Name | Purpose |
|-------------|---------|
| `project-brief` | Foundation document defining core requirements and goals. Shapes all other memories. Created at project start. |
| `product-context` | Why this project exists, problems it solves, how it should work, and user experience goals |
| `active-context` | Current work focus, recent changes, and next steps with active decisions and considerations |
| `system-patterns` | System architecture, key technical decisions, design patterns in use, and component relationships |
| `tech-context` | Technologies used, development setup, technical constraints, and dependencies |
| `progress` | What works, what's left to build, current status, and known issues |

#### Task Management Memories

Tasks are managed with dedicated memory files for tracking progress and history.

| Memory Name | Purpose |
|-------------|---------|
| `task-{id}` | Individual task tracking (e.g., TASK001-implement-login.md) with original request, thought process, implementation plan, and progress logs |
| `task-index` | Master list of all tasks with IDs, names, statuses (Pending/In Progress/Completed/Abandoned), and last updated dates |

#### Task Memory Structure

Each task memory follows this format:

```markdown
# [Task ID] - [Task Name]

**Status:** [Pending/In Progress/Completed/Abandoned]
**Added:** [Date Added]
**Updated:** [Date Last Updated]

## Original Request
[The original task description as provided by the user]

## Thought Process
[Documentation of the discussion and reasoning that shaped the approach]

## Implementation Plan
- [Step 1]
- [Step 2]
- [Step 3]

## Progress Tracking

**Overall Status:** [Not Started/In Progress/Blocked/Completed] - [Completion Percentage]

### Subtasks
| ID | Description | Status | Updated | Notes |
|----|-------------|--------|---------|-------|
| 1.1 | [Subtask description] | [Complete/In Progress/Not Started/Blocked] | [Date] | [Relevant notes] |

## Progress Log
### [Date]
- Updated subtask 1.1 status to Complete
- Started work on subtask 1.2
- Encountered issue with [specific problem]
- Made decision to [approach/solution]
```

#### Task Index Structure

The task-index memory maintains a structured record:

```markdown
# Tasks Index

## In Progress
- [TASK003] Implement user authentication -Working on OAuth integration
- [TASK005] Create dashboard UI -Building main components

## Pending
- [TASK006] Add export functionality -Planned for next sprint

## Completed
- [TASK001] Project setup -Completed on 2025-03-15
- [TASK002] Create database schema -Completed on 2025-03-17
```

#### Commands

When you request **add task** or **create task**, the agent will:
1. Create a new task memory with a unique Task ID
2. Document the thought process about the approach
3. Develop an implementation plan
4. Set an initial status
5. Update the task-index memory

To view tasks, the command **show tasks [filter]** will display filtered lists with valid filters:
- **all** - Show all tasks regardless of status
- **active** - Show only "In Progress" tasks
- **pending** - Show only "Pending" tasks
- **completed** - Show only "Completed" tasks
- **blocked** - Show only "Blocked" tasks
- **recent** - Show tasks updated in the last week

### When to Update Memories

**Update core memories when:**
- After completing significant features or functionality
- When making architectural decisions
- Discovering new project patterns or conventions
- Changing technical stack or dependencies
- Modifying data models or schemas
- At the start and end of each work session

**Update task memories when:**
- Creating new tasks via "create task" command
- Making progress on existing tasks
- Completing subtasks or entire tasks
- Encountering blockers or issues
- Changing task status (Pending → In Progress → Completed/Abandoned)

### Memory Creation Workflow

**CRITICAL: ALWAYS check for relevant existing memories before creating new ones**

#### Step-by-Step Process

1. **List available memories**: Use `list_memories` to see all existing memories
2. **Analyze relevance**: Identify if any existing memory covers the same topic/concept
3. **Check memory content**: If relevant memories found, use `read_memory` to examine their content
4. **Match criteria**:
   - Same feature/technology/topic domain
   - Overlapping purpose or scope
   - Related architectural decisions
   - Similar problem space or concern
5. **Decision**:
   - **IF relevant memory exists**: Update the existing memory using `edit_memory` with new information and current timestamp
   - **IF no relevant memory exists**: Create new memory using `write_memory`

#### Matching Guidelines

A new memory entry is relevant to an existing memory if:

| Criteria | Example |
|----------|---------|
| Same feature area | "api-features" already covers endpoints → add new endpoint details to it |
| Same technology | "auth-context" already covers authentication → add new auth implementation to it |
| Related architecture | "system-patterns" covers architecture decisions → add new architectural choices to it |
| Same domain concern | "data-model" covers schema design → add new model specs to it |
| Project-wide update | "project-overview" covers overall status → add general project updates to it |

#### Update Pattern for Existing Memories

When updating existing memories, follow this structure:

```markdown
## {Topic} — Updated [YYYY-MM-DD HH:MM]

### [Date] - Update
- [New information or decision]
- [Implementation details or findings]
- [Related changes or impacts]
- [Next actions or considerations]

### Previous Context
[Preserve existing relevant information]
```

#### Examples of Memory Consolidation

**Scenario 1: Adding new API endpoint specs**
```
Existing: api-features.md (500 bytes)
New info: New rate-limiting middleware specs
Action: Update api-features.md with new section, update timestamp
```

**Scenario 2: Fixing a serialization bug**
```
Existing: serde-fixes-2026-03-10.md
New info: Another deserialization edge case in the same module
Action: Update serde-fixes-2026-03-10.md, add new fix details, update timestamp
```

**Scenario 3: New authentication implementation detail**
```
Existing: auth-context.md
New info: Token refresh flow specifics
Action: Update auth-context.md with new implementation section, update timestamp
```

**Scenario 4: New performance fix for a different subsystem**
```
Existing: serde-fixes-2026-03-10.md (deserialization panics)
New info: Connection-pool tuning (different topic)
Action: Create NEW memory: pool-tuning-2026-03-16.md
```

#### When to Create New Memories

Create a NEW memory only when:

- **Different domain**: Topic is fundamentally different from existing memories
- **Major milestone**: New phase or significant project shift
- **New technology stack**: Unrelated to existing technical context
- **Time-based tracking**: Fix memories, daily updates, or dated logs
- **Overwhelming size**: Existing memory would exceed 5-10 KB with additions

**Examples of when to create new memories:**
```
Existing: api-features.md
New: Performance profiling reports → Create NEW: performance-analysis.md

Existing: data-model.md
New: Database migration strategy → Create NEW: migration-strategy.md

Existing: serde-fixes-2026-03-10.md (deserialization edge cases)
New: Tokio runtime tuning → Create NEW: runtime-tuning-2026-03-16.md
```

### Memory Bank Documentation Guidelines

The Serena memories follow the Memory Bank structure for comprehensive project intelligence. Key guidelines:

**Task Progress Updates:**
- Always update both the subtask status table AND the progress log when making progress
- The subtask table provides quick visual reference of current status
- The progress log captures the narrative and details of the work process
- Each progress log entry should include date, accomplishments, challenges, and decisions
- Update task status in `task-index` to reflect current progress

**Documentation Flow:**
```
New Task → Create task-{id}.py memory → Update task-index
Progress → Update task-{id}.py log table → Update task-index
Discovery → Create/update appropriate core memory
Architecture Decision → Update system-patterns memory
Completion → Update progress memory → Clear from active tasks
```

**Active-Context Format:**
```markdown
## Active Context — Updated [Date]

### Current Focus
- Implementing user authentication with FastAPI + JWT
- Building async data pipeline with Tokio channels

### Recent Decisions
- Chose PostgreSQL + SQLAlchemy over raw queries for maintainability
- Using Nim's `asyncdispatch` for the background worker

### Blockers
- Rate-limiting strategy needs benchmarking before finalizing

### Next Steps
1. Complete login/signup endpoints
2. Add Pydantic validation schemas
3. Set up `#[tokio::test]` integration suite
```

### Memory Writing Guidelines

Use the same Active Context format shown above. Prefer concrete, actionable items over vague descriptions. Include version/tooling specifics (e.g. "FastAPI 0.115", "Tokio 1.x", "Nim 2.0") when they matter.

---

## Code Navigation

### Symbol-Based Navigation

| Tool | Use Case |
|------|----------|
| `find_symbol` | Locate specific classes, functions, variables by name path |
| `find_referencing_symbols` | Find all usages of a symbol across the codebase |
| `get_symbols_overview` | High-level summary of symbols in a file |

### Navigation Workflow
1. Use `get_symbols_overview` on a file to understand its structure
2. Use `find_symbol` to locate a specific definition
3. Use `find_referencing_symbols` to understand impact before changes

---

## Code Refactoring

### Safe Refactoring with Serena

| Tool | Operation |
|------|-----------|
| `rename_symbol` | Rename across all references |
| `replace_symbol_body` | Replace implementation of a function/method |
| `insert_after_symbol` | Add new code after a definition |
| `insert_before_symbol` | Add new code before a definition |

### Refactoring Workflow
1. **Understand**: Use `find_symbol` and `get_symbols_overview`
2. **Assess Impact**: Use `find_referencing_symbols` to see all usages
3. **Plan**: Think through the changes needed
4. **Execute**: Use rename/replace/insert tools
5. **Verify**: Re-check references to confirm correctness
6. **Document**: Update memories with the change rationale

---

## File Search

| Tool | Purpose |
|------|---------|
| `find_file` | Locate files matching a name pattern |
| `list_dir` | Browse directory contents |
| `search_for_pattern` | Search for text/regex patterns across codebase |

---

## Task Adherence

Serena provides reflection tools to maintain focus:

| Tool | When to Use |
|------|------------|
| `think_about_collected_information` | After gathering context — is it sufficient? |
| `think_about_task_adherence` | After many interactions — am I still on track? |
| `think_about_whether_you_are_done` | Before concluding — have I completed everything? |

---

## Session Workflow

### Starting a Session
1. **Verify activation**: `get_current_config` → check if project is activated
2. **Activate if needed**: If no active project, `activate_project` → activate the workspace
3. **Check onboarding**: `check_onboarding_performed` → verify onboarding status
4. Complete onboarding if needed using onboarding workflow
5. `list_memories` → review all available project memories
6. `read_memory` → load relevant memories for current work phase:
   - **Always:** Read `project-overview` (current status, tech stack, next steps)
   - **Feature work:** Read the relevant feature memory (e.g. `api-features`, `auth-context`)
   - **Bug fixing:** Read any dated fix memories covering the affected subsystem
   - **Architecture changes:** Read `system-patterns` for existing design decisions
7. Begin work with current phase context

### During a Session
- **Bug fixing:** Check if `{topic}-fixes-{date}.md` exists → update OR create new memory
- **Feature implementation:** Check if `{feature-name}.md` exists → update OR create new memory
- **Milestone completion:** Update `project-overview.md` with new status and current timestamp
- **Code navigation:** Use symbol tools (`find_symbol`, `find_referencing_symbols`) to explore the codebase
- **NEW information flow:**
  1. Use `list_memories` to review all existing memories
  2. Identify if any existing memory covers the topic
  3. If relevant memory exists: Use `edit_memory` with new information + updated timestamp
  4. If no relevant memory: Use `write_memory` to create new memory

---

## Best Practices

- **ALWAYS check activation before any Serena operations using `get_current_config`**
- **ALWAYS check for relevant existing memories with `list_memories` before creating new ones**
- **CRITICAL: Use `edit_memory` to update existing memories with new timestamp rather than creating duplicates**
- Activate project first if not already activated using `activate_project`
- Check onboarding after activation, before first use on a project
- Keep memories concise — prefer structured data over prose
- Update memories incrementally, not in bulk rewrites
- Use consistent naming for memories across projects (Memory Bank convention)
- Leverage `think_about_*` tools for self-reflection on complex tasks
- For task tracking: Always update both subtask table AND progress log in task memories
- Keep `task-index` synchronized with task memory status changes
- Delete obsolete memories to prevent confusion
- Use task IDs from `task-index` as reference when discussing work
- When adding information to existing memories, update timestamp to YYYY-MM-DD HH:MM format

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Project not activated | Run `get_current_config` to verify, then `activate_project` with project path |
| Onboarding not detected | After activation, run `onboarding` tool explicitly |
| Memory not found | Check exact name with `list_memories` |
| Symbol not found | Ensure file is indexed; try broader name |
| Stale memories | Use `edit_memory` to update with current state and timestamp |
| Conflicting memories | Delete outdated entry, merge into single memory with consolidated content |
| Duplicate memories | Avoid by ALWAYS checking `list_memories` before creating new ones; use `edit_memory` to update existing |
| Unsure which memory to update | Use `list_memories` → review purpose of each → read relevant memories → update the most appropriate one |

---

## Anti-Patterns

- Starting without a clear success condition: The skill becomes advice-shaped instead of workflow-shaped.
- Skipping the bundled references or scripts: You lose the proven path the catalog is trying to preserve.
- Claiming completion without concrete evidence: A future agent or reviewer cannot trust the result or resume the work safely.

## Verification Protocol

Before claiming "skill applied successfully":

1. Pass/fail: The Serena Usage workflow names the agent boundary, delegated scope, and expected return artifact.
2. Pass/fail: Context passed to helpers is minimal, task-local, and free of hidden expected answers.
3. Pass/fail: Results are integrated only after evidence, diffs, or citations are checked by the controller.
4. Pressure-test scenario: Run the workflow on two similar tasks that must not share assumptions or leaked context.
5. Success metric: Zero context leakage; every delegated output is independently reviewable.

---

## References & Resources

### Documentation
- [Memory Management](./references/memory-management.md) — Memory naming conventions, lifecycle, and maintenance best practices
- [Symbol Navigation](./references/symbol-navigation.md) — find_symbol and find_referencing_symbols patterns and workflows

### Scripts
- [Memory Backup](./scripts/serena-memory-backup.ps1) — PowerShell script to backup Serena memory files with timestamps

### Examples
- [Refactoring Workflow](./examples/refactoring-workflow.md) — 13-step refactoring walkthrough using Serena tools

---

## Memory Update vs Creation Quick Reference

### Decision Tree

```
Need to store information?
│
├─ Check: `list_memories`
│  │
│  ├─ Existing memory covers this topic?
│  │  │
│  │  ├─ YES → Use `edit_memory` with new info + updated timestamp
│  │  │
│  │  └─ NO → Use `write_memory` to create new memory
│  │
│  └─ Proceed with work
```

### Edit Memory Pattern

```bash
# Always use this format when updating existing memories
edit_memory(
  memory_file_name="existing-memory-name",
  needle="section or content to replace or append after",
  repl="new information with timestamp:\n\n## [Section] — Updated YYYY-MM-DD HH:MM\n\n- [new info]",
  mode="literal" # or "regex" as appropriate
)
```

---

<!-- MCP:START -->
## MCP Availability And Fallback

Preferred MCP Server: Serena MCP

- Fallback prompt: "Use the Serena Usage skill without MCP. Rely on the local `SKILL.md`, bundled references or scripts, and manual verification. Show the exact commands, evidence, and final checks you used before concluding."
- Use `rg`, `git diff`, targeted file reads, and local Markdown memory files when Serena is unavailable.
- Keep a lightweight Memory Bank in repo docs or notes so project continuity still survives across sessions.

<!-- MCP:END -->
