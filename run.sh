#!/usr/bin/env bash
# Runner script that restarts the bot on exit

cd "$(dirname "$0")"

while true; do
    echo "Starting Claudegram..."
    bun run src/index.ts
    EXIT_CODE=$?

    if [ $EXIT_CODE -eq 0 ]; then
        echo "Bot exited cleanly, restarting in 2 seconds..."
        sleep 2
    else
        echo "Bot crashed with exit code $EXIT_CODE, restarting in 5 seconds..."
        sleep 5
    fi
done
