#!/bin/bash
# Warn when a session starts on a branch that's behind main, and point at the plan.
cd "$CLAUDE_PROJECT_DIR" 2>/dev/null || exit 0
git fetch -q origin main 2>/dev/null || exit 0
behind=$(git rev-list --count HEAD..origin/main 2>/dev/null) || exit 0
if [ "$behind" -gt 0 ]; then
  echo "Heads up: this branch is $behind commits behind origin/main. Merge origin/main in (or restart the branch from it) before starting work."
fi
echo "Read docs/PLAN.md before starting."
exit 0
