---
name: principle-laziness-protocol
description: "Apply to every code change before you present it, and when refactoring, evaluating diff size, or tempted to add abstractions, layers, options, or signal threading. Bias toward deletion and the smallest change that solves the problem."
---

# Laziness Protocol

Writing code is cheap for you, which makes over-engineering easy. Counter it by borrowing a human maintainer's fatigue. Aim for the most result with the least code and complexity.

- **Prefer deletion.** When asked to refactor or improve, look for removals before additions.
- **Maintain a flat call hierarchy.** Avoid deep call chains. A rich interface that hides substantial work is not a deep call chain. If answering a question requires tracing through more than 3 files or layers, flatten it.
- **Consolidate decisions.** Do not repeat the same choice in several places. Put it behind one source of truth and pass the result as a simple flag.
- **Minimize the diff.** Make the smallest change that solves the problem. Fewer lines beat "elegant" boilerplate.
- **Question the threading.** If a task asks you to pass a new signal through types, schemas, pipelines, or similar layers, stop and look for a more direct path.
- **Sweat the small leaks.** Remove tiny pass-throughs, representation leaks, and duplicated choices before they spread. Small leaks compound into permanent coordination costs.
- **Add no options nobody asked for.** Leave out flags, modes, subcommands, config fields, and tuning knobs until someone needs them. Use a constant meanwhile. One command with flags beats several commands.
- **Port behavior, not code.** When porting a script or an older system, port what it does, not how it does it. Matching a reference line for line is rarely the requirement.
- **Start with the plainest algorithm.** Try a lookup, a rule, or a least-squares fit first. Add stages only when a measurement on real data shows it falls short.
- **Keep tests few and small.** Write a few behavior tests on made-up data. Recorded production fixtures, goldens, parity suites, and test-only hooks in production code each need a specific reason.
- **Name things for what they do.** Read each new name cold, and rename it if it does not say what the thing does. Spell out shorthand that only you understand.

**Prime directive:** If a human developer would find the code exhausting to maintain, it is a bad solution. Be lazy. Stay simple.
