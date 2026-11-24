# subagents

Delegate assignments to subagents that run in isolated context windows.

## Agents

| Name     | Role | Model |
|----------|------|-------|
| `task`   | Does one assignment directly. Default agent. | Inherits the dispatching session's model and thinking level |
| `worker` | Plans into a TODO (up to two nesting levels), dispatches every part to `task` subagents in parallel batches, verifies each deliverable, runs a final build/test pass. Implements nothing itself. TODO items carry IDs (`Item N` / `Sub-item N.M`) and every dispatch brief starts with the ID(s) it covers. | Inherits, unless overridden |

Agent definitions are markdown files in `agents/` with frontmatter:

```yaml
---
name: my-agent
description: One line for the tool description.
model: provider/model-id     # optional; omit to inherit the session model
thinking: high               # optional; omit to inherit the session thinking level
tools: read, bash            # optional; omit for the default toolset
---
System prompt body.
```

A file in `~/.pi/agent/agents/` with the same `name` overrides a bundled definition.

## Settings

```json
"subagents": { "worker": { "concurrency": 3 } }
```

`concurrency` caps simultaneous task subagents per dispatch (a worker's fan-out
and the tool's `tasks` array). Default: 3.

## Spawn rules

Enforced with the `PI_SUBAGENT_ROLE` env var, set on each child process:

- Normal session: any discovered agent; omitted `agent` defaults to `task`.
- Worker child: may spawn only `task`.
- Task child: the `subagent` tool is not registered, so it cannot spawn.

## Tool

- Single: `{ agent?: "task", task: "..." }`
- Parallel: `{ tasks: [{ agent?: "task", task: "..." }, ...] }` (max 8)
