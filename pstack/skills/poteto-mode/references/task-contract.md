# Copilot task contract

Use this contract for every delegated task in pstack.

## Tool fields

A Copilot task call uses the fields exposed by the active `task` tool schema.
Common fields are:

- `description`: a short action label.
- `prompt`: the complete brief.
- `agent_type`: a built-in agent type listed by the active schema.
- `name`: a short display name.
- `model`: optional model name.
- `reasoning_effort`: optional effort level.
- `context_tier`: optional context tier.
- `mode`: optional `sync` or `background`.

Plugin agents may appear as namespaced values in a new session's active schema. When listed, `pstack-copilot:poteto-agent` and `pstack-copilot:comment-sicko` are valid task agent types. Never guess a plugin agent value that the schema does not expose.

## User decisions

- Inspect the active tool catalog.
- If `ask_user` is available, use it for structured choices.
- Otherwise ask one concise plain-text question with numbered choices and end the turn.
- Never continue through an irreversible action, destructive step, publication, deployment, or unresolved product decision because the structured tool is unavailable.
- Never claim a choice was approved when no answer arrived.

## Complete briefs

Every prompt must stand alone. Include the goal, repository or working path, exact scope, write boundary, relevant file or ref pointers, constraints, acceptance checks, verification commands, and required report shape. A prompt may point at files the child can read, but it must not depend on hidden chat context, a sibling's private result, or an unexplained shorthand.

When downstream work depends on another task, wait for that result and copy the needed findings into the downstream prompt. Siblings cannot be assumed to share context.

## Agent choice

- Use `explore` for read-only codebase discovery and call-chain tracing.
- Use `code-review` for a concrete diff or change-set review.
- Use `task` for command-heavy validation where the useful result is pass or fail.
- Use `research` for source-backed research.
- Use `security-review` only for an explicit security-vulnerability review.
- Use `rubber-duck` for a focused reasoning challenge only when the active schema lists it. Otherwise use `general-purpose` with an explicit no-writes constraint.
- Use `general-purpose` for other multi-step work. For read-only work that does not fit `explore` or `code-review`, state `Do not modify files` in the prompt.
- Use `pstack-copilot:poteto-agent` for a pstack-style implementation delegate when the active schema lists it. Otherwise use `general-purpose` and put the complete pstack constraints in the prompt.
- Use `pstack-copilot:comment-sicko` for the no-comments review when the active schema lists it. Otherwise use the fallback defined by the no-comments skill.

## Models

Read role overrides from `~/.copilot/instructions/pstack-models.instructions.md`. Values are either `MODEL@EFFORT`, `inherit-parent`, or `auto`.

For `MODEL@EFFORT`, split at `@`. Pass the left side as `model` and the right side as `reasoning_effort`. Never pass the combined value as `model`. For `inherit-parent` or `auto`, omit both fields.

If a configured pair is unavailable, re-read the active task tool schema. Use a supported pair for the current run, report the stale configuration, and recommend `/setup-pstack`. Do not silently rewrite the global configuration.

## Concurrency and isolation

The default mode is `sync`. Real fan-out means issuing independent task calls together, then waiting for every result before work depends on them. Do not set `background` merely to obtain parallelism.

Use `background` only when the parent will immediately perform independent work while the child continues. Before consuming the child's output, wait for its completion through the task runtime's result or event notification.

There is no cloud or local environment selector. Give each writer a separate local worktree or branch before spawning it, and put that path in its prompt. Never let concurrent writers share a checkout. Read-only workers may share a checkout.
