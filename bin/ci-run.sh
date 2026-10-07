#!/usr/bin/env bash
# Runs a command in CI; on failure, re-emits the last lines of its output as
# GitHub error annotations so failures are readable through the Checks API.
# Usage: bin/ci-run.sh <label> <command...>
set -uo pipefail

label="$1"
shift

log="$(mktemp)"
"$@" 2>&1 | tee "$log"
status=${PIPESTATUS[0]}

if [ "$status" -ne 0 ]; then
  tail -n 150 "$log" | sed 's/\x1b\[[0-9;]*[A-Za-z]//g' | split -l 50 - "$log.part."
  n=1
  for part in "$log".part.*; do
    msg="$(sed -e 's/%/%25/g' -e 's/\r/%0D/g' "$part" | awk 'BEGIN{ORS="%0A"} {print}')"
    echo "::error title=${label} (output ${n})::${msg}"
    n=$((n + 1))
  done
fi

rm -f "$log" "$log".part.*
exit "$status"
