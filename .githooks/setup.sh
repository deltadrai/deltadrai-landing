#!/bin/sh
# One-time setup for a fresh clone.
#
# Enables Git LFS for the tracked media types (.gitattributes) and activates the
# repository's committed hooks, including the pre-commit policy that rejects any
# binary object that is not an allowed, LFS-stored media type.
#
# Run from the repository root:  sh .githooks/setup.sh
set -eu

if ! command -v git-lfs >/dev/null 2>&1; then
    echo "git-lfs is not installed. Install it from https://git-lfs.com and re-run." >&2
    exit 1
fi

# Configure the LFS filters (clean/smudge/process) for this repo without letting
# 'git lfs install' scribble hooks into .git/hooks — our hooks live in .githooks.
git lfs install --local --skip-repo
git config core.hooksPath .githooks

echo "Setup complete: Git LFS filters configured and hooks path set to .githooks."
