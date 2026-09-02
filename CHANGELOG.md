# Changelog

## 0.14.5-copilot.1 - 2026-09-02

- Published the initial standalone GitHub Copilot CLI port. Tested with Copilot CLI 1.0.83.
- Based the exported files on upstream pstack 0.14.5 at commit `b9ddc83c32972210b8a94d389130713e8eed346e`.
- Added deterministic release generation, public-tree validation, and a CI workflow that runs both.
- Isolated the poteto-mode tools (`orch`, `watch-pr`) in their own Bun package with tests and a typecheck.
- Preserved upstream invocation controls for skills that should run only when explicitly selected.
- Added a plain-text decision fallback for public Copilot CLI builds that do not expose `ask_user`.
- Credited Lauren Tan as the original author and jlisam as the Copilot port maintainer in plugin metadata.
- Omitted the upstream Cursor-only `.cursor-plugin/` package and Benny automation.
