Wrap-up notes — Quick restart and cleanup

Summary
- Completed: polish & test session. Core fixes applied to invention bonus stacking, pawn memory decay/validation, and crafting goal robustness.
- Automated tests: node:test suite present and passing locally (34/34).
- Dev helpers: a client-side test-mode (`?testMode=1`) was added to `solo/js/app.js` to unlock a recipe, inject synthetic materials, and (for convenience) invoke a deterministic craft and POST results to `/_dev/log`.
- Server: added a small `/_dev/log` POST endpoint in `server.js` to receive client test messages. Logging is now gated to avoid noisy output.

Files changed (high level)
- `solo/js/app.js` — test-mode material injection, recipe unlock, and deterministic craft invocation.
- `solo/js/models/entities/mobile/PawnGoals.js` — bug fixes and null-safe checks (goal/crafting flows).
- `solo/js/rendering/CanvasRenderer.js` — reduced per-tick debug spam.
- `server.js` — added/softened dev logging endpoint.
- Tests: `solo/test/*` — test suite added/updated; run with `npm test`.

How to restart the server
1. Kill any existing process on port 5000 (PowerShell):

```powershell
$p = (Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue).OwningProcess; if ($p) { Stop-Process -Id $p -Force }
```

2. Start server (from repo root):

```powershell
node server.js > server.log 2>&1 &
Get-Content server.log -Wait -Tail 200
```

How to run tests

```powershell
npm test
```

How to reproduce the test-mode client
- Open the client in a browser (or Simple Browser) at:

http://localhost:5000/solo/index.html?testMode=1

- The client will pre-sim, create `player`, unlock a recipe, inject synthetic materials and attempt a deterministic craft. It will POST status messages to `/_dev/log`.

Where to look for logs
- Server-side dev posts are written to `server.log` (and printed to console when allowed).
- By default, `/_dev/log` only prints if `NODE_ENV=development` or `DEV_LOG=1`, or if the message tag starts with `test-`, `craft`, or `dev`.

How to disable test-mode helpers
- Remove `?testMode=1` from the URL; the client will behave normally.
- To permanently disable the deterministic craft hook, revert the changes in `solo/js/app.js` or remove the `testMode`-guarded blocks.

Next steps (suggested)
- Verify one successful `craft-invoked` / `craft-invoked` server log entry from the client when you next run the app.
- Consolidate or remove any remaining temporary instrumentation once you confirm the crafting/goal fixes.
- Commit the final changes (if you haven't) and push to your remote branch.

If you want, I can:
- Remove the `/_dev/log` endpoint entirely and replace it with a file-based log capture.
- Open a PR with the changes and the summary.

Good night — everything here is saved; reload the client with `?testMode=1` when you return to verify the deterministic craft result.
