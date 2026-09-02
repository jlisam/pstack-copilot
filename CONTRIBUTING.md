# Contributing

## Release identity

Edit `pstack/plugin.json` for public release identity changes. It owns the plugin name, description, version, author, license, homepage, and repository.

Edit `upstream.json` only when the upstream source changes. The plugin version must match:

```text
^${upstream.version}-copilot\.\d+$
```

Do not edit these generated files:

- `.github/plugin/marketplace.json`
- `inventory.json`
- `LICENSE`
- `NOTICE.md`
- `pstack/NOTICE.md`

Regenerate them after changing either source file or the public tree:

```bash
node scripts/generate-release-files.mjs --write
```

## Validate the repository

Run the read-only release checks:

```bash
node scripts/generate-release-files.mjs --check
node scripts/validate.mjs
bash -n scripts/compare-upstream.sh
bash -n scripts/smoke-install.sh
scripts/smoke-install.sh
```

Install the poteto-mode tool dependencies with Bun 1.4.0. Then run the tests, the typecheck, and the tool help checks:

```bash
cd pstack/skills/poteto-mode/scripts
bun install --frozen-lockfile
bun test orch watch-pr
bun run typecheck
node check-plan.mjs --help
./watch-pr/watch-pr --help
./orch/orch.ts --help
```

## Compare with upstream

Run the comparison tool with the commit from `upstream.json`:

```bash
scripts/compare-upstream.sh
```

Pass a branch, tag, or commit to review another upstream revision:

```bash
scripts/compare-upstream.sh <ref>
```

The script reports differences. It does not merge files or add a Git remote to this repository.

## Pull requests

Keep changes focused. Explain any intentional difference from upstream. Include the generation, validation, Bun test, and typecheck results in the pull request.
