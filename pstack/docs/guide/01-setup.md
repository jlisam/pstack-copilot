# Set up pstack

In this page you install the plugin, pick which models pstack uses, and run your first task. Setup is one command plus a short conversation.

## Install the plugin

In a terminal, register the public marketplace and install the plugin:

```bash
copilot plugin marketplace add jlisam/pstack-copilot
copilot plugin install pstack-copilot@pstack-copilot
```

Copilot confirms that `pstack-copilot` is enabled. The port is tested with GitHub Copilot CLI 1.0.83.

Most skills need only Copilot CLI. Install Bun 1.4 or later before using the Babysit or Orchestrate playbooks, which run bundled Bun scripts.

## Pick your models

Run:

```text
/setup-pstack
```

[`/setup-pstack`](../../skills/setup-pstack/SKILL.md) detects the models and reasoning efforts exposed by the active task tool, shows you each role (code delegates, judgment, the review panels), and asks what you want. Answer the questions. It writes `~/.copilot/instructions/pstack-models.instructions.md`, a small instruction file every pstack skill reads.

You only override what you care about. A role with no line in the rule keeps the skill's default. To restore a default later, delete that role's line, or just run `/setup-pstack` again.

You might be wondering what happens if you use Auto. Set a role to `inherit-parent` or `auto` and pstack omits the subagent `model` field, so the subagent inherits your parent chat model. Both values mean the same thing, and neither is a model slug. For a panel role the value is a list, and one subagent runs per entry, so the list length sets the panel size. Setup also configures `swarm workers`, the default model for every `/swarm` worker unless a race names a model for each arm.

## Accept the verification offer, or don't

At the end of setup, `/setup-pstack` looks for a way to prove app behavior in your project, either a `verify-*` skill or an existing harness. If it finds neither, it offers once to generate one with [`/create-verification-skill`](../../skills/create-verification-skill/SKILL.md).

Say yes and it writes `.github/skills/verify-<app>/`, a project-local skill that teaches agents to drive your app the way a user does. It proves the skill works once before handing it over. Say no and setup moves on. You can run `/create-verification-skill` yourself any time. [Verify and ship](./06-verify-and-ship.md#create-a-project-verification-skill) covers when it earns its place.

After setup, start a new session or run `/restart`. The model instruction applies when the session reloads.

## Run your first task

Pick something real but small, and describe it the way you'd describe it to a colleague:

```text
/poteto-mode add a --json flag to this command. text output stays byte-identical. verify both.
```

Watch the todo list. The first item is always "read the Principles section". The rest are the matched playbook's steps copied in, the Feature playbook for this prompt. If `/poteto-mode` skips a step, the step stays in the list with `skip: <reason>`, so you can see what it chose not to do.

Follow up in plain language while the task runs. `/poteto-mode` applies to one task and does not stay active on later turns. Type it again when you start the next task. To keep the style for a whole conversation, select the bundled agent instead:

```text
/agent pstack-copilot:poteto-agent
```

Next: [Route work through `/poteto-mode`](./02-poteto-mode.md).
