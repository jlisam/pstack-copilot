# pstack-copilot

`pstack-copilot` packages Lauren Tan's pstack workflows for GitHub Copilot CLI. It ships 45 skills, two agents, and 23 playbook files. `/poteto-mode` routes tasks through 22 task playbooks. The shared Opening a PR playbook handles delivery. The installed files stay under [`pstack/`](./pstack/).

This is an unofficial port. It is based on [upstream pstack 0.14.5](https://github.com/cursor/plugins/tree/b9ddc83c32972210b8a94d389130713e8eed346e/pstack) and is maintained independently.

## Install

Register the marketplace, then install the plugin:

```bash
copilot plugin marketplace add jlisam/pstack-copilot
copilot plugin install pstack-copilot@pstack-copilot
```

The port is tested with GitHub Copilot CLI 1.0.83.

Most skills are Markdown-only. The Babysit and Orchestrate playbooks also use bundled Bun scripts. Install Bun 1.4 or later before using those playbooks.

## Start using pstack

Run `/setup-pstack` once to pick the model and reasoning effort for each pstack role. The defaults use GPT-5.6 Sol, Grok 4.6, Claude Opus 5, and Claude Sonnet 5. A role you skip keeps its default.

Run `/poteto-mode` at the start of a task that needs a rigorous playbook:

```text
/poteto-mode add a --json flag. Keep text output byte-identical and verify both forms.
```

`/poteto-mode` applies to that one task. It does not stay active on later turns. Type it again for the next task.

To get the same behavior for a whole conversation, select the bundled agent instead:

```text
/agent pstack-copilot:poteto-agent
```

See the [plugin README](./pstack/README.md) and the [setup guide](./pstack/docs/guide/01-setup.md) for the full workflow.

## Update

Refresh the marketplace, then update the plugin:

```bash
copilot plugin marketplace update pstack-copilot
copilot plugin update pstack-copilot@pstack-copilot
```

## Uninstall

Remove the plugin and its marketplace registration:

```bash
copilot plugin uninstall pstack-copilot@pstack-copilot
copilot plugin marketplace remove pstack-copilot
```

## Compatibility boundaries

- The exported skills and agents target GitHub Copilot CLI.
- The upstream Cursor-only `.cursor-plugin/` package and Benny automation are not shipped.
- Task delegation uses namespaced plugin agents such as `pstack-copilot:poteto-agent` only when the active task schema exposes them. Otherwise it falls back to the built-in agent types.
- Skills use the structured `ask_user` tool when the active CLI exposes it. Older CLIs get the same approval gate as a plain-text question.
- Internally composed workflow skills stay available to the model-facing skill tool. Seven user-only entry skills retain `disable-model-invocation`.
- Model choices live in `~/.copilot/instructions/pstack-models.instructions.md` after `/setup-pstack`.

## Contribute

`pstack/plugin.json` owns the public release identity. `upstream.json` records the upstream source. Do not edit generated release files by hand.

[CONTRIBUTING.md](./CONTRIBUTING.md) has the version rules, the checks to run before a pull request, and the upstream comparison tool.

## License and attribution

Lauren Tan licensed the upstream work under the MIT License. The port adaptations in this repository are distributed under the same license. See [LICENSE](./LICENSE) and [NOTICE.md](./NOTICE.md).
