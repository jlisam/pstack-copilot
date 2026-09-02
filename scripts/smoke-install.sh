#!/usr/bin/env bash
set -euo pipefail

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
repository_root=$(CDPATH= cd -- "$script_dir/.." && pwd)
temporary_home=$(mktemp -d "${TMPDIR:-/tmp}/pstack-copilot-home.XXXXXX")

cleanup() {
	rm -rf -- "$temporary_home"
}
trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

export COPILOT_HOME="$temporary_home"

copilot plugin marketplace add "$repository_root"
expected_skills=$(node -e '
	const inventory = require(process.argv[1]);
	process.stdout.write(String(inventory.skills.length));
' "$repository_root/inventory.json")
expected_version=$(node -e '
	const plugin = require(process.argv[1]);
	process.stdout.write(plugin.version);
' "$repository_root/pstack/plugin.json")

install_output=$(copilot plugin install pstack-copilot@pstack-copilot)
printf '%s\n' "$install_output"
grep -Fq "Installed $expected_skills skills." <<<"$install_output"

plugin_list=$(copilot plugin list)
printf '%s\n' "$plugin_list"
grep -Fq "pstack-copilot@pstack-copilot (v$expected_version)" <<<"$plugin_list"
