#!/usr/bin/env bash
set -euo pipefail

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
repository_root=$(CDPATH= cd -- "$script_dir/.." && pwd)

if (($# > 1)); then
	printf 'Usage: %s [ref]\n' "$0" >&2
	exit 2
fi

upstream_repository=$(node -e 'const fs = require("node:fs"); const data = JSON.parse(fs.readFileSync(process.argv[1], "utf8")); process.stdout.write(data.repository);' "$repository_root/upstream.json")
upstream_path=$(node -e 'const fs = require("node:fs"); const data = JSON.parse(fs.readFileSync(process.argv[1], "utf8")); process.stdout.write(data.path);' "$repository_root/upstream.json")
default_ref=$(node -e 'const fs = require("node:fs"); const data = JSON.parse(fs.readFileSync(process.argv[1], "utf8")); process.stdout.write(data.commit);' "$repository_root/upstream.json")
ref=${1:-$default_ref}

temporary_root=$(mktemp -d "${TMPDIR:-/tmp}/pstack-copilot-upstream.XXXXXX")
cleanup() {
	rm -rf -- "$temporary_root"
}
trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

checkout="$temporary_root/plugins"
git clone --filter=blob:none --depth=1 --no-checkout "${upstream_repository}.git" "$checkout"
git -C "$checkout" sparse-checkout init --cone
git -C "$checkout" sparse-checkout set "$upstream_path"
git -C "$checkout" fetch --depth=1 origin "$ref"
git -C "$checkout" checkout --detach FETCH_HEAD

printf 'Comparing upstream %s at %s with %s/pstack\n' "$upstream_path" "$ref" "$repository_root"
set +e
diff -ruN \
	-x .cursor-plugin \
	-x automations \
	-x node_modules \
	"$checkout/$upstream_path" \
	"$repository_root/pstack"
status=$?
set -e

case "$status" in
	0) printf 'No differences found.\n' ;;
	1) printf 'Differences found above.\n' ;;
	*) exit "$status" ;;
esac
