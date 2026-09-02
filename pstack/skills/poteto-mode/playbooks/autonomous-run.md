### Autonomous run

**You own the exit condition. Define done, then drive to it without stopping.** For "going to bed" / "run until done" / "keep going until X".

1. State the exit condition as a checkable predicate before the first iteration (tests green, repro fixed, all N PRs merged, pixel-diff zero). A vague goal stalls; a predicate lets you stop.
2. Pick only a wake mechanism Copilot exposes. For recurring time-based checks, use `manage_schedule` when available and stop the schedule when the predicate is met. For an event with a real blocking watcher (CI, a merge, a ref advancing), run that watcher as a background task or async command and rely on its completion event while the parent does independent work. Add a schedule heartbeat only when the event source can be lost. If neither schedules nor event notifications are available, run one iteration and leave a durable resume point; do not claim an unsupported webhook or wake chain.
3. Each iteration makes the smallest change the evidence justifies, verifies it against the predicate, commits if it advanced, discards changes that didn't help. Belt-and-suspenders that "might help" gets reverted, not left to ride.
   Sequence the work via the **sequence-verifiable-units** principle skill, verifying each unit before the next instead of batching checks at the end.
4. Mid-run discoveries are yours. Address broken skills, related bugs, flaky verifiers, review noise, tooling failures, orphaned follow-ups, and fixable drift yourself via poteto-mode. Put out-of-band fixes in their own PR. Do not park reversible work for the human. For irreversible actions, genuine product or preference calls no experiment can settle, or a real dead end, follow [User decisions](../references/task-contract.md#user-decisions). Use `ask_user` when available. Otherwise ask one concise plain-text question with numbered choices and end the turn. Keep the predicate as the main drive, and return to it after each side fix.
5. Checkpoint every iteration via the **show-me-your-work** skill, a row for what changed and whether the predicate moved. A run with no trail can't be audited or resumed.
6. Stop when the predicate is met. A plateau is not a stop, so keep going and pivot your approach to push past it. Surface a genuine dead end rather than spinning, and never relax the predicate to declare victory.

**Reply:** the exit condition, iterations run, what landed, what was discarded, final predicate state.
