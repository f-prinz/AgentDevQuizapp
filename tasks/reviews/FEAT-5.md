# Code Review FEAT-5

Reviewer: `code_reviewer`, independent of the FEAT-5/FEAT-7/FEAT-9/FEAT-11 implementation authors.

## Result: APPROVED

I reviewed the integrated `main` implementation in `apps/server/src/game.ts`, `apps/server/src/lobby.ts`, and the ranking/game-state regressions in `apps/server/test/game-state.test.ts` against the FEAT-5 acceptance criteria, `docs/tech-stack.md`, `docs/agent-context.md`, `docs/feature-mvp-architecture.md`, the ranking contracts, and inventory entry `INV-9`.

No blocker or other finding remains in the FEAT-5 scope.

- `finishGame` records a completed game only after the final evaluation, marks its catalog ID as played, stores one per-player score map, and publishes one shared transition containing the previous and current ranking. Repeating a finish with the cleared round is rejected, so scores are not double-counted.
- `projectRanking` sums only completed games, emits one game entry per completed game, gives missing/late players zero for earlier games, and applies competition ranks (`1, 1, 3`) while retaining append-only player order for ties. Host and projector receive the same ranking and transition; player snapshots receive neither aggregate ranking nor transition.
- Quiz points are accumulated once per question at reveal and retained across `nextQuestion`; the final quiz column appears only after the last question. Sorting contributes one point per correct position and its error count is term count minus points. Estimation uses only finite answers, computes strict-closer rank groups with the confirmed ceiling boundaries, gives all closest ties the bonus, caps at five, and returns zero/null rank data for missing answers or `N = 0`. All three score sources flow through the same completed-game map and therefore into total ranking points.
- Catalog projection derives `played` exclusively from completed game IDs and continues to expose metadata without solutions. The role-specific snapshots are parsed through the existing version-1 zod contracts.
- The implementation remains within the approved server stack: Node.js/TypeScript ESM, Fastify/`ws`, in-memory lobby/game state, PostgreSQL-backed catalog boundary, Vitest, ESLint and `tsc`. No dependency, contract, persistence, or cross-component changes are introduced by the integrated ranking work. `INV-9` anchors cover the game/lobby implementation and game-state tests and its notes accurately include quiz, sorting, and estimation results.

## Evidence reviewed

- `tasks/evidence/FEAT-5-2026-10-26T17-28-40-979Z.json`: FEAT-5 full server suite, 49/49, before later scoring additions.
- `tasks/evidence/FEAT-9-2026-10-26T17-48-37-299Z.json`: full server suite, 50/50, including sorting ranking integration.
- `tasks/evidence/FEAT-11-2026-10-26T18-32-46-924Z.json`: full server suite, 54/54, including estimation ranking integration.
- `tasks/evidence/FEAT-11-2026-10-26T18-33-21-335Z.json`: server lint and typecheck passed.
- `tasks/evidence/FEAT-11-2026-10-26T18-33-55-821Z.json`: server build passed.
- `git diff --check` on the current `main` tree reported no whitespace errors.

A fresh `npm --prefix apps/server test` rerun in this review environment could not execute the network-dependent tests: the sandbox denied loopback connections with `EACCES` for the ephemeral HTTP/WebSocket and PostgreSQL ports. This is an environment limitation; the recorded green evidence above remains the executable test evidence for the merged code. No implementation files were changed by this review.
