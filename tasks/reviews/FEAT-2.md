# Review FEAT-2

Reviewer: `code_reviewer`, independent of `web_developer`.

## Result: APPROVED

The FEAT-2 implementation stays within `apps/web/` and uses the approved
React 19, Vite 8, TypeScript/ESM, `react-router`, native REST/WebSocket,
Vitest/RTL/jsdom and ESLint/`tsc` stack. It consumes the existing lobby
contracts without modifying `contracts/` or adding dependencies. The host,
player and projector links are rendered from the validated server response;
host/projector fragments are parsed with the role-specific session schema,
then removed from the visible URL after localStorage persistence. Player names
are constrained to 20 characters in both the control and the request path,
and participant snapshots are schema-validated and revision-ordered before
rendering. The participant list deliberately renders only server-provided
participants, so the host remains excluded as required.

The current implementation also provides accessible labels, focus-visible
controls, status/error regions and the existing projector/phone layout split.
No token is sent in the WebSocket URL; authentication is sent in the
contract-defined message after the socket opens. No unsafe HTML rendering,
new persistence backend, contract change, or unapproved framework was found.

## Verification

- `npm --prefix apps/web test`: passed, 3 files / 15 tests.
- `npm --prefix apps/web run lint`: passed (ESLint and `tsc --noEmit`).
- `npm --prefix apps/web run build`: passed (Vite production build).
- The checked-in FEAT-2 evidence file from the earlier implementation attempt
  records a stale failing run; it predates the current source and must be
  replaced by fresh `scripts/record-check.mjs` evidence before the task can
  transition to DONE. This is a bookkeeping requirement, not a code-review
  finding.

No review findings remain. The orchestrator should record fresh green test,
lint and build evidence (and complete the required browser acceptance if not
already recorded) before merging and marking the task DONE.
