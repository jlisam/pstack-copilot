### Orchestrate

**You own the program, not each code diff. Author briefs, drain the queue, keep the frontier green, and decide.** Use for a standing project that outlives one ordinary task: many units or stacked PRs, repeated verification, and sparse human check-ins. A single task driven to a predicate belongs to Autonomous run. An ambitious one-session workflow belongs to figure-it-out.

Ceremony must scale with the program. If one agent can finish inside the available session budget, collapse to Autonomous run.

Three rules carry the rest:

- Completions are queue events, not reasons to abandon a critical section.
- Every delegated prompt is self-contained.
- The brief is the product.

Read `../references/task-contract.md` before spawning anything. Copilot has no cloud/local task selector. Every writer gets an explicit local worktree or branch. The default task mode is `sync`; long-running owners may use `background` only while the coordinator performs independent work and later waits for their results.

#### Roles

- **Coordinator.** Frames the program, owns the durable store, creates worktrees, issues task calls, drains results, integrates verified work, handles human gates, and writes status. It does not casually take over a worker's code. A conflict or fix becomes a scoped task unless direct integration bookkeeping is clearly cheaper.
- **Track planner.** Optional for a track too large to reason about inline. Use a `general-purpose` task with an explicit no-writes constraint. It proposes ready units and audits briefs; the coordinator still spawns workers. Do not assume nested task delegation is available.
- **Worker.** A `general-purpose` task with an exclusive worktree and write boundary.
- **Verifier.** A `task`, `code-review`, or no-write `general-purpose` task chosen per `task-contract.md`. Prefer a different model family from the worker when judgment matters.

#### Store

Create `files/orchestrate/<project-slug>/` under the active Copilot session workspace. Use `bun scripts/orch/orch.ts`, written below as `orch`, for bookkeeping while keeping the TSV, JSON, and Markdown readable without the CLI.

- `preferences.md`: numbered standing orders, one constraint per line.
- `program-objective.md`: exact done predicate, scope, verification bar, merge authority, and stop rule.
- `overview.md`: durable PR and issue notes.
- `units.tsv`: unit, track, state, branch, worktree, PR, head SHA, task ID, brief path.
- `frontier.json`: computed merge frontier.
- `ledger.tsv`: verification verdicts keyed by PR and head SHA.
- `inbox/`: task-result pointers.
- `gates.md`: genuine human decisions, options, and safe default.
- `decisions.tsv`: trail owned by **show-me-your-work**.
- `status.md`: derived from the tables at each drain.

Every file has one writer. Owners publish facts; readers aggregate them. Do not keep the only copy of program state in chat.

#### Brief

Every task prompt contains:

```text
GOAL         one executable outcome
REPOSITORY   absolute repository and assigned worktree paths
SCOPE        paths allowed and forbidden
START        base branch and exact starting SHA
CONTEXT      file, PR, and upstream-result pointers with needed findings copied in
ACCEPTANCE   checkable criteria
VERIFY       exact commands or project verification-skill path
TIMEBOX      return partial evidence when reached
FORBIDDEN    no out-of-scope fixes or topology changes
REPORT       status, branch, head SHA, PR, commands run, verdict, deviations, follow-ups
STANDING     relevant lines from preferences.md
```

The prompt may point at repository files, but it cannot depend on hidden chat context or a sibling's unseen output. If a unit depends on another, wait for the upstream result and copy the needed findings into the downstream prompt. Spawn a fresh task with consolidated scope instead of relying on a resumed conversation to remember directives.

#### Steps

1. **Frame.** Write a countable done predicate, unit count, rough effort, expected stacks, wall-clock budget, tracks, merge authority, and verification floor. If one agent fits, route to Autonomous run. Use arena for a contested decomposition.
2. **Initialize.** Run `orch init`, write `program-objective.md` and `preferences.md`, open the decision trail, and seed `frontier.json` from current PRs.
3. **Pilot.** Push one representative unit through brief, worker, verification, integration, ledger, and merge or handoff. Fix the contract from evidence before scaling.
4. **Scale.** Create isolated worktrees, then issue independent worker calls together. Long owners may run in `background` while the coordinator audits briefs, prepares verifier prompts, and integrates earlier units. Refill a rolling window as results arrive. Never let background mode stand in for dependency ordering.
5. **Drain.** At a safe boundary, collect completion events, use the runtime's task status/result tools for known task IDs, classify every result, update tables, and launch only newly ready work. Wait for a task before consuming its output.
6. **Land continuously.** Integrate the lowest verified unit first. Advance `frontier.json` only after a merge or a confirmed new head. Keep stack topology under one writer.
7. **Close.** Reconcile every task to a terminal unit state, confirm the predicate on the real artifact, verify every landed PR at its current SHA, audit the trail, stop schedules and watchers, and leave the store intact.

#### Recurrence

Use `manage_schedule` when available for periodic drains or audits. Each scheduled prompt re-reads `program-objective.md`, `preferences.md`, this playbook, and the current tables. Stop the schedule when the predicate is met or the program is paused.

For a real event with a blocking watcher, use one background task or async command and rely on its completion notification while the coordinator performs independent work. If neither schedules nor event notifications are available, checkpoint and require a later session pickup. Never claim a webhook, hidden wake chain, or guaranteed recurrence the runtime does not provide.

#### Stack safety

- Compute the frontier from git and Graphite state, not prose.
- Exactly one local worktree owns `gt` operations for a stack.
- Workers never rebase, restack, retarget, close PRs, or run `gt` unless their brief explicitly makes them the topology owner.
- A new head SHA voids its old verdict. Use patch ID only to prove a restack left the patch unchanged.
- Merges and stack surgery are units with briefs and verification.

#### Verification

When verification is one cheap command, the worker runs it and the coordinator spot-checks the receipt. Use an independent verifier when proof is expensive, judgment-heavy, live, or high blast radius. Behavioral work uses the project's `.github/skills/verify-*/` skill or existing live harness.

Record verdicts in `ledger.tsv` at the exact head SHA. CI green is an input, not a behavioral verdict. `verifier-blocked` is not a pass. `verifier-failed` creates a fix unit.

#### Liveness and failure

- Track known tasks through runtime status/result tools, completion events, branches, PRs, and stored reports. Do not infer liveness from file modification time.
- Retry cap or memory failures with smaller scope, network failures once as-is, and tool failures with a supported alternate pair. Two failed retries means abandon and replan.
- Reconcile late output against the current frontier before accepting it.
- After a Copilot CLI restart, re-read the store, query known task or session IDs when available, inspect branches and PRs, and mark anything unverifiable as unknown. Do not assume a background task survived.
- If infrastructure remains unavailable after bounded retries, write an exact durable handoff and stop.

#### Escalation

For irreversible actions, genuine product or preference calls, contradictory standing orders, or a program-level dead end that survived a replan, follow [User decisions](../references/task-contract.md#user-decisions). Use `ask_user` when available. Otherwise ask one concise plain-text question with numbered choices and end the turn. Write the gate to `gates.md` before asking and route other work around it.

Do not ask about routine retries, formatting fixes, scoped CI triage, or whether to keep going.

**Reply:** the predicate and count against it, track results, frontier with PRs and SHAs, verdict summary, abandoned units, open gates, store path, trail path, and PR links.
