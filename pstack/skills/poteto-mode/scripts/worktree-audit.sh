#!/usr/bin/env bash
# Read-only worktree prune audit. Classifies every git worktree by size, merge
# state, uncommitted work, remote/PR state, and whether a scoped recent Copilot
# session used it. Emits a table sorted by size with a suggested bucket. Never
# deletes anything; deletion stays a human-gated step in the playbook.
#
# Usage: worktree-audit.sh [repo-path] [recent-worktrees-file]
# The optional file contains one exact worktree path per line. The caller
# derives it from repository-scoped session history.
set -u

repo="${1:-$(git rev-parse --show-toplevel 2>/dev/null)}"
recent_file="${2:-}"
[ -z "$repo" ] && { echo "not in a git repo; pass a repo path" >&2; exit 1; }
case "$recent_file" in ""|/*) ;; *) recent_file="$(pwd)/$recent_file" ;; esac
case "$repo" in /*) ;; *) repo="$(pwd)/$repo" ;; esac
repo=$(cd "$repo" 2>/dev/null && pwd -P) \
	|| { echo "repo path is not a readable directory: $repo" >&2; exit 1; }

recent_state=unknown
if [ -n "$recent_file" ]; then
	if [ -f "$recent_file" ] && [ -r "$recent_file" ]; then
		if awk 'length($0) > 0 && (substr($0, 1, 1) != "/" || index($0, "\t") > 0) { exit 1 }' \
			"$recent_file"; then
			recent_state=known
		else
			echo "warn: recent-worktrees file contains an invalid path; recent session use is unknown" >&2
		fi
	else
		echo "warn: recent-worktrees file is not a readable regular file: $recent_file" >&2
	fi
else
	echo "warn: no recent-worktrees file supplied; recent session use is unknown" >&2
fi

canonical_path() {
	path=$1
	if [ -d "$path" ]; then
		(cd "$path" 2>/dev/null && pwd -P) || printf "%s\n" "$path"
		return
	fi
	case "$path" in
		/var/*) printf "/private%s\n" "$path" ;;
		*) printf "%s\n" "$path" ;;
	esac
}

cd "$repo" || exit 1

# Main worktree is the first entry; everything else is a candidate.
main_wt=$(git worktree list --porcelain | awk '/^worktree /{print $2; exit}')

# origin/main drives the merge check. Best-effort; stale is fine for a first pass.
git fetch origin main --quiet 2>/dev/null || echo "warn: could not fetch origin/main; merged column may be stale" >&2

# PR state by branch, fetched once. Keep scratch data beside the common git dir
# so no system temporary directory is needed.
git_common=$(git rev-parse --git-common-dir)
case "$git_common" in /*) ;; *) git_common="$repo/$git_common" ;; esac
prs="$git_common/pstack-worktree-audit-prs.$$"
trap 'rm -f "$prs"' EXIT
gh pr list --author "@me" --state all --limit 1000 \
	--json number,state,headRefName 2>/dev/null > "$prs" || echo "[]" > "$prs"

now=$(date +%s)

printf "SIZE\tAGE\tMERGED\tDIRTY\tREMOTE\tPR\tRECENT_SESSION\tBUCKET\tWORKTREE\n"

git worktree list --porcelain | awk '/^worktree /{print $2}' | while read -r wt; do
	[ "$wt" = "$main_wt" ] && continue

	size=$(du -sh "$wt" 2>/dev/null | awk '{print $1}')
	head=$(git -C "$wt" rev-parse HEAD 2>/dev/null)
	head_ts=$(git -C "$wt" log -1 --format='%ct' HEAD 2>/dev/null || echo 0)
	age=$([ "$head_ts" -gt 0 ] 2>/dev/null && echo "$(( (now - head_ts) / 86400 ))d" || echo "?")

	# Squash-merged branches are not ancestors of main, so PR state is the
	# real signal; merge-base only catches fast-forward/rebase merges.
	git merge-base --is-ancestor "$head" origin/main 2>/dev/null && merged=YES || merged=no

	# Distinguish real WIP (tracked edits) from disposable untracked scratch.
	porcelain=$(git -C "$wt" status --porcelain 2>/dev/null)
	if [ -z "$porcelain" ]; then dirty=clean
	elif printf '%s\n' "$porcelain" | grep -qv '^??'; then
		dirty="wip:$(printf '%s\n' "$porcelain" | grep -cv '^??')"
	else dirty="scratch:$(printf '%s\n' "$porcelain" | grep -c '^??')"; fi

	branch=$(git -C "$wt" symbolic-ref --quiet --short HEAD 2>/dev/null || echo "")
	if [ -z "$branch" ]; then remote=detached
	elif git -C "$wt" show-ref --verify --quiet "refs/remotes/origin/$branch"; then
		[ "$(git -C "$wt" rev-parse "origin/$branch" 2>/dev/null)" = "$head" ] \
			&& remote=pushed \
			|| remote="ahead$(git -C "$wt" rev-list --count "origin/$branch..HEAD" 2>/dev/null)"
	else remote=no-remote; fi

	pr=$([ -n "$branch" ] && jq -r --arg b "$branch" \
		'.[] | select(.headRefName==$b) | "#\(.number)/\(.state)"' "$prs" 2>/dev/null | head -1)
	[ -z "$pr" ] && pr="-"

	recent=unknown
	if [ "$recent_state" = known ]; then
		recent=no
		normalized_wt=$(canonical_path "$wt")
		while IFS= read -r session_path; do
			[ -z "$session_path" ] && continue
			normalized_session=$(canonical_path "$session_path")
			case "$normalized_session" in
				"$normalized_wt"|"$normalized_wt"/*)
					recent=yes
					break
					;;
			esac
		done < "$recent_file"
	fi

	case "$dirty" in wip:*) bucket=hold-wip ;; *)
		case "$pr" in *OPEN*) bucket=hold-open-pr ;; *)
			if [ "$recent" = yes ]; then bucket=verify-recent-session
			elif [ "$recent" = unknown ]; then bucket=verify-session-unknown
			elif [ "$merged" = YES ] || [ "$pr" != "-" ]; then bucket=safe
			else bucket=review; fi ;;
		esac ;;
	esac

	printf "%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n" \
		"$size" "$age" "$merged" "$dirty" "$remote" "$pr" "$recent" "$bucket" "$wt"
done | sort -t$'\t' -k1,1 -rh
