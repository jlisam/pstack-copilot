---
name: automate-me
description: "Use for \"automate me\", \"create/update/refresh my -mode skill\", \"turn/capture my preferences or working style into a skill\", or wanting agents to follow how the user works. Drafts or revises a personal one-task mode skill from scoped session evidence and user decisions."
disable-model-invocation: true
---

# Automate me

Turn the user's working conventions into one concise `-mode` skill, such as `jay-mode` or `priya-mode`. A Copilot skill applies to the task that invokes it. Do not promise conversation-wide stickiness; a sticky pstack conversation uses a custom agent selected with `/agent`.

This flow uses scoped session mining, `poteto-mode/playbooks/authoring-a-skill.md`, and the **unslop** skill.

## Flow

### 0. Find an existing skill

Look recursively for matching project skills under `.github/skills/**/*-mode/SKILL.md` and user skills under `~/.copilot/skills/*-mode/SKILL.md`.

When both an update and a fresh start are plausible, follow [User decisions](../poteto-mode/references/task-contract.md#user-decisions). Use `ask_user` when available. Otherwise ask one concise plain-text question with these same numbered choices and end the turn:

1. Update the existing skill.
2. Start fresh.
3. Abort.

In update mode, mine only evidence newer than the skill's last edit. For a tracked project skill, use its last git change. For a user skill, use its file modification time. Preserve sections the user has not contradicted.

### 1. Mine scoped session history

Prefer `session_store_sql`. Query a recent window, normally two to four weeks, filtered to the active repository or cwd before searching turns. Select only needed columns, guard nullable text, use a time bound and limit, and resolve session IDs before reading detailed turns. Never run a broad unrelated-session text scan.

If `session_store_sql` is unavailable, resolve candidate session IDs from active workspace metadata or explicit task, branch, PR, or session references. Read only those sessions' metadata or events under `~/.copilot/session-state/<session-id>/`. Never glob every session directory.

For a small set, mine directly. For a larger scoped set, read [`../poteto-mode/references/task-contract.md`](../poteto-mode/references/task-contract.md) and issue independent `general-purpose` tasks together with explicit no-writes constraints. Use `swarm workers`, default `grok-4.6@high`, split into task fields. Each self-contained prompt gets a disjoint session slice, the workspace and date bounds, and these signals:

- Response length, tone, and format preferences.
- Delegation and parallelism habits.
- What counts as verified or done.
- Code and prose discipline.
- Git, worktree, commit, PR, and review conventions.
- Repeated corrections or manual steps worth encoding.

Require evidence pointers by session ID and turn. Cross-check slices. Promote patterns seen in at least two sessions; treat lone signals as weak unless the user confirms them.

### 2. Collect user decisions

Follow [User decisions](../poteto-mode/references/task-contract.md#user-decisions). Use `ask_user` when available. Otherwise ask one concise plain-text question at a time with numbered choices and end each turn. Start with one category selection covering response style, autonomy, understanding, delegation, verification, code and prose, process, and skill use. Follow with one focused choice set for the selected categories. Use a final `ask_user` free-form field only for anything the options missed. If `ask_user` is unavailable, offer numbered choices for no additions, adding one rule in the reply, or aborting, then end the turn.

For a new skill, follow [User decisions](../poteto-mode/references/task-contract.md#user-decisions) when context does not settle project or user scope. Use `ask_user` when available. Otherwise ask one concise plain-text question with these same numbered choices and end the turn:

- Project scope: `.github/skills/<handle>-mode/SKILL.md`.
- User scope: `~/.copilot/skills/<handle>-mode/SKILL.md`.

### 3. Cluster findings

Use only sections with concrete, non-default rules:

- **Response style**
- **Autonomy**
- **Understand first**
- **Delegation**
- **Prose and code discipline**
- **Review and verify**
- **Process**
- **Skills**

Read the **poteto-mode** skill for granularity, not content. The user's rules are their own.

### 4. Author the skill

Follow `../poteto-mode/playbooks/authoring-a-skill.md`.

- Preserve an existing path when updating.
- For a new skill, use the project or user path chosen in step 2.
- Use YAML frontmatter with only `name` and `description`.
- Trigger on the user's handle, `/<handle>-mode`, and explicit requests to work in their style. Avoid generic triggers such as "write code".
- State that the skill applies to one task.
- Reference other skills rather than copying their bodies.

Apply **unslop** to every line. Show the draft and follow [User decisions](../poteto-mode/references/task-contract.md#user-decisions). Use `ask_user` when available to collect approve, revise, or abort. Otherwise ask one concise plain-text question with those numbered choices and end the turn.

### 5. Validate

Confirm:

- The frontmatter parses and contains non-empty `name` and `description`.
- Every referenced path exists.
- Project and user placement follows the chosen scope.
- No runtime capability is promised that Copilot CLI does not expose.
- Trigger examples select the skill only when explicitly intended.

### 6. Land

For a project skill, work in an isolated branch or worktree, run any repository-provided skill validation, and open a reviewable PR when requested. For a user skill, write the approved file locally and report its path; do not create a repository PR for it.

## Guardrails

- Do not overfit one conversation.
- Do not encode generic advice.
- Keep sections sparse.
- Use "the user" or "the human" in rules.
- Do not invent a custom-agent installation path.
- Do not turn `automate-me` into an alias for an unrelated task-specific skill.

## Reply

Report the skill path, whether it is project or user scoped, the evidence window, the rules added or changed, validation run, and any proposed follow-up.
