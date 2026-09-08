---
name: swarm
description: "Fan out N parallel workers, drain them, and return one report. Use for /swarm, 'swarm this', or parallel coverage, races, gauntlets, and exploration."
---

# Swarm

Fan out N parallel workers. They may cover separate slices, race the same brief, or mix both. The parent waits, aggregates, and returns one report.

## Start

Open a todolist with one entry per phase before launching anything.

1. Frame
2. Fan out
3. Aggregate
4. Report

## Phase A: Frame

1. State the done predicate and the artifact or report the swarm must return.
2. Choose the shape. Partition into slices, race N workers on identical briefs, or mix both. For a race or mixed shape, declare `first pass`, `rank all`, or `best-of` before spawning.
3. Set N from the user or derive it from the shape. N is total workers, not the runtime's concurrency cap.
4. Pick the worker pair from `swarm workers` in `~/.copilot/instructions/pstack-models.instructions.md` when present. Otherwise use `grok-4.6@high`. For a model race, name each arm's pair up front.
5. Give each writer its own local worktree or branch. Read-only workers may share the checkout.

## Phase B: Fan out

Read [`../poteto-mode/references/task-contract.md`](../poteto-mode/references/task-contract.md). Issue all independent task calls together. Use `agent_type: explore` for read-only code discovery, `agent_type: code-review` for concrete diffs, and `agent_type: general-purpose` for writers or other multi-step work. General-purpose read-only prompts must explicitly forbid writes.

Split each configured `MODEL@EFFORT` pair into task `model` and `reasoning_effort`. Use the default `sync` mode and wait for all workers before aggregation. Use `background` only when the parent immediately continues separate work and will wait before consuming the result.

There is no remote environment or base-branch field. Create any required local worktree or branch before spawning, then include its absolute path and starting ref in the prompt.

Every brief stands alone. Include the goal, scope, exact slice or race arm, how to verify, and what to report. Reports use `PASS`, `ISSUES`, or `BLOCKED` with evidence.

If a worker drops out, proceed with N-1 and note it.

## Phase C: Aggregate

Read the terminal results. For coverage, every required slice needs a result. For a race, apply the selection rule declared up front. Use first pass, rank all, or best-of. Do not paste raw worker dumps.

Keep a compact result table, one-line evidenced issues, and explicit gaps or dropouts.

## Phase D: Report

Return one consolidated in-chat report with the table, issue one-liners, gaps or dropouts, and the race rule when used.
