# Code and Security Review FEAT-9

Reviewer: code_reviewer/security_reviewer, independent of implementation and test authors.
Reviewed the complete FEAT-9 diff against main, including working-tree changes in apps/server/src/game.ts and apps/server/test/game-state.test.ts. Also reviewed task acceptance criteria, agent context, approved stack, architecture scoring/ranking rules, and contracts.

## Result: APPROVED

No code or security blockers.

- Sorting solution terms are copied and sorted by ascending numeric value. The regression uses a deliberately unsorted seed and verifies the evaluation order is term_a, term_b, term_c with values 1, 2, 3.
- Before reveal, player tasks contain only shuffled term IDs/text; host and projector see no sorting terms. No term values occur in the serialized pre-reveal snapshots. The per-player initial order remains stored in the existing sortingOrders map; the existing reauthentication regression continues to check order stability.
- Existing answer validation still requires the correct term-ID permutation. sortingEvaluation compares each submitted ID with the same position in the canonical order, awards one point per match, and returns the matching positionsCorrect array. Host/projector errors equal term count minus points. Missing answers return zero points and therefore full errors.
- Reveal adds points only for frozen participants and can run only while the closed round is in playing phase; the phase change prevents a second accumulation. nextQuestion preserves totalPoints. finishGame records those accumulated scores only after the final evaluation and feeds them into the completed-game ranking.
- Sorting retains the existing 60-second duration. The new test verifies the deadline for player, host, and projector, hidden values before reveal, sorted solution after reveal, player positionsCorrect, host/projector points and errors, and per-game ranking after finish. The quiz path is unchanged and estimation still returns zero pending FEAT-11; no estimation scoring is claimed here.

The solution/result projections conform to existing contracts: sorting solutions carry valued terms only during evaluation; result points/errors and player positionsCorrect use the existing schemas. The diff changes only server game logic and its test. No dependency, manifest, contract, persistence, or cross-component changes were made; the approved Node.js/TypeScript, Fastify, ws, in-memory state, Vitest, and ESLint/typecheck stack is preserved. git diff --check reported no whitespace errors.

## Evidence reviewed

- tasks/evidence/FEAT-9-2026-10-26T17-40-34-017Z.json: red regression failed before the fix because solution terms remained in seed order.
- tasks/evidence/FEAT-9-2026-10-26T17-43-42-119Z.json: lint exited 2 on TypeScript narrowing in the test only. This is not green evidence; the recorded fix kept the assertions unchanged.
- tasks/evidence/FEAT-9-2026-10-26T17-45-17-859Z.json: focused server suite passed, 12/12.
- tasks/evidence/FEAT-9-2026-10-26T17-45-29-629Z.json: full server suite passed, 50/50.
- tasks/evidence/FEAT-9-2026-10-26T17-46-01-138Z.json: lint and typecheck passed.
- tasks/evidence/FEAT-9-2026-10-26T17-46-13-725Z.json: server build passed.

Evidence was reviewed from the recorded files and not rerun. FEAT-9 remains IN_PROGRESS with inventory_refs empty in tasks/state.json; the orchestrator must complete the required main-branch bookkeeping and checks before marking it DONE.
