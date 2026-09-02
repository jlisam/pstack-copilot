---
name: make-bot-ui
description: >-
  Build a supported control surface for Copilot CLI. Use `/remote` to control
  an existing live session, or build a local button server that starts new
  fixed-prompt `copilot -p` tasks.
---

# How to make a bot UI

Copilot CLI does not provide a routine webhook that wakes an arbitrary existing session. Use one of the two supported shapes below and state the boundary honestly.

## Choose the shape

Follow [User decisions](../poteto-mode/references/task-contract.md#user-decisions). Use `ask_user` when available. Otherwise ask one concise plain-text question with these same numbered choices and end the turn:

1. **Existing live session.** Use `/remote`.
2. **Button-triggered new tasks.** Build a local fixed-prompt server.
3. **Abort.**

Do not claim that the local server can resume, wake, or inject messages into an existing session.

## Existing live session with `/remote`

Use this when the user wants to control the Copilot CLI session that is already running.

1. In the target session, invoke `/remote`.
2. Follow the connection instructions and URL shown by Copilot CLI. Do not invent endpoints, pairing codes, or transport details.
3. Keep the session running while it is controlled remotely.
4. Use the remote surface Copilot provides. Do not build a parallel webhook or proxy that pretends to feed the same session.

If the user needs custom buttons rather than the supported remote surface, use the local server option. Each click will start a new task.

## Local server for new tasks

Build a small local page and server. Each button maps to one complete, fixed prompt stored on the server. The browser sends only an allowlisted action ID. The server starts a fresh non-interactive process with a fixed argument array:

```bash
copilot -C /fixed/repository -p "<fixed prompt>" --allow-all-tools --available-tools=<fixed-allowlist>
```

Copilot prompt mode cannot stop for permission prompts. Keep `--allow-all-tools`, the `--available-tools` allowlist, and any `--deny-tool` rules fixed per action on the server. A read-only action exposes only read tools. A write action exposes only the specific tools its prompt needs. Never expose unrestricted shell or broad write access merely to make the button work.

Invoke the executable with an argument array, not a shell-assembled command. Fix the working directory server-side. Never accept a raw prompt, command, repository path, model, tool flag, permission flag, or environment variable from the browser.

### Server contract

- Keep the action-to-prompt map on the server.
- Keep the action-to-tool-policy map on the server.
- Keep secret values out of every fixed prompt.
- Make every prompt self-contained: goal, repository path, scope, constraints, acceptance checks, and required report.
- Display the exact fixed prompt in the UI before the user confirms a run. Enforce confirmation server-side with a one-time token; a browser-only dialog is not a security boundary.
- Queue or reject clicks above a small concurrency limit.
- Record action ID, start time, exit code, and a redacted output path. Do not log credentials or environment contents.
- Stream or poll only this server's task status. A completed child process is the completion signal.
- Treat nonzero exit, timeout, or lost process state as a failed task. Do not silently retry a write-capable task.

The server may inherit the logged-in Copilot CLI environment. Do not copy GitHub or Copilot credentials into browser code, HTML, URLs, logs, or the prompt map. Store any application secrets in a server-only environment file or credential store with restrictive permissions.

Loopback is not an authentication boundary. A malicious page open in the user's browser can send requests to `127.0.0.1`. Every server, including loopback-only servers, must:

- Accept only the exact expected `Host` and same-origin `Origin`.
- Require an unguessable authenticated session cookie with `HttpOnly` and `SameSite=Strict`.
- Require a separate unguessable CSRF token on every state-changing request.
- Reject missing, expired, replayed, cross-origin, and unauthenticated confirmations before starting a process.
- Never use a GET request to launch a task.

### Network boundary

Bind to `127.0.0.1` by default. Before any non-loopback bind, tunnel, tailnet share, container publish, or deployment, follow [User decisions](../poteto-mode/references/task-contract.md#user-decisions). Use `ask_user` for explicit approval when available. Otherwise present the same named exposure plan with numbered choices to approve it, keep the service loopback-only, or abort, then end the turn. The approval must name:

- The interface and port.
- Who can reach it.
- The authentication method.
- The fixed actions that will be exposed.
- The shutdown procedure.

Without approval, keep the service loopback-only. After approval, prefer an existing private network over public exposure and retain the same authentication, origin, CSRF, rate-limit, and session protections. Keep long-lived credentials server-side.

### Verification

1. Unit-test that unknown action IDs are rejected.
2. Unit-test that browser input cannot alter the executable, arguments, cwd, prompt, tool policy, or environment.
3. Unit-test that unauthenticated, cross-origin, wrong-host, missing-CSRF, expired, and replayed requests cannot launch a process.
4. Start the server on loopback and health-check it.
5. Trigger one harmless fixed action through the authenticated confirmation flow and confirm the exact prompt reached `copilot -p`.
6. Confirm a direct cross-origin request is rejected before process creation.
7. Confirm secrets are absent from HTML, client bundles, responses, logs, and process output.
8. Stop the exact server process you started.

If network exposure was approved, repeat the health check through the approved private address and confirm unauthenticated requests fail.

## Reply

State which shape was built, whether it controls an existing session or starts new tasks, the local URL, the fixed actions, verification results, where server-only configuration lives, and whether network exposure was approved.
