---
name: no-comments
description: "Run the Comment Sicko policy through a supported Copilot task, fix accepted findings, and offer encodings for claimed constraints."
disable-model-invocation: true
---

# No comments

Run the Comment Sicko policy. Act on accepted findings.

Authoring agents defend comments. Defer to Comment Sicko's fresh perspective.

## Scope

Use the caller's files or diff. Otherwise use the current diff against the base branch, default `main`, including the working tree.

## Steps

1. Read [`../poteto-mode/references/task-contract.md`](../poteto-mode/references/task-contract.md) and [`../../agents/comment-sicko.agent.md`](../../agents/comment-sicko.agent.md). If the active task schema lists `pstack-copilot:comment-sicko`, use that agent type in the default `sync` mode and pass the exact file or diff scope. Otherwise use `general-purpose` with `judgment and prose` from `~/.copilot/instructions/pstack-models.instructions.md`, default `claude-opus-5@max`, and copy the custom agent's operative policy into the self-contained prompt. In either path, permit writes only to comments in scope and require a report with touched files, deletion count, `MUST KILL` flags, and skips.
2. Inspect its report and diff. Reject application-code edits, scope escapes, exception-protected deletions, misstated `MUST KILL` reasons, and flags that treat kept intentional code as guilty. Reshape flags on our-code surprises stay actionable. Do not restore those comments. A keep survives only with proof it is about something we cannot change. Audit missed scoped lint and TypeScript suppressions. Correctness or safety suppressions stay actionable `MUST KILL`s. Restore deletions only with exact exceptions and scoped proof. Before accepting thin `IMPORTANT` or `do not remove` kills or keeps, run `/how` or `/why` on their symbol. If a kill is ambiguous, do not restore. If a keep is refuted or still ambiguous, delete it. Revert and rerun one rejected report with the failure named. Reject a second, report it open, and fail `/no-comments`.
3. Fix trivial accepted flags directly by deleting a dead path, dropping a parameter, or using the real API. If any fix needs a shape, run `/architect` once for the accepted set and surrounding code. Stop at the sketch. Architect shapes. Step 4 implements.
4. Implement the smallest root-cause fix in scope. Remove every named workaround. If the root cause is out of scope, land the smallest in-scope fix and report the rest open. The **principle-fix-root-causes** and **principle-redesign-from-first-principles** skills guide intent only: fix real causes, redesign as if requirements always existed, never bolt on symptom guards. Neither authorizes widening the fence nor fixing instances outside it.
5. Constraint comments say `do not remove`, `do not change wording`, or `talk to X before changing`. Leave keeps about things we cannot change. Offer the cheapest in-scope type, runtime, test, or CI lint. Follow [User decisions](../poteto-mode/references/task-contract.md#user-decisions). Use `ask_user` for approval when available. Otherwise ask one concise plain-text question with numbered approve or decline choices and end the turn. Unattended and eval runs require caller pre-approval. If approved, encode then delete. Otherwise delete, report the constraint open, and sketch out-of-scope work.
6. Report the deletion count, restored comments, reruns, architect sketch, fixes, encoding offers, encodings, unenforced constraints, and other open work.
