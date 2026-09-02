### Authoring or modifying a skill

**You own the skill's voice.** Agent-facing prose has a higher bar than human prose; unhelpful sentences become instructions.

1. Choose placement from intent. Project skills live at `.github/skills/<name>/SKILL.md`; user skills live at `~/.copilot/skills/<name>/SKILL.md`. When project versus user scope is a genuine unresolved decision, follow [User decisions](../references/task-contract.md#user-decisions). Use `ask_user` when available. Otherwise ask one concise plain-text question with project and user scope as numbered choices and end the turn.
2. Read nearby skills and preserve the repository's established shape. Write YAML frontmatter with only non-empty `name` and `description`.
3. Draft the smallest operational body that changes decisions. Keep delegated prompts self-contained and reference `../references/task-contract.md` whenever the skill orchestrates task calls.
4. Validate the frontmatter, referenced files, cross-skill links, task fields, model pairs, and placement. Run any existing skill validator.
5. Test trigger examples and structural workflows when behavior is objective; use an explicit user review for subjective style.
6. For a project skill, run **Opening a PR** when requested. For a user skill, report the local path instead of creating a repository PR.

When in doubt, delete; prose earns its keep by changing a decision. Tell it to do the thing and skip the reason. Explain only when the rule is confusing without one. Match tone to scope. Point at structural sources (types, READMEs, config); hardcoded details go stale (the **encode-lessons-in-structure** principle skill). Delegate to other skills by path; don't restate. A workflow you keep hitting but isn't captured → propose a new skill.

**Reply:** summary of the skill, key design decisions, validation notes.
