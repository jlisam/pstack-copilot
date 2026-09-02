---
name: setup-pstack
description: Configure which models and reasoning efforts pstack uses per role. Detects supported task values and atomically writes the global Copilot CLI pstack model configuration.
---

# Setup pstack

Write `~/.copilot/instructions/pstack-models.instructions.md`. Pstack skills read this file as an override layer and use their inline defaults when a role is absent.

## 1. Detect supported task values

Inspect the active `task` tool schema. Treat the schema's `model` choices and each model's supported `reasoning_effort` values as authoritative. Do not infer entitlement from model marketing names and do not probe by launching disposable tasks.

Build the allowed set as `MODEL@EFFORT` pairs. `inherit-parent` and `auto` are always valid aliases. Both aliases mean the caller omits task `model` and `reasoning_effort`.

If the task schema exposes no models, follow [User decisions](../poteto-mode/references/task-contract.md#user-decisions). Use `ask_user` when available. Otherwise ask one concise plain-text question with these same numbered choices and end the turn:

1. Configure every role as `inherit-parent`.
2. Abort and retry in a session whose task schema exposes models.

Do not ask the user to invent model slugs. Offer only detected choices.

## 2. Load current state

Start from the defaults below. If `~/.copilot/instructions/pstack-models.instructions.md` exists, parse its role lines and use recognized values as the current choices. Preserve no unknown role silently. Report unknown roles and leave them out of the rewritten file unless the user explicitly chooses to keep a newly supported role.

## 3. Confirm choices

Show every role and its current value. Mark values that fail validation.

Follow [User decisions](../poteto-mode/references/task-contract.md#user-decisions). Use `ask_user` when available. Otherwise ask one concise plain-text question with these same numbered choices and end the turn:

1. Accept every valid value and repair only invalid roles.
2. Choose roles to change.
3. Reset all roles to defaults.
4. Set all roles to `inherit-parent`.
5. Abort without writing.

For changed roles, use follow-up `ask_user` calls when available. Populate them from the detected `MODEL@EFFORT` pairs plus `inherit-parent` and `auto`. Otherwise ask one concise plain-text question per role with the same numbered choices and end each turn. Panel roles accept an ordered list, one task per entry. The panel roles are `how critics`, `arena runners`, `arena cross-judge pool`, `architect runners`, and `interrogate reviewers`.

## 4. Validate

Validate every scalar and every comma-separated panel entry.

- `inherit-parent` and `auto` pass as standalone values.
- Every other value contains exactly one `@`.
- Split at `@`; the left side is a detected task model and the right side is a supported effort for that model.
- Empty model or effort pieces fail.
- Whitespace around a list entry is ignored; whitespace inside `MODEL@EFFORT` fails.
- Empty panel entries fail.

If anything fails, return to the same choice flow under [User decisions](../poteto-mode/references/task-contract.md#user-decisions). Use `ask_user` when available. Otherwise ask one concise plain-text question with numbered repair choices and end the turn. Never write a partially valid configuration.

## 5. Write atomically

Create `~/.copilot/instructions` if needed. Render the complete file to a sibling staging path such as `pstack-models.instructions.md.new.$$`, validate the rendered contents again, set mode `0600`, then rename it over the target with `mv`. The staging file and target must be in the same directory so the rename is atomic. Remove the staging file on failure.

Write this shape:

```markdown
---
description: pstack per-role model choices
applyTo: "**"
---
# pstack model configuration
# Values are MODEL@EFFORT. `inherit-parent` and `auto` omit both task fields.
feature, refactoring: grok-4.6@high
bug-fix: gpt-5.6-sol@max
perf-issue: gpt-5.6-sol@max
hillclimb: gpt-5.6-sol@max
judgment and prose: claude-opus-5@max
hardest tasks: claude-opus-5@max
how explorer: grok-4.6@high
how explainer: claude-opus-5@max
how critics: claude-opus-5@max, gpt-5.6-sol@max, grok-4.6@xhigh, claude-sonnet-5@high
why investigators: grok-4.6@high
why synthesizer: claude-opus-5@max
reflect tooling: gpt-5.6-sol@max
reflect judgment, divergent, synthesizer: claude-opus-5@max
arena runners: claude-opus-5@max, gpt-5.6-sol@max, grok-4.6@xhigh, claude-sonnet-5@high
arena cross-judge pool: claude-opus-5@max, gpt-5.6-sol@max, grok-4.6@xhigh, claude-sonnet-5@high
swarm workers: grok-4.6@high
architect runners: claude-opus-5@max, gpt-5.6-sol@max, grok-4.6@xhigh, claude-sonnet-5@high
interrogate reviewers: claude-opus-5@max, gpt-5.6-sol@max, grok-4.6@xhigh, claude-sonnet-5@high
```

Keep the labels and order exactly as shown. Replace only the values selected by the user.

## 6. Confirm

Report the target path, whether defaults or overrides were written, and any role that uses `inherit-parent` or `auto`. Explain that each pstack task splits `MODEL@EFFORT` into task `model` and `reasoning_effort`.

If the project lacks a project-local verification skill under `.github/skills/verify-*/`, follow [User decisions](../poteto-mode/references/task-contract.md#user-decisions). Use `ask_user` once when available to offer `/create-verification-skill`. Otherwise ask one concise plain-text question with numbered choices to create the skill or finish without it, then end the turn. Invoke the skill only after approval. Do not repeat the offer.
