### Visual parity

**You own pixel-exact equivalence. The baseline is the spec; you do not touch it.** For "make X match Y exactly", styling-system migrations, porting a UI across frameworks. Equivalence is verified by image diff, not by eye.

1. Establish the baseline first, before any migration: a visual regression harness that screenshots the current component across its states, plus the target when matching two implementations. No baseline, no parity claim. A blocking prerequisite, not a follow-up.
2. Anti-shortcut clauses, stated and held: no harness modifications, no baseline tampering, no component restructuring to make a diff pass. If the baseline looks wrong, stop and follow [User decisions](../references/task-contract.md#user-decisions). Use `ask_user` when available. Otherwise ask one concise plain-text question with numbered choices and end the turn. Do not edit the baseline without approval.
3. Migrate one component at a time. Each is an independent artifact, so parallelize across worktrees, one owner per component (the **separate-before-serializing-shared-state** principle skill). Shared primitives migrate first as a blocking phase.
4. Verify each component against its baseline via image diff through the project's `.github/skills/verify-*/` skill or existing live harness. A nonzero diff is a fail; investigate the pixel delta, don't wave it through. For repeated unattended checks, use the recurrence mechanism in `playbooks/autonomous-run.md` until the diff is zero.
5. Run **Opening a PR** per component or per safe batch.

**Reply:** components migrated, the diff result for each, the baseline harness location, what's left.
